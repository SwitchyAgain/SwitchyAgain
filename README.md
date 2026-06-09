SwitchyAgain
============

![Version](https://img.shields.io/github/v/tag/iklh/SwitchyAgain?label=Version) ![License](https://img.shields.io/badge/License-GPL--3.0%2B-blue) ![Written in TypeScript](https://img.shields.io/badge/Written_in-TypeScript-3178C6?logo=typescript&logoColor=white) ![Built with React](https://img.shields.io/badge/Built_with-React-61DAFB?logo=react&logoColor=white) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853) ![Chrome Supported](https://img.shields.io/badge/Chrome-Supported-4285F4?logo=googlechrome&logoColor=white) ![Firefox Supported](https://img.shields.io/badge/Firefox-Supported-FF7139?logo=firefoxbrowser&logoColor=white)

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

Common commands:

- `npm install` installs workspace dependencies.
- `npm run build` builds the browser extension.
- `npm run typecheck` checks all workspace TypeScript projects.
- `npm test` runs the proxy engine and extension runtime tests.
- `npm run smoke` runs the local extension and UI smoke checks.
- `npm run release` builds Chromium and Firefox release artifacts.
- `npm run package:dist` copies versioned release archives to `dist/`.

License
-------
SwitchyAgain is licensed under the [GNU General Public License v3.0 or later](COPYING).

Bundled Bootstrap 3.3.7 assets are licensed under the MIT License; see the
[LICENSE](packages/web-ui/vendor/bootstrap/3.3.7/LICENSE).
