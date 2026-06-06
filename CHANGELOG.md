# Changelog

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
