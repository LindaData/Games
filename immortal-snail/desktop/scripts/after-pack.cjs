'use strict';
/**
 * electron-builder afterPack hook.
 *
 * 1. Flips Electron fuses on every platform (hardening for a shipped game):
 *    no ELECTRON_RUN_AS_NODE, no NODE_OPTIONS, no --inspect, app code only from app.asar,
 *    no extra file:// privileges. (Done here rather than with the `electronFuses` option
 *    because step 2 renames the Linux binary, and electron-builder would flip fuses after.)
 * 2. Linux: renames the Electron binary to immortal-snail-chess.bin and installs
 *    scripts/linux-launcher.sh as immortal-snail-chess, which decides whether --no-sandbox is
 *    needed (see the comments in that script and in steam/README.md).
 */
const fs = require('node:fs');
const path = require('node:path');

const LINUX_EXECUTABLE = 'immortal-snail-chess';

exports.default = async function afterPack(context) {
  const { packager, appOutDir, electronPlatformName } = context;

  const fuses = await packager.generateFuseConfig({
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
  });
  await packager.addElectronFuses(context, fuses);

  if (electronPlatformName === 'linux') {
    const exe = path.join(appOutDir, LINUX_EXECUTABLE);
    const bin = `${exe}.bin`;
    if (!fs.existsSync(exe)) throw new Error(`afterPack: ${exe} not found`);
    fs.renameSync(exe, bin);
    fs.copyFileSync(path.join(__dirname, 'linux-launcher.sh'), exe);
    fs.chmodSync(exe, 0o755);
    fs.chmodSync(bin, 0o755);
    console.log(`  • linux launcher installed  file=${path.relative(process.cwd(), exe)}`);
  }
};
