/**
 * Electron fuses — harden packaged builds (afterPack hook).
 * @see https://www.electronjs.org/docs/latest/tutorial/fuses
 */
const path = require('path');

module.exports = async function configureFuses(context) {
  let fuseModule;
  try {
    fuseModule = require('@electron/fuses');
  } catch {
    console.warn('[fuses] @electron/fuses not installed — skipping fuse configuration');
    return;
  }

  const { flipFuses, FuseVersion, FuseV1Options } = fuseModule;
  const ext = process.platform === 'darwin' ? '.app' : process.platform === 'win32' ? '.exe' : '';
  const basename = context.packager.appInfo.productFilename;

  let electronPath;
  if (process.platform === 'darwin') {
    electronPath = path.join(
      context.appOutDir,
      `${basename}.app`,
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Versions',
      'A',
      'Electron Framework',
    );
  } else if (process.platform === 'win32') {
    electronPath = path.join(context.appOutDir, `${basename}${ext}`);
  } else {
    electronPath = path.join(context.appOutDir, basename);
  }

  try {
    await flipFuses(electronPath, {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    });
    console.log('[fuses] Applied Electron hardening fuses');
  } catch (err) {
    console.warn('[fuses] Could not apply fuses:', err.message);
  }
};
