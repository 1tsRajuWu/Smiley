#!/usr/bin/env node
/**
 * Copy platform-native now-playing binary into electron/native/
 * so packaged builds always include it (not only node_modules optional deps).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const destDir = path.join(root, 'electron', 'native');

const pkgMap = {
  darwin: ['node-nowplaying-darwin-universal'],
  win32: ['node-nowplaying-win32-x64-msvc', 'node-nowplaying-win32-arm64-msvc'],
  linux: [
    'node-nowplaying-linux-x64-gnu',
    'node-nowplaying-linux-arm64-gnu',
    'node-nowplaying-linux-x64-musl',
    'node-nowplaying-linux-arm64-musl',
  ],
};

const packages = pkgMap[process.platform];
if (!packages) process.exit(0);

for (const pkgName of packages) {
  try {
    const pkgJson = require.resolve(`${pkgName}/package.json`);
    const srcDir = path.dirname(pkgJson);
    const nodeFile = fs.readdirSync(srcDir).find((f) => f.endsWith('.node'));
    if (!nodeFile) continue;

    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, nodeFile);
    fs.copyFileSync(path.join(srcDir, nodeFile), destPath);
    console.log(`[now-playing] bundled ${nodeFile} -> electron/native/`);
    process.exit(0);
  } catch (_) {}
}

console.warn('[now-playing] no native module for this platform (optional dependency missing)');
