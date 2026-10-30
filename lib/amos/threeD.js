/* jshint esversion: 6 */
'use strict';

// Bounded AMOS 3D loader and portable indexed rasterizer. See docs/amos-3d.md.
// All dependencies are injected: this function is also embedded in factories.
function createThreeD({ read, display, integer, resolve = value => value }) {
  const models = new Map(), objects = new Map();
  let directory = '', height = 200;
  const camera = { position: [0, 0, 0], angles: [0, 0, 0] };
  function fail(message) { throw Error(`AMOS 3D: ${message}`); }
  function name(value) {
    if (typeof value !== 'string' || !/^[a-z0-9_-]{1,31}$/i.test(value)) fail('expected a bare object/template/surface name without extension');
    return value.toLowerCase();
  }
  function payload(filename) {
    const contents = read(filename);
    if (typeof contents !== 'string' || contents.length > 1048576 || /[^\x00-\xff]/.test(contents)) fail('files.read must return a synchronous byte string');
    const prefix = /^\(([1-9][0-9]{0,6})\)/.exec(contents);
    if (!prefix) fail(`invalid size header in ${filename}`);
    const length = Number(prefix[1]), start = prefix[0].length;
    if (length > contents.length - start) fail(`truncated payload in ${filename}`);
    const bytes = Uint8Array.from(contents.slice(start, start + length), c => c.charCodeAt(0));
    function range(at, count) { if (!Number.isInteger(at) || at < 0 || count < 0 || at + count > bytes.length) fail(`data bounds in ${filename}`); }
    const u16 = at => { range(at, 2); return bytes[at] * 256 + bytes[at + 1]; };
    const s16 = at => u16(at) << 16 >> 16;
    const u32 = at => { range(at, 4); return (bytes[at] * 16777216 + bytes[at + 1] * 65536 + bytes[at + 2] * 256 + bytes[at + 3]); };
    return { bytes, range, u16, s16, u32, tail: contents.slice(start + length) };
  }
  function template(filename) {
    const p = payload(filename), { bytes: b, u16, range } = p;
    range(0, 36);
    // The first profile is the supplied eight-vertex/six-quad P8 template.
    // Saved pointers are deliberately never dereferenced.
    if (p.tail || b[22] !== 8 || b[26] !== 6 || u16(18) !== 56) fail('unsupported template geometry');
    const facesAt = u16(34), headersAt = u16(28), lookupAt = u16(32);
    range(facesAt, 24); range(headersAt, 560); range(lookupAt, 64);
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const indices = Array.from(b.slice(facesAt + f * 4, facesAt + f * 4 + 4));
      if (indices.some(i => i >= 8) || new Set(indices).size !== 4) fail('invalid template face');
      const variant = b[lookupAt + (1 << f)];
      if (variant >= 56) fail('invalid template visibility lookup');
      const flags = b[headersAt + variant * 10 + 9];
      if (![1, 2, 7].includes(flags)) fail('unsupported template face colouring');
      faces.push({ indices, shade: flags === 7 ? 3 : flags });
    }
    return faces;
  }
  function surface(filename) {
    const p = payload(filename), { range, u16, u32 } = p;
    range(0, 38);
    const first = u16(12), strokes = u16(16), base = u32(18);
    if (p.tail || first !== 38 || strokes < first + 4) fail('unsupported surface header');
    range(strokes, 4);
    function point(pointer) {
      const index = (pointer - base) / 10;
      if (!Number.isInteger(index) || index < 1 || index > 100) fail('invalid surface point reference');
      return index;
    }
    const available = new Set([1, 2, 3, 4]), midpoints = [];
    let at = first;
    while (u32(at)) {
      if (at + 12 > strokes || midpoints.length >= 96) fail('invalid surface subdivisions');
      const dest = point(u32(at)), a = point(u32(at + 4)), b = point(u32(at + 8));
      if (available.has(dest) || !available.has(a) || !available.has(b)) fail('invalid surface subdivision order');
      midpoints.push([dest, a, b]); available.add(dest); at += 12;
    }
    if (at >= strokes) fail('surface subdivisions overlap strokes');
    const contours = []; let vertices = [];
    at = strokes;
    for (let count = 0; ; count++) {
      if (count > 512) fail('surface stroke limit exceeded');
      const pointer = u32(at), flags = u16(at + 4); at += 6;
      if (pointer) {
        const index = point(pointer);
        if (!available.has(index) || (flags !== 256 && flags !== 0)) fail('unsupported surface stroke');
        vertices.push(index);
        if (flags === 0) {
          if (vertices.length < 4 || vertices[0] !== vertices[vertices.length - 1]) fail('surface contour must be closed');
          contours.push(vertices); vertices = []; break;
        }
      } else {
        if (vertices.length < 4 || vertices[0] !== vertices[vertices.length - 1] || flags !== 256) fail('unsupported surface contour separator');
        contours.push(vertices); vertices = [];
      }
    }
    // The supported records finish with zero workspace, never executable data.
    if (p.bytes.slice(at).some(v => v !== 0)) fail('unsupported surface trailing data');
    return { midpoints, contours };
  }
  function load(value) {
    const key = name(value);
    if (models.has(key)) return;
    if (models.size >= 64) fail('object definition limit exceeded');
    const filename = resolve(directory + key + '.3DO'), assetDirectory = filename.slice(0, -key.length - 4);
    const p = payload(filename), { bytes: b, range, u16, s16, u32 } = p;
    range(0, 100);
    if (u32(0) !== 1 || b[32] < 1 || b[32] > 32) fail('unsupported object header');
    const blocksAt = u16(56), coloursAt = u16(58), verticesAt = u16(60), facesAt = u16(62), orderAt = u16(64), count = b[32];
    range(blocksAt, count * 46); range(coloursAt, count * 2); range(orderAt, count * 112);
    if (verticesAt >= facesAt || (facesAt - verticesAt) % 6 !== 0 || (facesAt - verticesAt) / 6 > 257) fail('invalid object vertex range');
    const vertices = [];
    for (let at = verticesAt; at < facesAt; at += 6) {
      const v = [s16(at), s16(at + 2), s16(at + 4)];
      if (v[0] === 30000) { if (at !== facesAt - 6 || v[1] || v[2]) fail('invalid vertex sentinel'); }
      else vertices.push(v);
    }
    if (s16(facesAt - 6) !== 30000 || vertices.length !== count * 8) fail('unsupported object vertex layout');
    const references = new Map(); let tail = p.tail;
    while (true) {
      const match = /^\(([024]),([0-9]{1,6}),([a-z0-9_-]{1,31})\)/i.exec(tail);
      if (!match) fail('invalid object reference list');
      tail = tail.slice(match[0].length);
      const kind = Number(match[1]), offset = Number(match[2]);
      if (!kind) { if (offset || match[3] !== 'end' || tail) fail('invalid object reference terminator'); break; }
      range(offset, 4);
      if (references.has(offset)) fail('duplicate object reference');
      references.set(offset, { kind, name: name(match[3]) });
    }
    const templates = new Map(), surfaces = new Map(), blocks = [];
    for (let i = 0; i < count; i++) {
      const at = blocksAt + i * 46, reference = references.get(at + 10);
      if (!reference || reference.kind !== 4 || u16(at + 16) !== i * 8 || u16(at + 22) !== i * 6) fail('unsupported object block layout');
      references.delete(at + 10);
      if (!templates.has(reference.name)) templates.set(reference.name, template(assetDirectory + reference.name + '.3DT'));
      const a = b[coloursAt + i * 2], c = b[coloursAt + i * 2 + 1];
      if (a > 3 || c > 3) fail('invalid object colour planes');
      const masks = [0, a ? 1 << (a - 1) : 0, c ? 1 << (c - 1) : 0]; masks[3] = masks[1] | masks[2];
      const faces = templates.get(reference.name).map((face, f) => {
        const record = facesAt + (i * 6 + f) * 16; range(record, 16);
        let detail = null;
        const ref = references.get(record);
        if (ref) {
          if (ref.kind !== 2) fail('invalid surface reference kind');
          references.delete(record);
          if (!surfaces.has(ref.name)) surfaces.set(ref.name, surface(assetDirectory + ref.name + '.3DS'));
          const anchors = [0, 1, 2, 3].map(j => u16(record + 4 + j * 2) / 32);
          if (anchors.some(v => !Number.isInteger(v) || !face.indices.includes(v)) || new Set(anchors).size !== 4) fail('unsupported surface anchors');
          detail = { ...surfaces.get(ref.name), anchors };
        } else if (u32(record)) fail('missing surface reference');
        return { indices: face.indices, colour: 8 | masks[face.shade], toggle: masks[1], detail };
      });
      blocks.push({ first: i * 8, faces });
    }
    if (references.size) fail('unsupported object reference target');
    // Commit only after every dependency and every checked reference succeeds.
    models.set(key, { vertices, blocks });
  }
  function instance(value, allowCamera = true) {
    const id = integer(value);
    if (id === 0 && allowCamera) return camera;
    if (id < 1 || id > 20 || !objects.has(id)) fail('object instance not defined');
    return objects.get(id);
  }
  function positions(values) {
    const result = values.map(integer);
    if (result.some(v => v < -8388607 || v > 8388607)) fail('position outside supported world range');
    return result;
  }
  function angles(values) { return values.map(v => integer(v) & 65535); }
  function object(id, value, x, y, z, a, b, c) {
    id = integer(id); const key = name(value), position = positions([x, y, z]), attitude = angles([a, b, c]);
    if (id < 1 || id > 20 || objects.has(id)) fail('object number must be unused and between 1 and 20');
    if (!models.has(key)) fail('object definition not loaded');
    objects.set(id, { name: key, position, angles: attitude });
  }
  function move(id, x, y, z) { const target = instance(id), next = positions([x, y, z]); target.position = next; }
  function moveRel(id, x, y, z) { const target = instance(id), delta = [x, y, z].map(integer); target.position = positions(target.position.map((v, i) => v + delta[i])); }
  function angle(id, a, b, c) { const target = instance(id); target.angles = angles([a, b, c]); }
  function angleRel(id, a, b, c) { const target = instance(id), delta = [a, b, c].map(integer); target.angles = angles(target.angles.map((v, i) => v + delta[i])); }
  function rotation(attitude) {
    const [a, b, c] = attitude.map(v => v * Math.PI / 32768), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    return [[cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc], [cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc], [-sb, sa * cb, ca * cb]];
  }
  const transform = (v, matrix) => matrix.map(row => row.reduce((s, n, i) => s + n * v[i], 0));
  function checkedScreen() {
    const s = display.screen();
    if (s.width !== 320 || s.height < height || s.colours < 16 || s.mode !== 0 || s.ham || s.dualPartner || s.dualOwner) fail('requires a nonlaced 320-wide indexed screen with at least 16 colours and sufficient height');
    return s;
  }
  function cls() { const s = checkedScreen(); for (let i = 0; i < height * 320; i++) s.pixels[i] &= ~15; display.invalidate(); }
  const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  function contains(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function redraw() {
    const screen = checkedScreen(), output = screen.pixels.slice(0, height * 320), cameraMatrix = rotation(camera.angles), inverse = cameraMatrix[0].map((_, i) => cameraMatrix.map(row => row[i]));
    const scene = Array.from(objects.values(), item => {
      const matrix = rotation(item.angles), model = models.get(item.name);
      const convert = v => transform(v.map((n, i) => n + item.position[i] - camera.position[i]), inverse);
      return { model, vertices: model.vertices.map(v => convert(transform(v, matrix))), depth: convert([0, 0, 0])[2] };
    }).sort((a, b) => b.depth - a.depth);
    // Object-centre ordering is retained. Within an object the portable profile
    // uses depth-tested triangles instead of the native precomputed BSP/blitter.
    for (const item of scene) {
      const depth = new Float64Array(output.length);
      for (const block of item.model.blocks) for (const face of block.faces) {
        const world = face.indices.map(i => item.vertices[block.first + i]);
        // Near-plane clipping precedes projection and bounds every raster walk.
        let clipped = [];
        for (let i = 0; i < world.length; i++) {
          const a = world[i], b = world[(i + 1) % world.length];
          if (a[2] >= 16) clipped.push(a);
          if ((a[2] >= 16) !== (b[2] >= 16)) { const t = (16 - a[2]) / (b[2] - a[2]); clipped.push(a.map((v, j) => v + t * (b[j] - v))); }
        }
        if (clipped.length < 3) continue;
        const project = v => [160 + 256 * v[0] / v[2], height / 2 - 256 * v[1] / v[2], 1 / v[2]];
        const polygon = clipped.map(project);
        let contours = [];
        if (face.detail) {
          // Native surfaces subdivide projected screen coordinates. Clipped
          // anchors require the separate native clipping path, still gated.
          if (world.some(v => v[2] < 16)) fail('near-clipped surface detail is not implemented');
          const points = new Map(face.detail.anchors.map((v, i) => [i + 1, project(item.vertices[block.first + v])]));
          for (const [dest, a, b] of face.detail.midpoints) points.set(dest, [0, 1].map(j => (points.get(a)[j] + points.get(b)[j]) / 2));
          contours = face.detail.contours.map(path => path.map(i => points.get(i)));
        }
        for (let i = 1; i + 1 < polygon.length; i++) {
          const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]], area = edge(a, b, c[0], c[1]);
          if (Math.abs(area) < 1e-10) continue;
          const left = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0]) - 0.5)), right = Math.min(319, Math.floor(Math.max(a[0], b[0], c[0]) - 0.5));
          const top = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1]) - 0.5)), bottom = Math.min(height - 1, Math.floor(Math.max(a[1], b[1], c[1]) - 0.5));
          for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
            const u = edge(b, c, x + 0.5, y + 0.5) / area, v = edge(c, a, x + 0.5, y + 0.5) / area, w = 1 - u - v;
            if (u < -1e-10 || v < -1e-10 || w < -1e-10) continue;
            const at = y * 320 + x, z = u * a[2] + v * b[2] + w * c[2];
            if ((screen.pixels[at] & 8) || z <= depth[at] + 1e-12) continue;
            depth[at] = z;
            let colour = face.colour;
            for (const contour of contours) if (contains(contour, x + 0.5, y + 0.5)) colour ^= face.toggle;
            output[at] = (output[at] & ~15) | colour;
          }
        }
      }
    }
    screen.pixels.set(output); display.invalidate();
  }
  return {
    dir(value) { if (typeof value !== 'string' || value.length > 68 || /[\x00-\x1f]/.test(value) || value.startsWith('/') || /(^|[:/])\.{1,2}(\/|$)/.test(value)) fail('unsupported object directory'); directory = value && !/[:/]$/.test(value) ? value + '/' : value; },
    load, object, move, moveRel, angle, angleRel, cls, redraw,
    screenHeight(value) { const next = integer(value); if (next < 1 || next > 256) fail('screen height must be 1..256'); height = next; },
    kill(id) { instance(id, false); objects.delete(integer(id)); },
    clearAll() { objects.clear(); models.clear(); },
    snapshot() { return { directory, height, definitions: Array.from(models.keys()), camera: { position: camera.position.slice(), angles: camera.angles.slice() }, objects: Array.from(objects, ([id, v]) => ({ id, name: v.name, position: v.position.slice(), angles: v.angles.slice() })) }; }
  };
}
if (typeof module === 'object' && module.exports) module.exports = createThreeD;
else globalThis.AMOS_THREE_D = createThreeD;
