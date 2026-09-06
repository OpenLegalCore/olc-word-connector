/* eslint-disable no-undef */

const path = require("path");

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

const OFFICE_ASSET_VERSION = "1.0.0.2";
const DEFAULT_WORD_MODEL_ID = "olc-engine";
const BUILD_TARGETS = Object.freeze({
  development: {
    outputDirectory: "dev",
    manifest: "manifests/manifest.dev.xml",
    webpackMode: "development",
  },
  staging: {
    outputDirectory: "stage",
    manifest: "manifests/manifest.stage.xml",
    webpackMode: "production",
    deployable: true,
  },
  production: {
    outputDirectory: "prod",
    manifest: "manifests/manifest.prod.xml",
    webpackMode: "production",
    deployable: true,
  },
  harness: {
    outputDirectory: "harness",
    webpackMode: "development",
    browserHarness: true,
  },
  "word-harness": {
    outputDirectory: "word-harness",
    manifest: "manifests/manifest.dev.xml",
    webpackMode: "development",
    wordHarness: true,
  },
});

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

function resolveWordModelId(value) {
  if (value === undefined) {
    return DEFAULT_WORD_MODEL_ID;
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/.test(value)) {
    throw new Error("OLC_WORD_MODEL_ID must be a non-empty printable model identifier.");
  }
  return value;
}

function resolveBuildTarget(env, options = {}) {
  const target = env && env.target;
  if (typeof target !== "string" || !Object.hasOwn(BUILD_TARGETS, target)) {
    const renderedTarget = typeof target === "string" ? JSON.stringify(target) : String(target);
    throw new Error(`Invalid or missing webpack build target: ${renderedTarget}`);
  }

  const targetConfig = BUILD_TARGETS[target];
  if (options.mode !== targetConfig.webpackMode) {
    throw new Error(
      `Webpack target ${target} requires --mode ${targetConfig.webpackMode}, received ${String(options.mode)}`
    );
  }

  return { name: target, ...targetConfig };
}

function staticPatterns(target) {
  const iconPatterns = [16, 32, 64, 80].map((size) => ({
    from: `assets/openlegalcore-mark-${size}.png`,
    to: `assets/office/${OFFICE_ASSET_VERSION}/[name][ext]`,
  }));
  const patterns = [
    ...iconPatterns,
    {
      from: "assets/icon-128.png",
      to: "assets/[name][ext]",
    },
  ];

  if (target.manifest) {
    patterns.push({
      from: target.manifest,
      to: "manifest.xml",
    });
  }
  if (target.deployable) {
    patterns.push({
      from: "hosting/cloudflare/_headers",
      to: "_headers",
      toType: "file",
    });
  }

  return patterns;
}

async function webpackConfig(env, options) {
  const target = resolveBuildTarget(env, options);
  const wordModelId = resolveWordModelId(process.env.OLC_WORD_MODEL_ID);
  const moduleRules = [
    {
      test: /\.ts$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
      },
    },
    {
      test: /\.html$/,
      exclude: /node_modules/,
      use: "html-loader",
    },
    {
      test: /\.(png|jpg|jpeg|gif|ico)$/,
      type: "asset/resource",
      generator: {
        filename: "assets/[name][ext][query]",
      },
    },
  ];

  const devServer = {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    server: {
      type: "https",
      options:
        (env && env.WEBPACK_BUILD) || options.https !== undefined
          ? options.https
          : await getHttpsOptions(),
    },
    port: process.env.npm_package_config_dev_server_port || 3002,
  };

  const output = {
    clean: true,
    path: path.resolve(__dirname, "dist", target.outputDirectory),
    filename: target.deployable ? "[name].[contenthash:20].js" : "[name].js",
    chunkFilename: target.deployable ? "[name].[contenthash:20].js" : "[name].js",
  };

  if (target.browserHarness) {
    return {
      devtool: "source-map",
      entry: {
        harness: "./test/harness/harness.ts",
      },
      output,
      resolve: {
        extensions: [".ts", ".js"],
      },
      module: { rules: moduleRules },
      plugins: [
        new HtmlWebpackPlugin({
          filename: "harness.html",
          template: "./test/harness/harness.html",
          chunks: ["harness"],
        }),
      ],
      devServer,
    };
  }

  return {
    devtool: target.deployable ? false : "source-map",
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      taskpane: target.wordHarness
        ? ["./test/word-harness/wordHarness.ts", "./test/word-harness/taskpane.html"]
        : ["./src/taskpane/taskpane.ts", "./src/taskpane/taskpane.html"],
      commands: "./src/commands/commands.ts",
    },
    output,
    resolve: {
      extensions: [".ts", ".html", ".js"],
    },
    module: { rules: moduleRules },
    plugins: [
      new webpack.DefinePlugin({
        __OLC_WORD_MODEL_ID__: JSON.stringify(wordModelId),
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: target.wordHarness
          ? "./test/word-harness/taskpane.html"
          : "./src/taskpane/taskpane.html",
        chunks: ["polyfill", "taskpane"],
      }),
      new CopyWebpackPlugin({ patterns: staticPatterns(target) }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["polyfill", "commands"],
      }),
    ],
    devServer,
  };
}

webpackConfig.BUILD_TARGETS = BUILD_TARGETS;
webpackConfig.DEFAULT_WORD_MODEL_ID = DEFAULT_WORD_MODEL_ID;
webpackConfig.OFFICE_ASSET_VERSION = OFFICE_ASSET_VERSION;
webpackConfig.resolveBuildTarget = resolveBuildTarget;
webpackConfig.resolveWordModelId = resolveWordModelId;
module.exports = webpackConfig;
