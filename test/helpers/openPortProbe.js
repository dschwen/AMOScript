/* jshint esversion: 6 */
'use strict';
module.exports = async function openPortProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const expected = require('../fixtures/open-port.json');
  return page.evaluate(async ({ sources, expected, portsSource }) => {
    if (globalThis.AMOS_PORT_CAPTURE_CLEANUP) globalThis.AMOS_PORT_CAPTURE_CLEANUP();
    const createPorts = new Function(`return (${portsSource});`)(), panel = document.createElement('section'); panel.id = 'port-captures';
    const title = document.createElement('h2'); title.textContent = 'Captured parallel-port output'; panel.append(title);
    const explanation = document.createElement('p'); explanation.textContent = 'Original printer programs, captured as raw bytes. Download the .prn files or inspect their hexadecimal bytes below. Printer control codes are preserved; no physical printer or PCL rendering is used.'; panel.append(explanation);
    const urls = [], lengths = []; let totalBytes = 0;
    const dispose = () => { for (const url of urls) URL.revokeObjectURL(url); urls.length = 0; panel.remove(); window.removeEventListener('pagehide', dispose); if (globalThis.AMOS_PORT_CAPTURE_CLEANUP === dispose) delete globalThis.AMOS_PORT_CAPTURE_CLEANUP; };
    globalThis.AMOS_PORT_CAPTURE_CLEANUP = dispose; window.addEventListener('pagehide', dispose);
    try {
      for (const [name, source] of Object.entries(sources)) {
        const module = { exports: {} }; new Function('module', source)(module); const ports = createPorts(), p = module.exports({ ports });
        try { p.tick(10000); if (!p.state.halted) throw Error(`${name}: did not finish`); } finally { p.closePorts(); p.stop(); }
        const jobs = ports.snapshot(); if (jobs.length !== 1 || !jobs[0].closed) throw Error(`${name}: capture not closed`);
        const bytes = Uint8Array.from(jobs[0].bytes, c => c.charCodeAt(0));
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== expected[name].sha256 || bytes.length !== expected[name].byteLength || btoa(jobs[0].bytes) !== expected[name].base64) throw Error(`${name}: independent printer bytes differ`);
        lengths.push(bytes.length); totalBytes += bytes.length;
        const article = document.createElement('article'), label = document.createElement('h3'); label.textContent = name; article.append(label);
        const link = document.createElement('a'); link.download = `${name}.prn`; link.dataset.portDownload = name;
        link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })); urls.push(link.href);
        link.textContent = `Download ${bytes.length} captured bytes`; article.append(link);
        const details = document.createElement('details'), summary = document.createElement('summary'), hex = document.createElement('pre'); summary.textContent = 'Inspect raw hexadecimal bytes';
        hex.textContent = Array.from({ length: Math.ceil(bytes.length / 16) }, (_, row) => `${(row * 16).toString(16).padStart(4, '0')}  ${Array.from(bytes.slice(row * 16, row * 16 + 16), value => value.toString(16).padStart(2, '0')).join(' ')}`).join('\n');
        details.append(summary, hex); article.append(details); panel.append(article);
      }
      (document.getElementById('stage') || document.body).append(panel);
      return { programs: lengths.length, lengths, totalBytes, downloads: urls.length, allClosed: true };
    } catch (error) { dispose(); throw error; }
  }, { sources: Object.fromEntries(Object.keys(expected).map(name => [name, new Transpiler(fs.readFileSync(path.join(__dirname, '../../examples/Introideen', name))).toModule()])), expected, portsSource: require('../../lib/amos/ports').createMemoryPorts.toString() });
};
