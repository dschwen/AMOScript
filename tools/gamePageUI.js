/* jshint esversion: 6 */
'use strict';
// Shared presentation for standalone pages and the gallery's full-game hosts.
// Debug exports copy byte strings; no filesystem, compiler or VM semantics change.
function installGamePageUI({ container, toolbar, files, debug = false }) {
  container.classList.add('amos-game-app');
  const style = document.createElement('style');
  style.textContent = `.amos-game-app .amos-fullscreen-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 0}.amos-game-app .amos-fullscreen-toolbar button,.amos-game-app .amos-fullscreen-toolbar select,.amos-game-app .game-debug button{font:inherit;border:1px solid #9daab8;border-radius:8px;margin:0;padding:10px;background:#eef2f6;color:#17202a;cursor:pointer;min-height:44px}.amos-game-app .amos-fullscreen-toolbar button:hover,.amos-game-app .game-debug button:hover{background:#dde5ee}.amos-game-app button:focus-visible,.amos-game-app a:focus-visible,.amos-game-app summary:focus-visible{outline:3px solid #e3323c;outline-offset:3px}.amos-game-app .game-icon{width:44px;height:44px;padding:10px;display:inline-flex;align-items:center;justify-content:center}.amos-game-app .game-icon svg{width:22px;height:22px;fill:currentColor}.amos-game-app canvas{display:block;margin:auto;max-width:100%;image-rendering:pixelated}.amos-game-app .game-debug{margin:12px 0;padding:12px;border:1px solid #9daab8;border-radius:8px;background:#f5f6f8;color:#17202a}.amos-game-app .game-debug summary{cursor:pointer;font-weight:600}.amos-game-app .game-debug pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto;font:13px/1.5 monospace;background:#fff;padding:12px}.amos-game-app .game-debug ul{padding-left:20px}.amos-game-app .game-debug a{color:#07569c}.amos-game-app .game-debug li{padding:6px;overflow-wrap:anywhere}`;
  container.append(style);
  const paths = { stop: 'M5 5h14v14H5z', resume: 'M6 3l15 9-15 9z', restart: 'M4 3v6h6L7.5 6.5A7 7 0 1 1 5 12H3a9 9 0 1 0 3-6.7z' };
  for (const [action, path] of Object.entries(paths)) {
    const button = toolbar.querySelector(`[id$="-${action}"]`); if (!button) continue;
    const label = action[0].toUpperCase() + action.slice(1);
    button.type = 'button'; button.classList.add('game-icon'); button.title = label; button.setAttribute('aria-label', label);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path'); shape.setAttribute('d', path); svg.append(shape); button.replaceChildren(svg);
  }
  let menu = null, log = null, list = null, refresh = null, disposed = false;
  const urls = new Set(), errors = [];
  const initial = debug && files ? files.snapshot() : null;
  function revoke() { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }
  function refreshFiles() {
    if (!menu || disposed) return;
    revoke(); list.replaceChildren();
    try {
      const current = files.snapshot();
      for (const name of Object.keys(current).sort()) {
        if (Object.prototype.hasOwnProperty.call(initial, name) && initial[name] === current[name]) continue;
        const bytes = current[name];
        if (typeof bytes !== 'string') throw new Error(`File is not a byte string: ${name}`);
        const payload = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) { const value = bytes.charCodeAt(i); if (value > 255) throw new Error(`File contains non-byte data: ${name}`); payload[i] = value; }
        const url = URL.createObjectURL(new Blob([payload], { type: 'application/octet-stream' })); urls.add(url);
        const item = document.createElement('li'), link = document.createElement('a');
        link.href = url; link.download = name.split(/[\\/:]/).pop().replace(/[\x00-\x1f\x7f]/g, '_') || 'download.bin';
        link.textContent = `${name} (${bytes.length} bytes)`; item.append(link); list.append(item);
      }
      if (!list.children.length) { const item = document.createElement('li'); item.textContent = 'No new or modified files.'; list.append(item); }
    } catch (error) { recordError(error); const item = document.createElement('li'); item.textContent = 'Could not prepare file downloads.'; list.append(item); }
  }
  function recordError(error) {
    if (!debug || disposed) return;
    errors.push(error && (error.stack || error.message) || String(error)); if (errors.length > 50) errors.shift();
    if (log) log.textContent = errors.join('\n\n');
  }
  if (debug) {
    menu = document.createElement('details'); menu.className = 'game-debug amos-fullscreen-messages'; menu.id = `${container.id}-debug`;
    const summary = document.createElement('summary'); summary.textContent = 'Debug';
    const heading = document.createElement('h3'); heading.textContent = 'Modified files';
    const help = document.createElement('p'); help.textContent = 'Download new or changed session files. Restart keeps them; reloading the page discards them. Refresh after the game saves.';
    refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Refresh files'; refresh.dataset.debugRefresh = '';
    list = document.createElement('ul'); list.dataset.debugFiles = '';
    const logHeading = document.createElement('h3'); logHeading.textContent = 'Runtime details and errors';
    log = document.createElement('pre'); log.dataset.debugLog = ''; log.textContent = 'No errors.';
    menu.append(summary, heading, help, refresh, list, logHeading, log); container.append(menu);
    refresh.addEventListener('click', refreshFiles); menu.addEventListener('toggle', refreshFiles); refreshFiles();
  }
  function update(details) { if (log && !disposed) log.textContent = JSON.stringify(details, null, 2) + (errors.length ? '\n\n' + errors.join('\n\n') : '\n\nNo errors.'); }
  function dispose() {
    if (disposed) return; disposed = true; revoke();
    if (menu) { refresh.removeEventListener('click', refreshFiles); menu.removeEventListener('toggle', refreshFiles); menu.remove(); }
    style.remove(); container.classList.remove('amos-game-app'); window.removeEventListener('pagehide', dispose);
  }
  window.addEventListener('pagehide', dispose);
  return { update, recordError, dispose };
}
module.exports = installGamePageUI;
