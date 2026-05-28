# Changelog

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
