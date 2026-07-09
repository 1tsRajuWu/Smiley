/**
 * electron-builder afterSign: ad-hoc sign macOS .app for unsigned distribution.
 * Fixes invalid/partial signatures ("damaged and can't be opened").
 * Does NOT replace Apple notarization — users still need right-click → Open once
 * until we have a Developer ID cert (see docs/NOTARIZATION.md).
 */
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterSignMac(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  const entitlements = path.join(context.packager.projectDir, 'build/entitlements.mac.plist');
  const script = path.join(context.packager.projectDir, 'scripts/sign-mac-app.sh');

  execFileSync('bash', [script, appPath, entitlements], { stdio: 'inherit' });
};
