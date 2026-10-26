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
  const fullscreenSource = fs.readFileSync(path.join(root, 'lib/amos/fullscreen.js'), 'utf8');
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
      `<nav><a href="${preview('index.html')}">Demo index (HTML Preview)</a> · <a href="index.html">Local index</a></nav>\n<h1>${escape(scenario.title)}</h1><p>${escape(scenario.description)}</p><p>Run the same scenario and assertions as the browser test suite. ${scenario.capturedFrames === false ? 'Inspect the data controls and byte results below.' : 'Select a captured frame to inspect it.'}</p><button id="run-demo" type="button">Run demo</button><span id="status" role="status" aria-live="polite">Ready</span><select id="frames" aria-label="Captured frame" hidden></select><label${scenario.capturedFrames === false ? ' hidden' : ''}>Zoom <select id="zoom"><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option><option value="8">8×</option></select></label><section id="frame-view"><div class="amos-fullscreen-toolbar"><button id="frame-fullscreen" hidden>Fullscreen</button><span id="frame-fullscreen-status" role="status"></span></div><div id="stage"></div></section><style>#stage canvas,#stage img{max-width:none;min-width:0}</style><pre id="results" aria-label="Test results"></pre>\n` +
      script(browserSource) + script(fullscreenSource) + script(`(${installDemo.toString()})(${config});`)));
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
  const games = ['wonderland-game.html', 'roller2-game.html'];
  const showcases = ['tunnel.html', 'tracker.html', 'roller2-music-vm.html', 'programs.html'];
  const featured = {
    'wonderland-game.html': { title: 'Dithell’s Wonderland', description: 'Play the original game with keyboard or Gamepad controls, fullscreen and optional sound. Switch between WebGL2 and Canvas presentation.' },
    'roller2-game.html': { title: 'Roller II', description: 'Play the original puzzle game with music, keyboard/Gamepad and fullscreen. Tested through level 2 and game over; a missing original image currently blocks post-game return.' },
    'tunnel.html': { title: 'Tunnel animation', description: 'Watch the original animated icons, pause or step frames, and choose an IFF background. The default uses a prepared blank background because the external assets were not supplied.' },
    'tracker.html': { title: 'Roller II MOD player', description: 'Listen to the original title music with Play, Pause/Resume and Stop controls.' },
    'roller2-music-vm.html': { title: 'Roller II end tunes', description: 'Play the original game-over and victory music, then run the original volume fade-out.' },
    'programs.html': { title: 'Interactive AMOS examples', description: 'Try compiled examples with graphics, image banks, moving objects, keyboard/mouse input and program switching.' }
  };
  const card = entry => `<article><h3>${escape((featured[entry.file] || entry).title)}</h3><p>${escape((featured[entry.file] || entry).description)}</p><a class="play" href="${preview(entry.file)}">${games.includes(entry.file) ? 'Play game' : 'Run demo'} (HTML Preview)</a><p class="secondary"><a href="${entry.file}">Open locally</a> · <a href="https://github.com/dschwen/AMOScript/blob/master/demos/${entry.file}">Source</a></p></article>`;
  const group = files => files.map(file => cards.find(entry => entry.file === file)).filter(Boolean).map(card).join('\n');
  const technical = cards.filter(entry => !games.includes(entry.file) && !showcases.includes(entry.file));
  outputs.set('index.html', page('Browser demos', `<style>.demo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,25rem),1fr));gap:1rem}.demo-grid article{margin:0}h3{margin-top:0}.play{display:inline-block;background:#07569c;color:white;padding:.65rem 1rem;text-decoration:none;border-radius:.25rem}.secondary{font-size:.9rem;margin-bottom:0}details{margin:2rem 0}summary{cursor:pointer;font-size:1.2rem;font-weight:600}section{margin:2rem 0}</style>
    <header><h1>AMOScript demos</h1><p>Play original AMOS games in your browser, or explore animation, music and interactive examples.</p><nav><a href="#games">Games</a> · <a href="#showcases">More to explore</a> · <a href="#technical-demos">Technical checks</a> · <a href="https://github.com/dschwen/AMOScript#quick-start">Project and quick start</a></nav></header>
    <section id="games"><h2>Play the games</h2><p>Start here. These demos run complete original programs; each page explains its tested paths and current limits. Enable sound and fullscreen through the page controls.</p><div class="demo-grid">${group(games)}</div></section>
    <section id="showcases"><h2>More to explore</h2><div class="demo-grid">${group(showcases)}</div></section>
    <details id="technical-demos"><summary>Compiler and runtime checks (${technical.length} demos)</summary><p>Individual commands, bounded game fixtures and rendering checks for development. Every browser test remains available here.</p><div class="demo-grid">${technical.map(card).join('\n')}</div></details>
    <footer><p>All pages embed scripts and prepared fixtures. Open locally after cloning or use HTML Preview to run from GitHub; no server, Node or asset downloads are needed. WebGL requires WebGL2. Browser writes are volatile unless a demo explicitly says otherwise.</p></footer>`));
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
