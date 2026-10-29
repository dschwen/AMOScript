/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { scenarios } = require('./helpers/browserScenarios');
const { buildBrowserDemos } = require('../tools/build_browser_demos');

test('browser demos: catalogue covers every shared scenario with self-contained HTML and preview links', () => {
  const root = path.join(__dirname, '../demos'), manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.deepStrictEqual(manifest.scenarios.map(scenario => scenario.file), [...scenarios.map(scenario => `${scenario.id}.html`), 'programs.html', 'roller2-game-debug.html', 'planet-zybex-game-debug.html']);
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(index.indexOf('id="games"') < index.indexOf('id="technical-demos"'));
  assert.match(index, /<details id="technical-demos"><summary>Compiler and runtime checks/);
  assert.doesNotMatch(index, /<details id="technical-demos"[^>]*\bopen\b/);
  for (const entry of manifest.scenarios) {
    assert.strictEqual(entry.preview, `https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/${entry.file}`);
    assert.ok(index.includes(entry.preview));
    const html = fs.readFileSync(path.join(root, entry.file), 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/i, `${entry.file} embeds dependencies`);
    if (['roller2-game.html', 'wonderland-game.html', 'planet-zybex-game.html'].includes(entry.file)) {
      assert.match(html, /<button id="play-game" type="button">Play Game<\/button>/);
      assert.ok(html.indexOf('id="play-game"') < html.indexOf('id="demo-checks"'));
      assert.match(html, /<details id="demo-checks"><summary>Browser checks and captured frames/);
      assert.doesNotMatch(html, /<details id="demo-checks"[^>]*\bopen\b/);
    }
    if (['anim5.html', 'screen-slide.html', 'bob-test.html'].includes(entry.file)) {
      assert.ok(html.indexOf('id="animation-player"') < html.indexOf('id="demo-checks"'));
      assert.match(html, /Play Animation/);
      assert.match(html, /<details id="demo-checks"><summary>Browser checks and captured frames/);
      assert.doesNotMatch(html, /<details id="demo-checks"[^>]*\bopen\b/);
    }
    if (entry.file === 'planet-zybex.html') {
      assert.ok(html.indexOf('id="planet-zybex-preview"') < html.indexOf('id="demo-checks"'));
      assert.doesNotMatch(html, /<button id="play-game"/);
      assert.doesNotMatch(html, /<details id="demo-checks"[^>]*\bopen\b/);
    }
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1], { filename: entry.file });
  }
});

test('browser demos: generated check reports missing/stale gallery pages without writes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-gallery-'));
  try {
    fs.mkdirSync(path.join(directory, 'examples'));
    for (const name of ['Test21.AMOS', 'Graphics.AMOS', 'Bobs.AMOS']) fs.copyFileSync(path.join(__dirname, '../examples', name), path.join(directory, 'examples', name));
    const missing = await buildBrowserDemos({ check: true, directory });
    assert.ok(missing.includes('demos/index.html') && missing.includes('demos/webgl-renderer.html'));
    assert.strictEqual(fs.existsSync(path.join(directory, 'demos')), false);
    await buildBrowserDemos({ directory });
    assert.deepStrictEqual(await buildBrowserDemos({ check: true, directory }), []);
    fs.writeFileSync(path.join(directory, 'demos/ham.html'), 'stale gallery');
    assert.deepStrictEqual(await buildBrowserDemos({ check: true, directory }), ['demos/ham.html']);
    assert.strictEqual(fs.readFileSync(path.join(directory, 'demos/ham.html'), 'utf8'), 'stale gallery');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
