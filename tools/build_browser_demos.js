/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const path = require('path');
const { scenarios } = require('../test/helpers/browserScenarios');
const { encodePng } = require('../test/helpers/displayPng');
const installDemo = require('./demoRuntime');
const Transpiler = require('../lib/Transpiler');
const root = path.join(__dirname, '..');
const preview = file => `https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/${file}`;
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
const json = value => value === undefined ? 'undefined' : JSON.stringify(value).replace(/</g, '\\u003c');
const css = `body{font:16px system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem;color:#17202a;background:#f5f6f8}a{color:#07569c}button,select{font:inherit;padding:.5rem;margin:.4rem .5rem .6rem 0}button{cursor:pointer}pre{padding:1rem;background:white;white-space:pre-wrap;overflow-wrap:anywhere;max-height:32rem;overflow:auto}#stage{overflow:auto;max-height:65vh}canvas,img{image-rendering:pixelated;max-width:100%;border:1px solid #b8c5cf}#stage img{min-width:128px}article{padding:1rem;background:white;margin:1rem 0;border:1px solid #dae2e8}#status{display:block;margin:1rem 0}body[data-status=failed] #status{color:#a00020}body[data-status=passed] #status{color:#126238}`;
const page = (title, body) => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · AMOScript</title><style>${css}</style></head><body>${body}</body></html>\n`;

async function buildBrowserDemos({ check = false, directory = root } = {}) {
  const outputs = new Map();
  const browserSource = fs.readFileSync(path.join(root, 'lib/amos/browser.js'), 'utf8');
  for (const scenario of scenarios) {
    const captured = [];
    // Node prepares exactly the inputs/factory sources used by Playwright.
    // Capturing evaluate does not create a browser or execute the scenario.
    await scenario.run({ evaluate(fn, argument) { captured.push({ source: fn.toString(), argument }); return Promise.resolve({}); } }, path.join(directory, 'test/artifacts'));
    if (captured.length !== 1) throw new Error(`Demo scenario ${scenario.id} must have one browser evaluator`);
    const checkSource = scenario.check.toString().replace(/^check\(/, 'function check(');
    const pngReference = scenario.id === 'webgl-integers'
      ? `data:image/png;base64,${encodePng(2, 2, Uint8Array.from([131,124,2,255,251,4,3,255,17,238,0,255,67,188,1,255])).toString('base64')}` : null;
    const config = `{evaluate:(${captured[0].source}),argument:${json(captured[0].argument)},check:(${checkSource}),pngReference:${json(pngReference)},initialFrame:${json(scenario.initialFrame || null)}}`;
    outputs.set(`${scenario.id}.html`, page(scenario.title,
      `<nav><a href="${preview('index.html')}">Demo index (HTML Preview)</a> · <a href="index.html">Local index</a></nav>\n<h1>${escape(scenario.title)}</h1><p>${escape(scenario.description)}</p><p>Run the same scenario and assertions as the browser test suite. ${scenario.capturedFrames === false ? 'Inspect the data controls and byte results below.' : 'Select a captured frame to inspect it.'}</p><button id="run-demo" type="button">Run demo</button><span id="status" role="status" aria-live="polite">Ready</span><select id="frames" aria-label="Captured frame" hidden></select><label${scenario.capturedFrames === false ? ' hidden' : ''}>Zoom <select id="zoom"><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option><option value="8">8×</option></select></label><div id="stage"></div><style>#stage canvas,#stage img{max-width:none;min-width:0}</style><pre id="results" aria-label="Test results"></pre>\n` +
      script(browserSource) + script(`(${installDemo.toString()})(${config});`)));
  }
  let interactive = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const programs = { 'examples/compiled-demo.js': 'Test21.AMOS', 'examples/compiled-graphics.js': 'Graphics.AMOS', 'examples/compiled-bobs.js': 'Bobs.AMOS' };
  interactive = interactive.replace(/<script src="([^"]+)"><\/script>/g, (_, filename) => script(programs[filename]
    ? new Transpiler(fs.readFileSync(path.join(directory, 'examples', programs[filename]))).toModule() + '\n'
    : fs.readFileSync(path.join(root, filename), 'utf8')));
  interactive = interactive.replace(/^[ \t]*<p data-demo-index>.*?<\/p>\r?\n/m, '');
  interactive = interactive.replace('<h1>AMOScript</h1>', `<nav><a href="${preview('index.html')}">Demo index (HTML Preview)</a> · <a href="index.html">Local index</a></nav><h1>Interactive AMOS programs</h1><p>Control flow, shapes/text, bank images, flipping/masks, buffered Bobs, collisions, keyboard/mouse input, program switching and Stop.</p>`);
  interactive = interactive.replace('  <pre id="output"', '  <pre id="input-state" aria-label="Live program and mouse state"></pre>\n  <pre id="output"');
  interactive = interactive.replace('</body>', script(`setInterval(() => { if (AMOS.state) document.getElementById('input-state').textContent = JSON.stringify({waiting:AMOS.state.waiting,stopped:AMOS.state.stopped,halted:AMOS.state.halted,mouse:AMOS.state.input.mouse},null,2); },100);`) + '</body>');
  outputs.set('programs.html', interactive);
  const cards = scenarios.map(scenario => ({ file: `${scenario.id}.html`, title: scenario.title, description: scenario.description }));
  cards.push({ file: 'programs.html', title: 'Interactive programs, input and lifecycle', description: 'Control flow, graphics, image banks, Bobs/collisions, keyboard/mouse, switching and Stop.' });
  outputs.set('index.html', page('Browser demos', `<h1>AMOScript browser demos</h1><p>Every browser test scenario is available below. Use HTML Preview to run directly from GitHub, or open the local HTML files after cloning. Pages embed their scripts and fixtures; they do not need a server, Node or asset downloads. WebGL demos require WebGL2.</p>\n` + cards.map(card => `<article><h2>${escape(card.title)}</h2><p>${escape(card.description)}</p><a href="${preview(card.file)}">Run with htmlpreview.github.io</a> · <a href="${card.file}">Open locally</a> · <a href="https://github.com/dschwen/AMOScript/blob/master/demos/${card.file}">HTML source</a></article>`).join('\n')));
  outputs.set('manifest.json', JSON.stringify({ version: 1, scenarios: cards.map(card => ({ ...card, preview: preview(card.file) })) }, null, 2) + '\n');
  const stale = [];
  if (!check) fs.mkdirSync(path.join(directory, 'demos'), { recursive: true });
  for (const [name, source] of outputs) {
    const filename = path.join(directory, 'demos', name);
    if (!check) fs.writeFileSync(filename, source);
    else {
      let existing; try { existing = fs.readFileSync(filename, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing !== source) stale.push(`demos/${name}`);
    }
  }
  return stale;
}

module.exports = { buildBrowserDemos };
