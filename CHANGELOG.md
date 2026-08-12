# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-12

### Added

- **Window position memory** — the window position and size are saved on exit and restored on the next launch (with a safety check so it never reappears off-screen after a monitor layout change)
- **Linux auto-launch** — enabling "launch at startup" now writes an XDG autostart entry on Linux (previously it was a no-op)

### Fixed

- Linux: the deb-installed app failed to launch from the desktop icon (Chromium sandbox init crash); the desktop entry now uses `--no-sandbox`, matching the AppImage
- Linux: the app icon showed the default gear because icons were installed to an invalid `hicolor/0x0` path; a standard hicolor icon set (16–512) is shipped now
- Linux: the deb post-install script sets `chrome-sandbox` ownership to root and the package is built with root file ownership
- Linux: `.marscode` IDE local files are ignored by git

### Changed

- Release publishing targets the repository where the CI workflow runs, so fork builds publish to the fork's Releases page
- CI builds the Linux `.deb` package in addition to the AppImage

## [1.2.0] - 2026-08-11

### Added

- **Always-on-top widget mode** — pin the window above other apps from Settings or the tray menu; the app is tray-only and never shows a taskbar/Dock icon
- **Hover auto-hide / fade** — when always-on-top is enabled, hovering over the window auto-hides or fades it to a preset opacity (click-through, so it never blocks the desktop) and it restores once the mouse moves away
- **Tray menu controls** — toggle always-on-top, choose the mouse-leave behavior, and pick the fade opacity directly from the tray context menu

### Changed

- Minimizing the window now hides it to the tray so no taskbar icon remains
- Hover detection on Linux queries the X server directly for the real cursor position (Electron's cached cursor API is unreliable there); Windows and macOS use the built-in API

## [1.1.0] - 2026-08-05

### Added

- **Balance alerts** — system notification when the balance drops below a configurable threshold (per-account, once until it recovers)
- **Multi-account support** — manage multiple DeepSeek accounts with one-click switching; legacy single-account config auto-migrates
- **Encrypted credential storage** — API keys and usage tokens are now encrypted with Electron `safeStorage` (OS keychain); plain-text legacy values are re-encrypted on first launch
- **In-app auto-update** — check for updates from Settings; downloads and installs new releases automatically

### Changed

- Credential operations apply to the currently active account

## [1.0.0] - 2026-06-13

### Added

- Real-time DeepSeek account balance monitoring
- Dual-model usage statistics (V4 Flash / V4 Pro): tokens, cache hit rate, spend
- 7-day token usage trend charts with cache hit / miss / output breakdown
- Per-day usage drill-down details page
- Auto refresh (1 min / 5 min / 30 min / 1 hour)
- Launch at startup for Windows and macOS
- System tray support with window-to-tray minimize
- Built-in browser login window with automatic usage token capture
- Frameless transparent glassy dark UI
