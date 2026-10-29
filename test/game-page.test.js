/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const { binary, token: t, text } = require('./helpers/tokens');
const { buildGamePage, loadAssets } = require('../tools/build_game_page');

test('game page: CLI emits a complete standalone page with verified binary assets, escaped title and exclusive output creation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-game-page-'));
  try {
    const source = path.join(directory, 'game.AMOS'), output = path.join(directory, 'game.html'), manifest = path.join(directory, 'assets.json');
    const bytes = Buffer.from([0, 255, 13, 10, 128]); fs.writeFileSync(path.join(directory, 'file.bin'), bytes);
    fs.writeFileSync(source, binary([[t('Print'), text('Grüße')], [t('Wait Key')]]));
    fs.writeFileSync(manifest, JSON.stringify({ files: { 'FILE.BIN': { path: 'file.bin', byteLength: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') } } }));
    const args = [path.join(__dirname, '../tools/build_game_page.js'), source, output, '--assets', manifest, '--prefix', 'GAME:', '--title', '<My game>', '--fire', 'Enter', '--port', '0', '--slowdown', '2.5'];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' }); assert.strictEqual(result.status, 0, result.stderr);
    const page = fs.readFileSync(output, 'utf8'); assert.match(page, /<title>&lt;My game&gt;<\/title>/);
    assert.match(page, /<option value="2.5" selected>Speed: 40%<\/option>/);
    assert.match(page, /id="play-game"/); assert.match(page, /virtualJoystick/); assert.ok(page.includes(bytes.toString('base64')));
    assert.doesNotMatch(page, /<script[^>]+src=|<link[^>]+href=/i);
    for (const match of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
    assert.strictEqual(spawnSync(process.execPath, args).status, 1); assert.strictEqual(fs.readFileSync(output, 'utf8'), page);
    const assets = loadAssets(manifest, 'GAME:'); assert.strictEqual(assets['game:file.bin'], bytes.toString('base64'));
    fs.writeFileSync(path.join(directory, 'file.bin'), 'changed'); assert.throws(() => loadAssets(manifest), /length differs/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('game page: invalid ports, fire mapping and duplicate normalized asset names reject before a page is published', () => {
  const bytes = binary([[t('End')]]);
  for (const slowdown of [0, -1, Infinity, NaN, '2']) assert.throws(() => buildGamePage(bytes, { slowdown }), /slowdown/);
  assert.throws(() => buildGamePage(bytes, { port: 2 }), /port/); assert.throws(() => buildGamePage(bytes, { fire: [] }), /Fire keys/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-game-assets-'));
  try {
    fs.writeFileSync(path.join(directory, 'x'), 'x'); const manifest = path.join(directory, 'assets.json');
    fs.writeFileSync(manifest, '{"A":"x","a":"x"}'); assert.throws(() => loadAssets(manifest), /Duplicate/);
    fs.writeFileSync(manifest, '{"__proto__":"x"}'); const assets = loadAssets(manifest); assert.strictEqual(assets.__proto__, 'eA==');
    assert.ok(buildGamePage(bytes, { assets }).includes('JSON.parse('));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('game page: debug is an explicit boolean CLI/API option and the default page keeps diagnostics out of its markup', () => {
  const bytes = binary([[t('End')]]);
  assert.throws(() => buildGamePage(bytes, { debug: 'true' }), /boolean/);
  const normal = buildGamePage(bytes), debug = buildGamePage(bytes, { debug: true });
  assert.notStrictEqual(debug, normal);
  assert.ok(normal.includes("createRenderer, 1, [\"Space\",\"Enter\"], false,"));
  assert.ok(debug.includes("createRenderer, 1, [\"Space\",\"Enter\"], true,"));
  assert.match(normal, /<details class="game-help">/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-game-debug-'));
  try {
    const source = path.join(directory, 'game.AMOS'), output = path.join(directory, 'game.html'); fs.writeFileSync(source, bytes);
    const result = spawnSync(process.execPath, [path.join(__dirname, '../tools/build_game_page.js'), source, output, '--debug'], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr); assert.strictEqual(fs.readFileSync(output, 'utf8'), buildGamePage(bytes, { title: 'game', debug: true }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
