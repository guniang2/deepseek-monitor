# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-11

### Added

- **Always-on-top widget mode** — pin the window above other apps from Settings or the tray menu; the app is tray-only and never shows a taskbar/Dock icon
- **Hover auto-hide / fade** — when always-on-top is enabled, hovering over the window auto-hides or fades it to a preset opacity (click-through, so it never blocks the desktop) and it restores once the mouse moves away
- **Tray menu controls** — toggle always-on-top, choose the mouse-leave behavior, and pick the fade opacity directly from the tray context menu

### Changed

- Minimizing the window now hides it to the tray so no taskbar icon remains
- Hover detection on Linux queries the X server directly for the real cursor position (Electron's cached cursor API is unreliable there); Windows and macOS use the built-in API
- Window position and size are remembered and restored on the next launch (with a safety check so the window never reappears off-screen)

### Fixed

- Linux: auto-launch now creates an XDG autostart entry (previously it was a no-op on Linux)
- Linux: the deb post-install script now sets `chrome-sandbox` ownership to root so the desktop launcher starts correctly instead of failing Chromium's sandbox check

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
