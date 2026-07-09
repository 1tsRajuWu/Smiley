#!/usr/bin/env node
/**
 * Build MediaRemoteAdapter.framework for macOS (v0.7.6).
 * Requires cmake. Skips when framework already exists and sources unchanged.
 */
const { execFileSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST_DIR = path.join(ROOT, 'electron', 'mediaremote-adapter');
const FRAMEWORK_DEST = path.join(DEST_DIR, 'MediaRemoteAdapter.framework');
const SCRIPT_DEST = path.join(DEST_DIR, 'mediaremote-adapter.pl');
const LICENSE_DEST = path.join(DEST_DIR, 'mediaremote-adapter.LICENSE');
const HASH_FILE = path.join(DEST_DIR, '.build-hash');
const ADAPTER_TAG = 'v0.7.6';
const ADAPTER_REPO = 'https://github.com/ungive/mediaremote-adapter.git';
const BUILD_DIR = path.join(ROOT, '.cache', 'mediaremote-adapter-build');

function shaDir(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) process.exit(result.status || 1);
}

function ensureSource() {
  if (!fs.existsSync(path.join(BUILD_DIR, 'CMakeLists.txt'))) {
    fs.mkdirSync(path.dirname(BUILD_DIR), { recursive: true });
    if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    run('git', ['clone', '--depth', '1', '--branch', ADAPTER_TAG, ADAPTER_REPO, BUILD_DIR]);
  }
}

function main() {
  if (process.platform !== 'darwin') {
    console.log('[mediaremote-adapter] skip (not macOS)');
    return;
  }

  ensureSource();
  const sourceHash = shaDir([
    path.join(BUILD_DIR, 'CMakeLists.txt'),
    ...fs.readdirSync(path.join(BUILD_DIR, 'src', 'adapter')).map((f) => path.join(BUILD_DIR, 'src', 'adapter', f)),
  ]);

  if (
    fs.existsSync(FRAMEWORK_DEST)
    && fs.existsSync(SCRIPT_DEST)
    && fs.existsSync(HASH_FILE)
    && fs.readFileSync(HASH_FILE, 'utf8').trim() === sourceHash
  ) {
    console.log('[mediaremote-adapter] up to date');
    return;
  }

  const cmakeBuild = path.join(BUILD_DIR, 'cmake-build');
  fs.mkdirSync(cmakeBuild, { recursive: true });
  run('cmake', ['-S', BUILD_DIR, '-B', cmakeBuild]);
  run('cmake', ['--build', cmakeBuild]);

  const builtFramework = path.join(cmakeBuild, 'MediaRemoteAdapter.framework');
  if (!fs.existsSync(builtFramework)) {
    console.error('[mediaremote-adapter] build failed — framework missing');
    process.exit(1);
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });
  if (fs.existsSync(FRAMEWORK_DEST)) fs.rmSync(FRAMEWORK_DEST, { recursive: true, force: true });
  execFileSync('cp', ['-R', builtFramework, FRAMEWORK_DEST]);
  fs.copyFileSync(path.join(BUILD_DIR, 'bin', 'mediaremote-adapter.pl'), SCRIPT_DEST);
  fs.copyFileSync(path.join(BUILD_DIR, 'LICENSE'), LICENSE_DEST);
  fs.writeFileSync(HASH_FILE, sourceHash);
  console.log('[mediaremote-adapter] built → electron/mediaremote-adapter/');
}

main();
