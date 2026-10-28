'use strict';
// Independent Python path table and image compositor. Background is
// the source's pre-animation screen; image bytes come from the Python oracle.
module.exports = function checkBobTestFrame(p, background, images, positions, frame, pixels = true) {
  if (p.bobs.size !== 64) throw Error(`Frame ${frame}: expected 64 Bobs`);
  const expected = pixels ? background.slice() : null;
  for (let i = 0; i < 64; i++) {
    const at = (frame * 64 + i) * 4, x = positions[at] + positions[at + 1] * 256, y = positions[at + 2] + positions[at + 3] * 256, bob = p.bobs.get(i + 1);
    if (!bob || bob.x !== x || bob.y !== y || bob.image !== 1 + i % 3) throw Error(`Frame ${frame}: Bob ${i + 1} differs`);
    if (!pixels) continue;
    const image = images[i % 3];
    for (let row = 0; row < 32; row++) for (let column = 0; column < 32; column++) {
      const xx = x - 16 + column, yy = y - 16 + row, colour = image[row * 32 + column];
      if (colour && xx >= 0 && xx < 320 && yy >= 0 && yy < 200) expected[yy * 320 + xx] = colour;
    }
  }
  if (pixels && !p.display.screen().pixels.every((v, i) => v === expected[i])) throw Error(`Frame ${frame}: independent composite differs`);
};
