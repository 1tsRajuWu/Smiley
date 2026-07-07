# Goodbye from Raj

**Raj (@1tsRaj / 1tsRajuWu)** — July 2026 · Smiley v7.7.7 (final shipped version)

---

Smiley started as a fun personal project — something I built because I wanted Discord Rich Presence with anime GIFs, and I kept polishing it until it felt *near perfect*. That journey was a blast.

**v7.0.0 was the final major release** (Aurora UI v3). **v7.7.7 is the final shipped version** — a last performance pass that cuts lag, CPU, and RAM use on low-end machines. After v7.7.7, I might ship patches or bug fixes if something breaks, but there are **no planned major features** and no big roadmap ahead. Consider this a warm goodbye — thank you for using it, starring the repo, reporting bugs, and sharing feedback over the years.

## Open source — with clear boundaries

The **application source code is open** for anyone to read, fork, modify, and contribute back via pull requests. You're welcome to build on Smiley, fix bugs, or adapt it for your own setup.

What stays **off-limits** is **my infrastructure** — not the code:

| Off-limits (author only) | Use your own |
|--------------------------|--------------|
| Smiley install database (Supabase) | Your Supabase project + `downloads.registry.json` |
| Live install telemetry & aggregated user stats | Your own tracking, or disable it in your fork |
| Bundled `discord.app.json` / CI Discord Application ID | Your Discord app from the [Developer Portal](https://discord.com/developers/applications) |
| PayPal donation link (`paypal.me/1tsRaj`) | Your own donation URL in `config.json` |

Forks and contributors must **not** point at my database, my Discord application, or my PayPal. Wire up your own secrets in local config and GitHub Actions — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## How to fork

1. **Fork** [github.com/1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley) on GitHub.
2. Copy example configs:
   ```bash
   cp discord.app.example.json discord.app.json
   cp downloads.registry.example.json downloads.registry.json   # optional — your Supabase
   cp config.example.json config.json                           # optional — local dev
   ```
3. Replace every placeholder with **your** Discord Client ID, Supabase URL/key, and donation URL.
4. Build and run — see [README.md](../README.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

Copyright © 2025–2026 **1tsRajuWu (Raj)** remains with the author. Forks should keep attribution; see [LICENSE](../LICENSE) and [LEGAL.md](../LEGAL.md).

## Thank you

To everyone who downloaded Smiley, left reviews, opened issues, or just had fun with it — thank you. This was a personal project done for the joy of building. I'm glad it helped some of you show off what you're up to on Discord.

Take care, and happy forking. 👋

— **Raj**

[README](../README.md) · [Contributing](../CONTRIBUTING.md) · [Legal](../LEGAL.md) · [Privacy](../PRIVACY.md)
