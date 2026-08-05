<div align="center">

# DeepSeek Monitor

A sleek, lightweight desktop app for tracking your DeepSeek account balance, API usage, and spending trends in real time.

[![Electron](https://img.shields.io/badge/Electron-42.4.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)](https://github.com/guniang2/deepseek-monitor/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/guniang2/deepseek-monitor/pulls)

**English** | [简体中文](README.zh-CN.md)

</div>

---

## ✨ Why DeepSeek Monitor?

The official DeepSeek platform shows your balance and usage scattered across different pages — and the usage dashboard doesn't even have a refresh button. **DeepSeek Monitor** puts everything on one compact dashboard:

- 💰 Balance at a glance, **auto-refreshed** while you work
- 📊 Per-model token consumption, cache hit rates, and costs for **V4 Flash & V4 Pro**
- 📈 7-day trend charts with daily drill-down
- 🪟 Stays in your **system tray** — one click away, never in the way

## 📸 Screenshots

<!-- Add your screenshots here, e.g.:
<p align="center">
  <img src="assets/screenshots/dashboard.png" width="360" />
  <img src="assets/screenshots/details.png" width="360" />
</p>
-->

## 🚀 Features

- **Real-time balance monitoring** — query your DeepSeek account balance with one click; live available amount and account status
- **Dual-model usage stats** — track token consumption, cache hit rate, and spending for V4 Flash and V4 Pro separately
- **7-day trend charts** — visualize the last 7 days of token usage, broken down by cache hit / cache miss / output
- **Usage drill-down** — click a model card to see per-day token consumption and request counts
- **Auto refresh** — 1 min / 5 min / 30 min / 1 hour intervals
- **Launch at startup** — supported on Windows and macOS
- **System tray** — closes to tray instead of quitting, summon it anytime
- **One-click token sync** — built-in browser login window that captures your usage token automatically

## 📦 Installation

### Option 1: Download the installer (recommended)

Grab the latest installer from the [Releases page](https://github.com/guniang2/deepseek-monitor/releases) — no Node.js required.

### Option 2: Build from source

**Prerequisites:** [Node.js](https://nodejs.org/) ≥ 18 and npm (or yarn).

```bash
# Clone the repo
git clone https://github.com/guniang2/deepseek-monitor.git
cd deepseek-monitor

# Install dependencies
npm install

# Run in dev mode
npm start

# Or with dev tools
npm start -- --dev
```

### Packaging

```bash
# All platforms
npm run build

# Windows (NSIS installer)
npm run build:win

# macOS (DMG image)
npm run build:mac

# Linux (AppImage)
npm run build:linux
```

Build artifacts are output to `dist/`.

## 🧭 Getting Started

### First-time setup

1. Open the app and go to **Settings** (⚙ icon)
2. **API Key**: paste your DeepSeek API Key (starts with `sk-`), click "Verify & Save"
3. **Usage Token**:
   - **Option A (recommended)**: click "Sync via web login" — complete login in the popup window and the token is captured automatically
   - **Option B**: click "Paste token manually" — copy the Bearer token from your browser's dev tools

### Dashboard reference

| Area | Description |
|------|-------------|
| Account balance | Total balance and availability status |
| Today's spend | Accumulated spend for today |
| Month-to-date | Accumulated spend for the current month |
| V4 Flash / V4 Pro | Per-model monthly tokens, spend, and cache hit rate |
| 7-day trend | Token consumption bar chart; hover for daily details |

### Auto refresh

Enable "Auto refresh" in Settings and pick an interval — the app will keep balance and usage data up to date on schedule.

## 🏗 Project Structure

```
deepseek-monitor/
├── assets/                 # App icons
│   ├── icon.png
│   └── icon.ico
├── src/                    # Source code
│   ├── main.js             # Main process: window management, IPC, API requests, config storage
│   ├── preload.js          # Preload script: safely exposes main-process APIs to the renderer
│   └── index.html          # Renderer: full UI and interaction logic
├── package.json            # Project config & build scripts
└── README.md               # This file
```

## 🛠 Tech Stack

- **Electron** — cross-platform desktop app framework
- **Native HTTP/HTTPS** — talks to the DeepSeek API directly, zero extra HTTP client dependencies
- **Vanilla frontend** — no UI framework, pure HTML/CSS/JavaScript
- **electron-builder** — packaging & distribution

## 🔌 API Endpoints

The app uses the following official DeepSeek endpoints:

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /user/balance` | Account balance | API Key |
| `GET /models` | Available models | API Key |
| `GET /api/v0/usage/amount` | Usage statistics | Usage Token |
| `GET /api/v0/usage/cost` | Cost statistics | Usage Token |

## 🔐 Configuration Storage

Config (API key, usage token, auto-launch, etc.) is stored in `config.json` under your system's user data directory:

- **Windows**: `%APPDATA%/deepseek-monitor/config.json`
- **macOS**: `~/Library/Application Support/deepseek-monitor/config.json`
- **Linux**: `~/.config/deepseek-monitor/config.json`

> **Security note**: the API key and usage token are stored in plain text locally. Handle your machine accordingly.

## 📝 Notes

1. **Usage token expiry** — tokens captured via web login may expire; re-sync if usage queries fail
2. **Balance vs. usage** — balance queries use the API key; usage statistics use a separate usage token
3. **Windows auto-launch** — via registry key `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
4. **macOS auto-launch** — via `~/Library/LaunchAgents/com.deepseek.monitor.plist`

## 🤝 Contributing

Contributions are welcome! Feel free to open [issues](https://github.com/guniang2/deepseek-monitor/issues) or submit [pull requests](https://github.com/guniang2/deepseek-monitor/pulls). Before making changes, please:

1. Keep the UI consistent with the existing transparent, glassy dark style
2. Test your changes with `npm start`
3. For security-sensitive changes (token handling, IPC), explain the rationale in the PR description

## 📄 License

[MIT](LICENSE) © [guniang2](https://github.com/guniang2)

---

> This is an independent third-party open-source tool and is not affiliated with DeepSeek.
