#!/usr/bin/env node
/**
 * Sync shared Smiley assets into mobile/www for Capacitor.
 * Run from repo root: npm run build:mobile:www
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WWW = path.resolve(__dirname, '../www');
const SRC = path.join(ROOT, 'src');

function copyFile(from, to) {
  if (!fs.existsSync(from)) {
    console.warn(`  skip (missing): ${path.relative(ROOT, from)}`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`  ✓ ${path.relative(ROOT, to)}`);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else copyFile(srcPath, destPath);
  }
}

console.log('Building mobile/www…');
copyFile(path.join(SRC, 'activities.js'), path.join(WWW, 'activities.js'));
copyFile(path.join(SRC, 'discord-images.js'), path.join(WWW, 'discord-images.js'));
copyDir(path.join(SRC, 'assets'), path.join(WWW, 'assets'));
copyFile(path.join(ROOT, 'build/icon-transparent.png'), path.join(WWW, 'assets/icon.png'));
copyFile(path.join(ROOT, 'build/icon-light.png'), path.join(WWW, 'assets/icon-light.png'));
copyFile(path.join(ROOT, 'build/icon-dark.png'), path.join(WWW, 'assets/icon-dark.png'));
copyFile(path.join(ROOT, 'build/icon-64.png'), path.join(WWW, 'assets/icon-64.png'));
copyFile(path.join(ROOT, 'build/icon-192.png'), path.join(WWW, 'assets/icon-192.png'));
copyFile(path.join(ROOT, 'build/icon-512.png'), path.join(WWW, 'assets/icon-512.png'));
console.log('Done.');
