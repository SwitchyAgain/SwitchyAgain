# Changelog

## v1.4.0

Proxy exceptions, backup format, and runtime cleanup.

- Added Proxy Exceptions with a global bypass list and supplemental bypass
  lists linked to proxy profiles and profile groups.
- Added the SwitchyAgain backup format with metadata, legacy import
  compatibility, custom backup filenames, and updated import/export flows.
- Adopted the SwitchyAgain options schema and moved legacy import
  compatibility out of the core runtime.
- Removed the legacy Firefox experimental mode and obsolete SSRL support,
  including their unused translations.
- Preserved profile groups in profile scope menus and improved profile scope
  behavior.
- Improved localized fallback consistency, Persian UI display direction, and
  extension icon rendering.

## v1.3.0

Profile organization, Request Lens diagnostics, and WebDAV sync updates.

- Added profile groups, hidden profile sidebar sections, profile browser menus,
  profile action menus, and custom group colors for organizing larger profile
  sets.
- Added WebDAV Sync for synchronizing settings and profiles through a user
  controlled WebDAV server, including connection testing, manual upload and
  download actions, retry handling, and sync status feedback.
- Expanded Request Lens diagnostics with route trace controls, ignored request
  handling, redirected-request cleanup, and improved popup route info actions.
- Improved fixed proxy profile editing with WebSocket proxy overrides, bypass
  list groups, SOCKS5 local DNS visibility controls, and clearer Chromium HTTPS
  URL limitation messaging.
- Added sidebar, profile page, popup, context menu, and action menu visibility
  options, and reorganized Interface settings for the expanded option set.
- Improved options-page navigation and handoff behavior across browser window
  types, popup dropdown placement, profile selector behavior, and settings
  modal positioning.
- Cleaned up legacy Omega naming in runtime assets, narrowed extension network
  request permissions, refreshed README browser store links, and updated
  localized web UI messages.

## v1.2.2

Profile scope menus, web UI hardening, and release packaging updates.

- Added profile-scoped link, window, and context menu switching, including tab
  group scope support and Chrome context menu labels for profile types.
- Added context menu options for profile scope controls and hidden profiles,
  with matching locale updates and popup loading-state styling refinements.
- Persisted tab profile assignments across extension restarts and allowed the
  System Proxy profile in profile scope menus.
- Fixed Chrome window profile context menus, including incognito detection, and
  tightened source-draft handling around profile actions and apply flows.
- Split the web UI browser/client adapters, reduced options reloads and state
  requests, enabled strict TypeScript checks, and expanded integration coverage.
- Added Edge release packaging, refreshed extension icon assets and README
  content, updated sync/source-editor help translations, and removed the
  unused notifications permission.

## v1.2.1

Proxy settings cleanup, profile editor fixes, and project identity updates.

- Removed obsolete FTP proxy support and legacy proxy script plumbing from the
  browser extension proxy implementation.
- Added rule-list export cache controls and duplicate profile creation.
- Restored the first-run options guide and added PO catalog validation to the
  project checks.
- Added a General settings current-profile selector, a visibility option for
  that selector, and Firefox SOCKS5 local DNS configuration where supported.
- Improved profile editing behavior for unchanged edits, direct profile source
  validation, removed-profile navigation, and loaded switch rules after
  deletion.
- Refined proxy authentication capability handling and availability UI.
- Updated the main extension icon, extension description, About page links, and
  Firefox extension ID for the new SwitchyAgain organization identity.

## v1.2.0

Profile scope controls, theme support, and popup customization.

- Added profile scope controls for tab, container, and normal/private window
  profile assignments where supported by the browser.
- Added a dedicated Profile Scope settings page for managing scope assignments
  outside the popup.
- Added Interface theme selection with light, dark, and system theme modes.
- Added popup controls for hiding profiles and optionally showing hidden
  profiles in a separate popup section.
- Added Interface options for showing or hiding the popup Add Condition and Add
  Temporary Rule entries.
- Improved popup and settings-page layout behavior for long profile lists and
  sticky action areas.

## v1.1.20

Legacy cleanup and startup fallback fixes.

- Removed the old SwitchySharp/SwitchyOptions migration path so startup no
  longer attempts to import pre-SwitchyAgain localStorage config.
- Removed the background OmegaDebug entrypoint and issue-template flow, and
  renamed the MV3 compatibility preload to the runtime preload while keeping
  the required MV3 storage and action shims.
- Cleaned remaining user-facing SwitchyOmega wording from bundled locales and
  removed unused About/debug locale messages.
- Treated option records missing schemaVersion as unavailable config so
  installs with storage leftovers reset to default options instead of failing
  startup.

## v1.1.19

Route diagnostics and build target modernization.

- Added route trace diagnostics for inspecting how profile decisions resolve
  across direct, default, virtual, and rule-list profile flows.
- Migrated package tests from Mocha to Vitest while keeping tests running
  directly against TypeScript sources.
- Centralized browser entrypoint script ordering in generated sources and added
  build assumption checks for entrypoint and JavaScript target consistency.
- Raised TypeScript and esbuild JavaScript output targets to ES2022 across the
  workspace build.
- Removed remaining React migration leftovers and aligned route information
  naming.

## v1.1.18

Localization cleanup and extension startup fixes.

- Added the Interface language setting with persisted import/export support and
  bundled locale selection for the shipped languages.
- Pruned incomplete locale catalogs and aligned the Chinese locale source names
  with Hans/Hant language variants.
- Reworked PAC generation to use the local AST printer instead of UglifyJS and
  removed remaining Bluebird, heap, and FileSaver runtime dependencies.
- Fixed clean-install startup when default UI locale detection runs in the
  bundled browser-extension runtime.
- Kept options/profile reads responsive when proxy application fails during
  background initialization.
- Added Firefox extension smoke coverage and opened Firefox shortcut settings
  through the browser commands API when available.
- Adjusted Interface settings controls to match the existing Switch Options
  dropdown behavior.

## v1.1.17

Dependency, workspace, and proxy matching cleanup.

- Modernized runtime dependencies and bundled Bootstrap assets while keeping the
  extension build compatible with the updated toolchain.
- Adapted options sync to the newer limiter runtime and upgraded the Bluebird
  dependency.
- Normalized bypass IP matching and IDN host conditions so proxy rules handle
  encoded and canonical forms more consistently.
- Renamed workspace packages and the web UI locale catalog to match the current
  SwitchyAgain project layout.
- Updated browser extension locale packaging and removed locales that are not
  shipped by the extension build.
- Added local smoke tests for extension packaging, library loading, and UI
  entry points.

## v1.1.16

Build modernization and options style cleanup.

- Migrated runtime bundle generation from Browserify/CommonJS output toward
  esbuild-built ESM sources while preserving the extension runtime globals.
- Modernized the Mocha test runner so tests execute directly against
  TypeScript sources with official test types and checked-in Mocha options.
- Removed the intermediate test build directory and simplified the test
  source layout.
- Added a root dist packaging helper for copying release artifacts with
  versioned names.
- Migrated the options page styles from Less to plain CSS while preserving the
  generated Bootstrap-aligned rules.
- Fixed profile selectors so internal rule-list profiles are not shown as
  user-selectable profiles.

## v1.1.15

React popup and options migration fixes.

- Continued the React TypeScript migration by tightening popup runtime,
  profile map, state, and condition API boundaries across the popup page and
  extension popup bridge.
- Restored the Auto Switch rule drag helper so reordered rules again show a
  floating row while preserving the migrated React drag-and-drop behavior.
- Kept the migrated popup and options UI behavior aligned with the legacy
  Bootstrap controls and workflows.

## v1.1.14

React options migration completion and profile editor fixes.

- Switched the production options page to the React shell and completed the
  migrated profile route and profile content flows.
- Fixed Auto Switch route query handling, CSP-safe PAC script preloading, and
  the About page PAC runtime error under MV3 CSP.
- Restored the profile title bar layout so the color and name stay on the left
  while profile action buttons align to the right.
- Preserved Auto Switch condition detail focus, cloned-rule selection, and
  scroll position stability while keeping batched rule rendering.
- Improved failed request reporting in the page info diagnostics.

## v1.1.13

React options migration and popup condition fixes.

- Continued the Switch Profile migration by moving rule actions, lifecycle
  handling, and session state helpers out of the Angular controller.
- Fixed imported options state replacement so restoring options does not leave
  Apply Changes marked dirty after the automatic apply.
- Prevented background profile update failures after applying a profile from
  surfacing as unhandled promise rejections.
- Adjusted popup Add Condition writes to append new rules to the bottom of the
  active switch profile.
- Updated the welcome modal branding and locale strings to SwitchyAgain.

## v1.1.12

Chrome MV3 popup and options state fixes.

- Restored the Add Condition popup flow to the legacy Angular form while
  keeping the MV3 popup menu entry point.
- Fixed popup state reads and writes on MV3 so the Add Condition page can load
  the active profile, result profile list, and current page domain reliably.
- Preserved the current profile when importing options unless imported options
  explicitly define a startup profile.
- Removed the Firefox for Android manifest declaration because the extension
  does not support Firefox on Android.

## v1.1.11

React options migration fixes.

- Migrated the remaining Interface switch options and quick switch settings to
  React while preserving the legacy profile ordering and startup profile
  behavior.
- Removed the legacy Import/Export Angular controller and completed the React
  Import/Export settings, restore, sync, and feedback flows.
- Fixed React options bootstrapping, profile dropdown dismissal, import success
  feedback, and imported-options dirty state handling.

## v1.1.10

React options migration and Chrome runtime cleanup.

- Migrated additional profile content surfaces to React, including fixed,
  PAC, rule list, and switch profile sections.
- Moved switch profile rule headers, footers, condition help, and rule rows
  into React while preserving the existing Angular rule editing behavior.
- Added batched switch rule row rendering to reduce the initial delay on
  larger auto switch profiles.
- Smoothed embedded React options page mounting to avoid visible first-frame
  jumps and loading flashes.
- Cleaned up Chrome MV3 runtime warnings for release manifests, context menu
  handlers, tab reload races, and fire-and-forget extension messages.
- Removed the obsolete SwitchySharp compatibility bridge.

## v1.1.9

React options migration preview.

- Added hidden React options preview pages for isolated testing.
- Embedded React implementations for General, Import/Export, UI settings,
  About, confirmation modals, profile creation/rename/auth modals, and small
  profile content views while preserving the legacy Bootstrap options shell.
- Added shared React profile widgets for profile icon, inline display, and
  profile selection.
- Updated About page copy and locale entries for the current SwitchyAgain
  project information.
- Corrected settings branding copy to SwitchyAgain.

## v1.1.8

Maintenance release for workspace build and extension packaging cleanup.

- Centralized workspace build dependencies and script binary usage.
- Moved TypeScript build output out of source trees.
- Switched bundle minification to esbuild while keeping Browserify bundling.
- Kept PAC generation on the vendored UglifyJS implementation.
- Split Chromium and Firefox release artifacts with browser-specific
  manifests.
- Removed legacy Firefox proxy string-return fallback.

## v1.1.7

Maintenance release for removing the legacy CoffeeScript and Grunt build
tooling.

- Converted the remaining CoffeeScript tests, entry points, and build
  configuration to JavaScript.
- Removed the remaining CoffeeScript source and toolchain dependencies.
- Replaced package-level Grunt test and build tasks with direct npm scripts.
- Replaced omega-web and chromium extension Grunt builds with Node build
  scripts.
- Removed the remaining Grunt build configuration and omega-build hub package.

## v1.1.6

Maintenance release for the omega-web TypeScript migration.

- Converted omega-web page scripts from CoffeeScript to JavaScript.
- Added TypeScript build configuration for omega-web page scripts.
- Converted omega-web page scripts from JavaScript to TypeScript.
- Converted omega-web popup script from CoffeeScript to JavaScript.
- Converted omega-web AngularJS app sources from CoffeeScript to JavaScript.
- Added TypeScript build configuration for omega-web AngularJS app sources.
- Converted omega-web AngularJS app sources from JavaScript to TypeScript
  while preserving the generated JavaScript build output.

## v1.1.5

Maintenance release for the chromium extension runtime scripts TypeScript
migration.

- Converted chromium extension runtime scripts from CoffeeScript to JavaScript.
- Added TypeScript build configuration for chromium extension runtime scripts.
- Converted chromium extension runtime scripts from JavaScript to TypeScript
  while preserving the generated JavaScript build output.

## v1.1.4

Maintenance release for the chromium extension module TypeScript migration.

- Converted chromium extension module sources from CoffeeScript to JavaScript.
- Added TypeScript build and typecheck configuration for chromium extension
  modules.
- Converted chromium extension module sources from JavaScript to TypeScript
  while preserving the generated JavaScript build output.

## v1.1.3

Maintenance release for the omega-target TypeScript migration.

- Converted omega-target source modules from CoffeeScript to JavaScript.
- Added TypeScript build and typecheck configuration for omega-target.
- Converted omega-target source modules from JavaScript to TypeScript while
  preserving the generated JavaScript build output.

## v1.1.2

Maintenance release for the PAC rule engine TypeScript migration.

- Added TypeScript build and typecheck configuration for omega-pac.
- Converted omega-pac source modules from JavaScript to TypeScript while
  preserving the generated JavaScript build output.
- Fixed a latent omega-pac regex helper typo surfaced by TypeScript checking.

## v1.1.1

Maintenance release for the PAC rule engine migration.

- Converted the omega-pac source modules from CoffeeScript to JavaScript.
- Fixed the omega-pac test script so it runs on the current local toolchain.
- Removed legacy CircleCI, GitHub issue template, pull request template, and
  Tern project metadata.

## v1.1.0

Maintenance and packaging updates for SwitchyAgain.

- Replaced Bower-managed frontend dependencies with npm-managed copies.
- Updated FileSaver to 2.0.5.
- Added npm build and release scripts for common extension build tasks.
- Removed obsolete FTP scheme selection from the proxy server UI.
- Reduced packaged Bootstrap font files to modern browser formats.
- Updated browser action status title prefixes from Omega to Again.

## v1.0.2

Review and compatibility updates for SwitchyAgain.

- Updated bundled AngularJS libraries to 1.8.3.
- Updated bundled jQuery to 3.7.1 and jQuery UI to 1.13.3.
- Added Firefox data collection permission metadata.
- Removed AMO-only Chrome manifest fields from the AMO package.
- Updated browser action tooltip branding to SwitchyAgain.
- Removed Report issues and Save error log from the extension action context
  menu.
- Cleared stale context menu entries before recreating the current menu.

## v1.0.1

Maintenance release for SwitchyAgain.

- Updated About page project and license information.
- Changed "Refresh current tab on profile change" to disabled by default.
- Updated Firefox extension ID.
- Rebuilt the extension with the corrected default options.

## v1.0.0

Initial SwitchyAgain release.

- Forked from SwitchyOmega.
- Migrated the extension to Manifest V3.
- Added support for modern Chrome and Firefox.
- Renamed the project to SwitchyAgain.
- Updated extension branding, options title, and README.
- Restored missing UI icons in the options and popup pages.
- Fixed profile switching behavior in the popup.
- Fixed Firefox profile switching so it respects the refresh setting.
