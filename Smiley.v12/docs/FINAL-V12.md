# Smiley v12 — final release line

**Raj (@1tsRaj / 1tsRajuWu)** — July 9, 2026

---

Smiley **v12** is the **last major desktop release**. The product line is **frozen**: only **bugfix** releases (`v12.0.x`) will ship from [`Smiley.v12/`](../).

## What this means

| Still happening | Not planned |
|-----------------|-------------|
| Critical bug fixes (GIF, presence, updater, signing) | New features or redesigns |
| Security patches when dependencies require them | v13 or another major version |
| Community forks under MIT | Active feature roadmap |

## Archived stacks

| Tree | Path | Status |
|------|------|--------|
| v12 (shipping) | `Smiley.v12/` | **Final** — patch only |
| v8 | `legacy/smiley-v8/` | Archived — do not ship |
| v7 | `legacy/electron-v7/` | Archived — reference only |

## For agents and contributors

1. All desktop work goes in **`Smiley.v12/`** only.
2. Read [`PLATFORM-UPGRADE.md`](../../PLATFORM-UPGRADE.md) — marked **frozen** as of v12.0.2.
3. Release tags: `v12.0.x` → `.github/workflows/release-v12.yml`.
4. Forks are welcome — see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Thank you

To everyone who used Smiley, reported bugs, and shared feedback — thank you. v12 is the rebuild I wanted to ship: stable tray/updater/music from v7, Tauri + Rust shell from v8, without the patch-line churn.

— **Raj**

[README](../README.md) · [V12 scope](V12-SCOPE.md) · [Repo FINAL note](../../docs/FINAL.md)
