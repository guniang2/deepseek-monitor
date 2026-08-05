# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
