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

The lockfile contains development and build tools under their own licenses.
They are used to generate and verify the project but are not presented here as
production browser components. The scaffold generator is recorded separately
in [Upstream sources](docs/UPSTREAM_SOURCES.md).

Anyone redistributing a different source tree, bundle or dependency set is
responsible for identifying its actual contents and preserving all notices
required by those artifacts.
