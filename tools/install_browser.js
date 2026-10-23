/* jshint esversion: 6 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
const result = spawnSync(process.execPath, [cli, 'install', 'chromium', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, '../.cache/ms-playwright') }
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status == null ? 1 : result.status;
