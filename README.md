SwitchyAgain
============

![Version](https://img.shields.io/github/v/tag/SwitchyAgain/SwitchyAgain?label=Version)
![License](https://img.shields.io/badge/License-GPL--3.0%2B-A42E2B)
![TypeScript](https://img.shields.io/github/languages/top/SwitchyAgain/SwitchyAgain?label=TypeScript)
![Chrome Supported](https://img.shields.io/badge/Chrome-Supported-4285F4?logo=googlechrome&logoColor=white)
![Edge Supported](https://img.shields.io/badge/Edge-Supported-0F766E)
![Firefox Supported](https://img.shields.io/badge/Firefox-Supported-FF7139?logo=firefoxbrowser&logoColor=white)
<br>
![Languages](https://img.shields.io/badge/Languages-English%20%E4%B8%AD%E6%96%87%20Espa%C3%B1ol%20%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9%20%C4%8Ce%C5%A1tina%20%D9%81%D8%A7%D8%B1%D8%B3%DB%8C-6F42C1)

SwitchyAgain is a Manifest V3 continuation of [SwitchyOmega](https://github.com/FelisCatus/SwitchyOmega) that keeps the
classic proxy profile switching workflow available on modern browsers, including Chrome, Edge, and Firefox.

Install
-------

<a href="https://chromewebstore.google.com/detail/proxy-switchyagain/hbbkenlefdmcliffbbdengpolpeenlgd"><img alt="Available in the Chrome Web Store" src="https://developer.chrome.com/static/docs/webstore/branding/image/UV4C4ybeBTsZt43U4xis.png"></a>
<a href="https://microsoftedge.microsoft.com/addons/detail/proxy-switchyagain/gpkccogacfckfelafcjcapmfgjkjalei"><img alt="Get it from Microsoft Edge" src="https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/add-ons-badge-images/microsoft-edge-add-ons-badge.png"></a>
<a href="https://addons.mozilla.org/firefox/addon/switchyagain/"><img alt="Get the add-on for Firefox" src="https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png"></a>

Changes from SwitchyOmega
-------------------------

### Project Comparison

| Area | <img src="https://raw.githubusercontent.com/FelisCatus/SwitchyOmega/master/omega-web/img/icons/omega-action-24.png" width="18" alt="SwitchyOmega"> SwitchyOmega | <img src="packages/web-ui/img/icons/app-icon-24.png" width="18" alt="SwitchyAgain"> SwitchyAgain |
| --- | --- | --- |
| Extension platform | Manifest V2 | Manifest V3 only |
| Browser target | Legacy extension runtime | Modern browsers, including Chrome, Edge, and Firefox |
| Codebase language | Legacy JavaScript/CoffeeScript-era codebase | TypeScript-first codebase |
| Project structure | Extension-focused layout | Workspace packages for proxy engine, extension runtime, web UI, and browser extension |
| Background runtime | Persistent background page model | MV3 background support for Chrome/Edge service workers and Firefox |
| UI architecture | Original UI stack | React-based UI entry points while keeping the classic workflow |
| Interface settings | Browser-locale dependent UI | In-app language, light/dark theme, and configurable sidebar, popup, and menu options |
| Popup experience | Classic profile menu | Extended popup with profile scope controls, route info, and hidden profiles |
| Profile organization | Flat profile list | Profile groups, hidden profiles, and profile browser |
| Proxy exceptions | Profile-level bypass lists | Profile-level bypass lists + a global bypass list and supplemental lists linked to proxy profiles or profile groups |
| Profile scopes | Global profile switching | Scope-aware profile assignments for tabs, tab groups, containers, and normal/private browsing modes |
| Context menus | Original context menu implementation | New MV3-compatible context menu implementation with profile switching and scope menus |
| Diagnostics | Limited routing visibility | Request Lens diagnostics for inspecting route traces, matched profiles, request results, and ignored requests |
| Backup and restore | Legacy options export and import | SwitchyAgain backup format with metadata, legacy import compatibility, and configurable backup filenames |
| Options sync | Browser Sync | Browser Sync + WebDAV Sync |
| Build tooling | Legacy npm, Browserify, and Bower-era extension build tooling | npm workspaces with TypeScript and esbuild-based bundling |

### Browser Feature Support

| Feature | ![Chrome / Edge](https://img.shields.io/badge/Chrome-Edge-0F766E?labelColor=1A73E8) | ![Firefox](https://img.shields.io/badge/Firefox-FF7139?logo=firefoxbrowser&logoColor=white) |
| --- | :---: | :---: |
| Install source | [Chrome Web Store](https://chromewebstore.google.com/detail/proxy-switchyagain/hbbkenlefdmcliffbbdengpolpeenlgd)<br>[Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/proxy-switchyagain/gpkccogacfckfelafcjcapmfgjkjalei) | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/switchyagain/) |
| Popup profile switching | ![Supported](https://img.shields.io/badge/Supported-2EA44F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| Context menu profile switching | ![Supported](https://img.shields.io/badge/Supported-2EA44F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| SOCKS5 username/password | ![Not available](https://img.shields.io/badge/Not%20available-8C959F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| SOCKS5 local DNS | ![Not available](https://img.shields.io/badge/Not%20available-8C959F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| Per-tab profile scope | ![Not available](https://img.shields.io/badge/Not%20available-8C959F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| Per-tab-group profile scope | ![Not available](https://img.shields.io/badge/Not%20available-8C959F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| Per-container profile scope | ![Not available](https://img.shields.io/badge/Not%20available-8C959F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| Separate normal/private default profiles | ![Supported](https://img.shields.io/badge/Supported-2EA44F) | ![Supported](https://img.shields.io/badge/Supported-2EA44F) |
| Context menu profile icons | ![Text labels](https://img.shields.io/badge/Text%20labels-586069) | ![Icons](https://img.shields.io/badge/Icons-FF7139) |

Status
------

This fork is intended as a compatibility-focused continuation. Most original
documentation remains useful for core proxy profile concepts, but browser
integration, profile scopes, synchronization, backup, and development
instructions may differ.

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
`apps/browser-extension/release`.

`npm run package:dist` copies those archives to `dist/` with versioned
filenames.

Development and debugging commands:

- `npm run build` builds the unpacked browser extension without release
  archives.
- `npm run typecheck` checks all workspace TypeScript projects.
- `npm test` runs the proxy engine, extension runtime, and web UI tests.
- `npm run smoke` runs the Chromium smoke checks only.
- `npm run smoke:firefox` runs the Firefox smoke checks.

License
-------
SwitchyAgain is a fork of [SwitchyOmega](https://github.com/FelisCatus/SwitchyOmega).
The original project and this fork are licensed under the
[GNU General Public License v3.0](COPYING) or later.

Bundled Bootstrap 3.3.7 assets are licensed under the
[MIT License](packages/web-ui/vendor/bootstrap/3.3.7/LICENSE).
