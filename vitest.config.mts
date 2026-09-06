import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/app/state.ts",
        "src/app/TaskPaneController.ts",
        "src/chat/*.ts",
        "src/office/OfficeWordAdapter.ts",
        "src/office/WordAdapter.ts",
        "src/office/selectionPolicy.ts",
        "src/taskpane/ProductionTaskPaneRuntime.ts",
        "src/taskpane/TaskPaneView.ts",
        "src/taskpane/i18n.ts",
        "src/taskpane/messages.en-US.ts",
        "src/taskpane/messages.sl-SI.ts",
        "src/taskpane/safeLegalAnswer.ts",
        "src/taskpane/taskPaneCopy.ts",
        "src/taskpane/taskpane.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 90,
        "src/chat/*.ts": {
          branches: 90,
        },
        "src/office/selectionPolicy.ts": {
          branches: 90,
        },
      },
    },
  },
});
