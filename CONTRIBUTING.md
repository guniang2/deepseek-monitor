# Contributing to DeepSeek Monitor

First off, thank you for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to DeepSeek Monitor. These are just guidelines, not rules — use your best judgment and feel free to propose changes to this document.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
- [Security Notes](#security-notes)

## Code of Conduct

Be respectful, constructive, and inclusive. Harassment and discrimination of any kind will not be tolerated. This project is a volunteer effort — treat every contributor with the same courtesy you'd expect for yourself.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:

1. **Check the [issues](https://github.com/guniang2/deepseek-monitor/issues)** for existing reports — duplicates get closed quickly
2. **Try the latest release** — the bug may already be fixed
3. **Gather details** — include:
   - OS and version (e.g. Windows 11, macOS 14.5)
   - App version (from the Releases page)
   - What you did, what you expected, and what actually happened
   - Screenshots or a short screen recording if possible
   - Error messages from the DevTools console (`npm start -- --dev`) if available

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

> **Important**: never include your real API key or usage token in any issue. These are sensitive credentials — always redact them.

### Suggesting Features

Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md) and describe:

- The problem you're trying to solve (not just the solution you want)
- How the feature would fit the app's existing UI and workflows
- Any relevant screenshots or mockups

### Submitting Pull Requests

1. **Fork the repository** and create a branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Keep changes focused** — one PR per feature or fix. Large refactors are hard to review and rarely get merged.

3. **Test your changes**:

   ```bash
   npm install
   npm start          # launch the app
   npm start -- --dev # with DevTools
   ```

   Verify the dashboard, details page, and settings page all still work, including the auto-refresh flow.

4. **Follow the style guidelines** below.

5. **Open the PR** with a clear title and description. Reference the related issue (e.g. `Closes #12`).

## Development Setup

```bash
# Clone and install
git clone https://github.com/guniang2/deepseek-monitor.git
cd deepseek-monitor
npm install

# Run
npm start
```

Minimum: Node.js ≥ 18 and npm.

## Style Guidelines

### Code

- The project uses plain JavaScript (no TypeScript, no framework) — keep it that way
- Match the surrounding code's style and comment density
- No new runtime dependencies without a strong reason; the app deliberately ships zero runtime deps
- Comments in English where non-obvious

### UI

- Keep the frameless transparent, glassy dark aesthetic consistent
- New strings: the UI is currently Chinese-only. If you add new strings, keep the Chinese copy concise; a future i18n pass is planned
- Test at the minimum window size (360×580)

### Commits

- Use clear, concise commit messages in English
- Prefix with the type: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

## Security Notes

- **API keys and tokens** are stored in plain text in `config.json` under the user data directory — this is a deliberate trade-off for a local utility; do not weaken it further (e.g. no logging tokens, no sending them anywhere)
- Changes to token capture, IPC handlers, or any code that touches credentials deserve extra scrutiny — explain the rationale in the PR
- If you discover a security vulnerability, follow the [SECURITY.md](SECURITY.md) process — do **not** open a public issue
