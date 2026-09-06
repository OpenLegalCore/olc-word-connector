# Upstream sources and provenance

This record distinguishes copied or derived material, build-time tooling,
bundled production packages and externally delivered runtime code. Git objects,
package versions and integrity values are recorded independently so one kind of
identifier is not presented as another.

| Role | Repository and ref | Locked commit | Use in this repository |
| --- | --- | --- | --- |
| Generated scaffold template | [`OfficeDev/Office-Addin-TaskPane`](https://github.com/OfficeDev/Office-Addin-TaskPane), `master` | [`d1c0386a71f584056d7907724aebb25f6184550b`](https://github.com/OfficeDev/Office-Addin-TaskPane/commit/d1c0386a71f584056d7907724aebb25f6184550b) | Source template copied and reduced to the Word host by the Microsoft generator. |
| Scaffold generator | [`OfficeDev/generator-office`](https://github.com/OfficeDev/generator-office), [`v3.0.2`](https://github.com/OfficeDev/generator-office/tree/v3.0.2) | [`ca191af1a6e2ace2394663f0c6f4c96a5439c6d1`](https://github.com/OfficeDev/generator-office/commit/ca191af1a6e2ace2394663f0c6f4c96a5439c6d1) | Generated the TypeScript Word task-pane project with an add-in-only XML manifest. |

## OpenLegalCore mark assets

The compact OpenLegalCore mark used by the Office manifests is derived from the
OpenLegalCore website repository at the immutable commit and source object
below. This is a provenance record, not a grant of trademark rights.

- repository:
  [`OpenLegalCore/openlegalcore-website`](https://github.com/OpenLegalCore/openlegalcore-website)
- locked commit:
  [`58481ae5ec5d94ebcf93beac942ff029e8ff8290`](https://github.com/OpenLegalCore/openlegalcore-website/commit/58481ae5ec5d94ebcf93beac942ff029e8ff8290)
- source path:
  `public/assets/openlegalcore/logo/svg/openlegalcore-mark-primary.svg`
- source Git blob: `d405a5c21dd2d6269a10189cf6b08faab44c8dde`

The committed raster derivatives are locked by their current Git blob IDs:

| Repository path                           | Git blob                                   |
| ----------------------------------------- | ------------------------------------------ |
| `assets/openlegalcore-mark-16.png`        | `bdc4c471a04efadbf36a175e7f2fa54024027d28` |
| `assets/openlegalcore-mark-32.png`        | `aaba153fae5385d35870dfd5baecb6e91f455a05` |
| `assets/openlegalcore-mark-64.png`        | `4dc6518276a04360dc30a955f5057f2ddc5ae2cd` |
| `assets/openlegalcore-mark-80.png`        | `833458c37f8f398927d7e5b60e573e72add32d7a` |

The retained `assets/icon-128.png` scaffold icon has Git blob
`37dfcd77025e49f00ad33c41543f9f013cd94a83` and matches the corresponding
asset in the locked Microsoft template. OpenLegalCore name and mark use is
governed separately by [`TRADEMARKS.md`](../TRADEMARKS.md).

## Generator lock

The scaffold command used these exact npm package identities:

- `generator-office@3.0.2`
- npm integrity: `sha512-V6YDHoAibHyMy4Mymu3i1X3QdRCYCmNycMl6PZRjyqTKexuo2TODxBBDrQO4gpSvVZLCdU6lbyo4V77q/XOaTQ==`
- `yo@7.0.1`
- npm integrity: `sha512-HQcOYtTvDJ7BgUFv6aTKZ/QwFLQvpolfXjhK39sztfmHZov5rT6YMb3IULbBYiq678S8VpEpFc3tTtETnUxAiQ==`

The upstream `v3.0.2` tag resolves to the Git commit recorded above. The
upstream repository's `package.json` at that tag still declares version
`3.0.0`; therefore the npm name, version and integrity value—not that embedded
field—are the authoritative generator-package identity for this record.

Generator invocation:

```bash
npm exec --yes --package=yo@7.0.1 --package=generator-office@3.0.2 -- \
  yo office taskpane "OpenLegalCore for Word" word xml \
  --ts --output olc-word-connector --skip-install --skip-cache
```

The committed `package-lock.json` is the authoritative dependency lock for the
generated project. Upstream repositories are references, not Git submodules or
vendored donor projects.

## External Microsoft runtime

The generated task-pane and command pages load Office.js from:

```text
https://appsforoffice.microsoft.com/lib/1/hosted/office.js
```

Office.js is delivered by Microsoft at runtime and is not committed or bundled
here. The `/1/` URL selects Microsoft's Office.js major-version channel rather
than an immutable byte-level artifact. See
[Third-party notices](../THIRD_PARTY_NOTICES.md).

## Production browser dependencies

The production bundle imports these packages from the locked dependency tree:

| Package | Locked version | License | Source |
| --- | --- | --- | --- |
| `core-js` | `3.50.0` | MIT | [License](https://github.com/zloirock/core-js/blob/v3.50.0/LICENSE) |
| `regenerator-runtime` | `0.14.1` | MIT | [License](https://github.com/facebook/regenerator/blob/regenerator-runtime%400.14.1/LICENSE) |

Their required notices are reproduced in
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Verification summary

The recorded Git commits, tag targets, upstream license texts, source asset
blob and committed raster-asset blobs were rechecked for this documentation
review. The production package versions and license identifiers match the
committed npm lockfile.
