/* jshint esversion: 6 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Transpiler = require('../lib/Transpiler');
const root = path.join(__dirname, '..');
const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const html = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function loadAssets(filename, prefix = '') {
  if (!filename) return {};
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8')), entries = manifest.files || manifest;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Asset manifest must map AMOS names to local paths');
  const assets = Object.create(null);
  for (const [name, entry] of Object.entries(entries)) {
    const relative = typeof entry === 'string' ? entry : entry && entry.path;
    if (typeof relative !== 'string') throw new Error(`Missing asset path: ${name}`);
    const bytes = fs.readFileSync(path.resolve(path.dirname(filename), relative)), key = (prefix + name).replace(/\\/g, '/').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(assets, key)) throw new Error(`Duplicate AMOS asset name: ${prefix + name}`);
    if (entry.byteLength != null && bytes.length !== entry.byteLength) throw new Error(`Asset length differs: ${name}`);
    if (entry.sha256 != null && crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Asset hash differs: ${name}`);
    assets[key] = bytes.toString('base64');
  }
  return assets;
}
function buildGamePage(source, { title = 'AMOS game', assets = {}, port = 1, fire = ['Space', 'Enter'], optimize = false, debug = false } = {}) {
  if (typeof debug !== 'boolean') throw new Error('debug must be a boolean');
  if (![0, 1].includes(port)) throw new Error('Joystick port must be 0 or 1');
  if (!Array.isArray(fire) || !fire.length || fire.some(code => typeof code !== 'string' || !code)) throw new Error('Fire keys must be nonempty keyboard codes');
  const fireLabel = [...new Set(fire.map(code => /^Control(?:Left|Right)$/.test(code) ? 'Ctrl' : /^Key[A-Z]$/.test(code) ? code.slice(3) : code))].join('/');
  const compiled = new Transpiler(source).toModule({ optimize });
  const scripts = ['browser', 'fullscreen', 'webAudio', 'browserAudio', 'files'].map(name => script(fs.readFileSync(path.join(root, 'lib/amos', `${name}.js`), 'utf8'))).join('\n');
  const model = require('../lib/display/model/frameState').createFrameStateModel;
  const sprites = require('../lib/display/reference/sprites').createSpriteModel;
  const resources = require('../lib/display/webgl/resources').createResourceFactory;
  const renderer = require('../lib/display/webgl/renderer').createRendererFactory;
  const shaders = require('../lib/display/webgl/shaders'), layout = require('../lib/display/presentation/layout');
  const runtime = `const create = (() => { const module = { exports: {} };\n${compiled}\nreturn module.exports; })();
const model = (${model})(); const sprites = (${sprites})();
const createRenderer = (${renderer})(model, sprites, (${resources})(model), (${shaders}), (${layout}));
(${require('./gamePageRuntime')})(create, JSON.parse(${json(JSON.stringify(assets))}), createRenderer, ${port}, ${json(fire)}, ${debug}, (${require('./gamePageUI')}));`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${html(title)}</title>
<style>body{font:16px system-ui,sans-serif;max-width:64rem;margin:1.5rem auto;padding:0 1rem;background:#101721;color:#eef2f6}button,select{font:inherit;padding:.6rem;margin:.3rem}button{cursor:pointer}#play-game{display:block;background:#c71920;color:white;border:0;border-radius:.6rem;padding:1.1rem 2.5rem;font-size:2rem;font-weight:800}canvas{display:block;image-rendering:pixelated;max-width:100%;border:1px solid #888}#game-status{font-size:.9rem}h1{font-size:1.5rem}summary{cursor:pointer}body[data-playing=true] #play-game{font-size:1rem;padding:.7rem 1.3rem}#game-surface{background:#05080c;border-radius:8px;overflow:hidden}</style></head><body>
<h1>${html(title)}</h1><button id="play-game" type="button">Play Game</button><details class="game-help"><summary>Controls</summary><p>Follow the game's intro and menu prompts. Arrows move; ${html(fireLabel)} fires. Escape leaves fullscreen.</p></details>
<section id="game-viewport"><div class="amos-fullscreen-toolbar"><button id="game-sound">Enable sound</button><button id="game-fullscreen">Fullscreen</button><span id="fullscreen-status" role="status"></span><button id="game-restart">Restart</button><button id="game-stop">Stop</button><button id="game-resume">Resume</button><select id="game-touch" aria-label="Touch joystick"><option value="auto">Touch: Auto</option><option value="always">Touch: On</option><option value="off">Touch: Off</option></select></div>
<div id="game-surface"><canvas id="game-input" width="320" height="256" tabindex="0" aria-label="Game display"></canvas></div><p id="game-status" class="amos-fullscreen-messages" role="status"></p></section>
${scripts}
${script(runtime)}
</body></html>\n`;
}
function main(args) {
  const positional = [], options = {};
  for (let i = 0; i < args.length; i++) {
    if (['--optimize', '--debug'].includes(args[i])) options[args[i].slice(2)] = true;
    else if (['--assets', '--prefix', '--port', '--title', '--fire'].includes(args[i])) {
      const name = args[i].slice(2); if (i + 1 === args.length || args[i + 1].startsWith('--')) throw new Error(`Missing value for --${name}`);
      options[name] = args[++i];
    } else if (args[i].startsWith('--')) throw new Error(`Unknown option: ${args[i]}`);
    else positional.push(args[i]);
  }
  if (positional.length !== 2) throw new Error('Usage: node tools/build_game_page.js input.AMOS output.html [--optimize] [--debug] [--assets manifest.json] [--prefix RII:] [--port 1] [--fire Enter,Space] [--title "My game"]');
  const [input, output] = positional;
  const page = buildGamePage(fs.readFileSync(input), { title: options.title || path.basename(input, path.extname(input)),
    assets: loadAssets(options.assets, options.prefix || ''), port: options.port == null ? 1 : Number(options.port), fire: options.fire == null ? ['Space', 'Enter'] : options.fire.split(','), optimize: !!options.optimize, debug: !!options.debug });
  fs.writeFileSync(output, page, { flag: 'wx' });
}
if (require.main === module) try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
module.exports = { buildGamePage, loadAssets };
