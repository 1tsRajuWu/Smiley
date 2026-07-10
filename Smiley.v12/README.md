# Smiley v12

**Smiley 12.0.10** — the **final** native desktop app (Tauri + Rust + TypeScript). Only bugfix releases (`12.0.x`) ship from this tree. See [`docs/FINAL-V12.md`](docs/FINAL-V12.md).

## Run locally

```bash
cd Smiley.v12
npm install
cp discord.app.example.json src-tauri/discord.app.json   # add your Discord Application Client ID
npm start
```

## Build

```bash
npm run desktop
```

See [`docs/NEWBIE-MAP.md`](docs/NEWBIE-MAP.md) for the full file tour and [`docs/V12-SCOPE.md`](docs/V12-SCOPE.md) for what ships vs what was cut from the v8 patch line.
