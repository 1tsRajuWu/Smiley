#!/usr/bin/env node
/**
 * Patch native projects after `cap add` — SDK levels & display name.
 */
const fs = require('fs');
const path = require('path');

const MOBILE = path.join(__dirname, '..');
const ROOT = path.join(MOBILE, '..');

function appVersion() {
  return require(path.join(ROOT, 'package.json')).version;
}

function versionCodeFromSemver(version) {
  const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

function patchAndroid() {
  const varsPath = path.join(MOBILE, 'android', 'variables.gradle');
  if (!fs.existsSync(varsPath)) {
    console.log('android/ not found — run: npx cap add android');
    return;
  }
  let vars = fs.readFileSync(varsPath, 'utf8');
  vars = vars.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26');
  vars = vars.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 34');
  vars = vars.replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 34');
  fs.writeFileSync(varsPath, vars);
  console.log('Android: minSdk 26, compile/targetSdk 34');

  const gradlePath = path.join(MOBILE, 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradlePath)) {
    const version = appVersion();
    const versionCode = versionCodeFromSemver(version);
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
    gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
    fs.writeFileSync(gradlePath, gradle);
    console.log(`Android: versionName ${version}, versionCode ${versionCode}`);
  }
}

function patchIos() {
  const pbxPath = path.join(MOBILE, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  if (!fs.existsSync(pbxPath)) {
    console.log('ios/ not found — run: npx cap add ios');
    return;
  }
  const version = appVersion();
  const versionCode = versionCodeFromSemver(version);
  let pbx = fs.readFileSync(pbxPath, 'utf8');
  pbx = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 16.0;');
  pbx = pbx.replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${version};`);
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`);
  fs.writeFileSync(pbxPath, pbx);
  console.log(`iOS: deployment target 16.0, version ${version} (${versionCode})`);
}

patchAndroid();
patchIos();
