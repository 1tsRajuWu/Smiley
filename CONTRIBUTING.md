# Contributing

Smiley is **open source**. You're welcome to fork the repo, fix bugs, improve the UI, and open pull requests. Copyright © 2025–2026 **1tsRajuWu (Raj)** — see [LICENSE](LICENSE).

**Read first:** [docs/FINAL.md](docs/FINAL.md) — v7.0.0 final release notice and fork boundaries.

## Quick start (fork & build)

```bash
git clone https://github.com/YOUR_USER/Smiley.git
cd Smiley
cp discord.app.example.json discord.app.json
# Optional for install telemetry in your builds:
cp downloads.registry.example.json downloads.registry.json
npm install
npm start
```

For release builds, also configure GitHub Actions secrets (see [SECURITY.md](SECURITY.md)).

## Pull requests

PRs are welcome for:

- Bug fixes and crash fixes
- UI/UX improvements
- Documentation
- Build script and CI improvements
- Performance and accessibility

Please open an issue first for large changes so we can align on direction. Keep PRs focused; match existing code style.

## What is open

All of this is fair game to change and redistribute under the [LICENSE](LICENSE):

- Application source (`src/`, `electron/`, `main.js`, `preload.js`)
- UI, themes, and activity picker
- Electron packaging and build scripts
- Mobile companion (`mobile/`)
- Documentation and examples

## Off-limits — author's infrastructure

**Do not use, access, or point forks at the author's private services.** These are not part of the open-source grant:

| Resource | Why off-limits | What to use instead |
|----------|----------------|---------------------|
| **Smiley install database (Supabase)** | Contains real user install telemetry for official builds | Your own Supabase project; `downloads.registry.example.json` |
| **Live user / install telemetry data** | Privacy — aggregated stats belong to the operator | Your own DB, or disable tracking in your fork |
| **`discord.app.json` in official CI** | Author's Discord Application Client ID | Your Client ID from the [Discord Developer Portal](https://discord.com/developers/applications); `discord.app.example.json` |
| **`downloads.registry.json` in official CI** | Author's Supabase credentials | Your registry file + GitHub Actions secrets |
| **PayPal `paypal.me/1tsRaj`** | Author's personal donations | Your own `donationUrl` in `config.json` / `config.example.json` |

Never commit real credentials. Example files use placeholders only; gitignored files hold secrets locally and in CI.

## Local secrets (gitignored)

| File | Purpose |
|------|---------|
| `discord.app.json` | Discord Application Client ID |
| `downloads.registry.json` | Supabase URL + anon key for install heartbeats |
| `config.json` | Local dev overrides (donation URL, etc.) |
| `config.secure` | Encrypted user settings (runtime, on end-user devices) |

Templates: `discord.app.example.json`, `downloads.registry.example.json`, `config.example.json`.

## Bug reports & features

- **Bugs:** [GitHub Issues](https://github.com/1tsRajuWu/Smiley/issues/new?template=bug_report.md)
- **Security:** [SECURITY.md](SECURITY.md) — do not file public issues for exploits
- **Reviews:** [Leave a review](https://github.com/1tsRajuWu/Smiley/issues/new?template=review.md)

Major new features are unlikely on the official repo (see [docs/FINAL.md](docs/FINAL.md)), but forks are free to go anywhere.

## Related

- [docs/FINAL.md](docs/FINAL.md) — goodbye & fork instructions
- [LEGAL.md](LEGAL.md) — copyright, trademark, boundaries
- [SECURITY.md](SECURITY.md) — secrets in CI, reporting vulnerabilities
