# Third-party notices

Original OpenLegalCore material in this repository is licensed under the
[Apache License 2.0](LICENSE). Third-party material retains its own license.
This file records copied scaffold material, production packages included in
the browser bundle, and an external runtime loaded by the application.

## Microsoft Office Add-in scaffold

This project contains scaffold material derived from Microsoft's
`OfficeDev/Office-Addin-TaskPane` repository. The locked source revision and
license object are recorded in
[docs/UPSTREAM_SOURCES.md](docs/UPSTREAM_SOURCES.md).

The following notice is reproduced from the locked upstream
[license](https://github.com/OfficeDev/Office-Addin-TaskPane/blob/d1c0386a71f584056d7907724aebb25f6184550b/LICENSE):

```text
    Office Add-in TaskPane

    MIT License

    Copyright (c) Microsoft Corporation. All rights reserved.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE
```

## Microsoft Office.js runtime

The task-pane and command pages load Microsoft's Office.js runtime from
`https://appsforoffice.microsoft.com/lib/1/hosted/office.js`. That script is
delivered by Microsoft at runtime and is not vendored into this repository or
the generated connector bundle. Its delivery and use remain subject to the
applicable Microsoft terms.

## core-js 3.50.0

The production browser bundle uses `core-js`, licensed under the MIT License.

```text
Copyright (c) 2013–2025 Denis Pushkarev (zloirock.ru)
Copyright (c) 2025–2026 CoreJS Company (core-js.io)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Source: [core-js v3.50.0 license](https://github.com/zloirock/core-js/blob/v3.50.0/LICENSE).

## regenerator-runtime 0.14.1

The production browser bundle uses `regenerator-runtime`, licensed under the
MIT License.

```text
MIT License

Copyright (c) 2014-present, Facebook, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: [regenerator-runtime 0.14.1 license](https://github.com/facebook/regenerator/blob/regenerator-runtime%400.14.1/LICENSE).

## Build and development dependencies

### Separate OLC Engine service

OLC Engine is not vendored or bundled. Its proprietary implementation and Python
reference adapter are not redistributed by this Word change. The independently
implemented Word client follows the pinned documented document-review interface;
[protocol provenance](docs/UPSTREAM_SOURCES.md#engine-protocol-compatibility-olc-72)
records its exact source references and the license distinction. This is not an
Apache-2.0 license grant for Engine.

The lockfile contains development and build tools under their own licenses.
They are used to generate and verify the project but are not presented here as
production browser components. The scaffold generator is recorded separately
in [Upstream sources](docs/UPSTREAM_SOURCES.md).

Anyone redistributing a different source tree, bundle or dependency set is
responsible for identifying its actual contents and preserving all notices
required by those artifacts.

## jose 6.2.13 — server-only Word authorization/API Workers

Pinned npm dependency, MIT; bundled only into the authorization and API Workers, never
into Pages. Upstream commit `316b7f2cb41b8377515d9cc2e81e03f8e50ee935`
(tag `v6.2.13`). No source was manually copied into the connector. The generated
Worker package includes `JOSE-LICENSE.txt`.

```text
The MIT License (MIT)

Copyright (c) 2018 Filip Skokan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: [jose pinned license](https://github.com/panva/jose/blob/316b7f2cb41b8377515d9cc2e81e03f8e50ee935/LICENSE.md).

## Microsoft Authentication Library for JavaScript

Pinned production packages `@azure/msal-browser@5.26.0` and its
`@azure/msal-common@16.14.3` dependency are MIT. Their release tags
`msal-browser-v5.26.0` and `msal-common-v16.14.3` both resolve to upstream
commit `16a4714f38ba2844f34d154dd59dd8f1402457c9` in
[Microsoft's repository](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/16a4714f38ba2844f34d154dd59dd8f1402457c9).
Package integrity values are locked in `package-lock.json`. No Microsoft sample
source was manually copied into this connector. The browser package includes
the complete `MSAL-LICENSE.txt`, in addition to emitted copyright notices.
The operator-only owner-enrollment overlay also bundles this same pinned MSAL
package and includes its complete license; no new third-party source is copied.
Both packages carry the following license:

```text
MIT License

Copyright (c) Microsoft Corporation. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE

```
