SwitchyAgain
============

![Version](https://img.shields.io/github/v/tag/iklh/SwitchyAgain?label=Version) ![License](https://img.shields.io/badge/License-GPL--3.0%2B-blue) ![Forked from SwitchyOmega](https://img.shields.io/badge/Forked_from-SwitchyOmega-2F80ED?logo=git&logoColor=white)
<br>
![Written in TypeScript](https://img.shields.io/badge/Written_in-TypeScript-3178C6?logo=typescript&logoColor=white) ![Built with React](https://img.shields.io/badge/Built_with-React-61DAFB?logo=react&logoColor=white)
<br>
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?logo=json) ![Chrome Supported](https://img.shields.io/badge/Chrome-Supported-4285F4?logo=googlechrome&logoColor=white) ![Firefox Supported](https://img.shields.io/badge/Firefox-Supported-FF7139?logo=firefoxbrowser&logoColor=white)
<br>
![Languages](https://img.shields.io/badge/Languages-English%20%E4%B8%AD%E6%96%87%20Espa%C3%B1ol%20%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9%20%C4%8Ce%C5%A1tina%20%D9%81%D8%A7%D8%B1%D8%B3%DB%8C-3178C6)

SwitchyAgain is a fork of [SwitchyOmega](https://github.com/FelisCatus/SwitchyOmega) focused on keeping the proxy switching
workflow available on modern browsers.

Changes from SwitchyOmega
-------------------------

- Migrated the Chromium/Firefox extension target to Manifest V3.
- Added compatibility handling for Chrome MV3 service workers and Firefox MV3
  background scripts.
- Kept the classic profile switching workflow, including fixed, direct, system,
  and PAC/rule-based profiles.
- Modernized the codebase around TypeScript workspace packages and React UI
  entry points.
- Renamed the extension to SwitchyAgain and maintains a separate version line
  for this fork.

Status
------

This fork is intended as a compatibility-focused continuation. Most original
documentation still applies unless noted otherwise.

Development
-----------
This repository uses npm workspaces for the proxy engine, extension runtime,
web UI, and browser extension packages.

For a normal local release build, the workflow is:

```sh
npm install
npm run release
npm run package:dist
```

`npm run release` builds the Chromium and Firefox extension archives under
`apps/browser-extension/release`. `npm run package:dist` copies those archives
to `dist/` with versioned filenames.

Development and debugging commands:

- `npm run build` builds the unpacked browser extension without release
  archives.
- `npm run typecheck` checks all workspace TypeScript projects.
- `npm test` runs the proxy engine and extension runtime tests.
- `npm run smoke` runs the Chromium smoke checks only.
- `npm run smoke:firefox` runs the Firefox smoke checks.

License
-------
SwitchyAgain is licensed under the [GNU General Public License v3.0 or later](COPYING).

Bundled Bootstrap 3.3.7 assets are licensed under the MIT License; see the
[LICENSE](packages/web-ui/vendor/bootstrap/3.3.7/LICENSE).
