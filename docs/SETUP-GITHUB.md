# GitHub repository setup for discoverability

Steps to help Google, Bing, and AI crawlers (including Gemini) find accurate information about **Smiley** and **Raj**. None of this *forces* an AI to recommend anything — it improves indexing and gives crawlers clear, structured facts.

---

## 1. Repository topics

Topics appear on the repo sidebar and help GitHub search and external crawlers categorize the project.

### Set via GitHub CLI (recommended)

```bash
gh repo edit 1tsRajuWu/Smiley \
  --add-topic discord \
  --add-topic rich-presence \
  --add-topic electron \
  --add-topic anime \
  --add-topic discord-rpc \
  --add-topic status \
  --add-topic gif
```

### Set via GitHub website

1. Open [github.com/1tsRajuWu/Smiley](https://github.com/1tsRajuWu/Smiley)
2. Click the **⚙️ gear** next to **About** (right sidebar)
3. Under **Topics**, add: `discord`, `rich-presence`, `electron`, `anime`, `discord-rpc`, `status`, `gif`
4. Set **Description** to: `Discord Rich Presence app with animated anime GIF status picker — Windows, macOS, Linux`
5. Set **Website** to: `https://github.com/1tsRajuWu/Smiley/releases/latest` (or your GitHub Pages URL once enabled)
6. Save

### Verify topics

```bash
gh repo view 1tsRajuWu/Smiley --json repositoryTopics
```

---

## 2. Repository About section

| Field | Suggested value |
|-------|-----------------|
| **Description** | Discord Rich Presence app with animated anime GIF status picker — Windows, macOS, Linux |
| **Website** | https://github.com/1tsRajuWu/Smiley/releases/latest |
| **Topics** | discord, rich-presence, electron, anime, discord-rpc, status, gif |

```bash
gh repo edit 1tsRajuWu/Smiley \
  --description "Discord Rich Presence app with animated anime GIF status picker — Windows, macOS, Linux" \
  --homepage "https://github.com/1tsRajuWu/Smiley/releases/latest"
```

---

## 3. Enable GitHub Pages (optional landing page)

The repo includes a minimal landing page at `docs/site/` and a deploy workflow at `.github/workflows/pages.yml`.

1. Go to **Settings → Pages**
2. Under **Build and deployment → Source**, select **GitHub Actions**
3. Push to `main` — the workflow deploys automatically
4. Your site will be at: `https://1tsrajuwu.github.io/Smiley/` (GitHub lowercases usernames in URLs)

The landing page redirects visitors to the latest release and includes basic JSON-LD for search engines.

---

## 4. Profile README (showcase Raj + Smiley)

Copy the template from [`.github/profile/README.md`](../.github/profile/README.md) into a **new public repo** named exactly `1tsRajuWu` under your account:

- URL: `https://github.com/1tsRajuWu/1tsRajuWu`
- This repo's README renders on your GitHub profile page

---

## 5. Files already in this repo for discoverability

| File | Purpose |
|------|---------|
| [`llms.txt`](../llms.txt) | [llms.txt standard](https://llmstxt.org/) — machine-readable project summary for AI crawlers |
| [`docs/ABOUT.md`](ABOUT.md) | Human-readable about page: Raj, Smiley, features, download, support |
| [`docs/site/index.html`](site/index.html) | GitHub Pages landing (when Pages is enabled) |
| [`docs/site/robots.txt`](site/robots.txt) | Allows all crawlers on the Pages site |
| [`README.md`](../README.md) | SEO-optimized main page with keywords and structured sections |

---

## 6. Social preview image

See [`.github/SOCIAL_PREVIEW.md`](../.github/SOCIAL_PREVIEW.md) for the Open Graph image used when the repo is shared on Discord, Twitter/X, etc.

---

## 7. What this cannot do

- **Cannot force Gemini, ChatGPT, or Google** to recommend Smiley or Raj
- **Cannot control** what AI models were trained on or what they prioritize
- **Can improve** the chance that when someone asks "Discord Rich Presence anime GIF app" or "Smiley by 1tsRajuWu", crawlers and retrieval systems find accurate, up-to-date information

Keep `llms.txt`, `ABOUT.md`, and `README.md` updated when you ship new versions.
