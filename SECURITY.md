# Security Policy

## Reporting a Vulnerability

Please **do not open a public issue** for security vulnerabilities.

Instead, report privately via one of these channels:

- **GitHub Security Advisories** (preferred): go to the repository's *Security* tab → *Report a vulnerability*
- **Email**: `3446033927@qq.com`

Please include:

1. A description of the vulnerability and its impact
2. Steps to reproduce (minimal example)
3. Affected versions
4. Any suggested fix, if you have one

You'll receive a response as soon as possible. Please allow time for a fix before public disclosure.

## Scope

Things that matter most for this project:

- **Credential handling** — API keys and usage tokens are encrypted at rest via Electron `safeStorage` (OS keychain); on Linux without a keyring they fall back to plain text. Anything touching encryption/decryption (`src/main.js` `encryptSecret`/`decryptSecret`) deserves extra scrutiny
- **The token-capture flow** — the in-app login window that reads `Authorization` headers; a bug here could leak tokens
- **IPC boundary** — anything the renderer can trigger in the main process (`src/main.js` + `src/preload.js`)
- **Dependency supply chain** — dependencies are limited to Electron tooling; review updates carefully

## Out of Scope

- The DeepSeek API itself or the DeepSeek platform
- Issues caused by your own local configuration
- Social engineering of end users

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | ✅ (current)       |

Older versions are supported on a best-effort basis — upgrade to the latest release when possible.
