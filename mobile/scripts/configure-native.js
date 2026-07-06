#!/usr/bin/env node
/**
 * Patch native projects after `cap add` — SDK levels & display name.
 */
const fs = require('fs');
const path = require('path');

const MOBILE = path.join(__dirname, '..');

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
}

function patchIos() {
  const pbxPath = path.join(MOBILE, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  if (!fs.existsSync(pbxPath)) {
    console.log('ios/ not found — run: npx cap add ios');
    return;
  }
  let pbx = fs.readFileSync(pbxPath, 'utf8');
  pbx = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 16.0;');
  fs.writeFileSync(pbxPath, pbx);
  console.log('iOS: deployment target 16.0');
}

patchAndroid();
patchIos();
