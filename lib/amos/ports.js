/* jshint esversion: 6 */
'use strict';

// Explicit output-only parallel-device capture. No filesystem or printer API.
function createMemoryPorts() {
  const jobs = []; let active = null, total = 0;
  return {
    open(name, request) {
      if (typeof name !== 'string' || name.toLowerCase() !== 'par:') throw new Error(`Unsupported output port: ${name}`);
      if (active) throw new Error('Parallel output port is already open');
      if (jobs.length >= 256) throw new Error('Port capture exceeds 256 jobs');
      const job = { device: name, channel: request.channel, bytes: '', closed: false };
      jobs.push(job); active = job;
      return {
        write(bytes) {
          if (job.closed) throw new Error('Port handle is closed');
          if (typeof bytes !== 'string' || /[^\x00-\xff]/.test(bytes)) throw new Error('Port output must be a byte string');
          if (job.bytes.length + bytes.length > 1048576 || total + bytes.length > 8388608) throw new Error('Port capture size limit exceeded');
          job.bytes += bytes; total += bytes.length;
        },
        close() { if (job.closed) return; job.closed = true; if (active === job) active = null; }
      };
    },
    snapshot() { return jobs.map(job => Object.freeze({ ...job })); }
  };
}
if (typeof module === 'object' && module.exports) module.exports = { createMemoryPorts };
else globalThis.AMOS_PORTS = { createMemoryPorts };
