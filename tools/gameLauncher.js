/* jshint esversion: 6 */
'use strict';
// Serialized with each full-game host. Activate both browser APIs in the click,
// then use ordinary input while the original startup runs on its own clock.
function createGameLauncher(options) {
  let timer = null, generation = 0, disposed = false;
  function cancel() {
    generation++;
    if (timer != null) clearTimeout(timer);
    timer = null; options.release();
  }
  function play() {
    if (disposed) return Promise.resolve();
    cancel(); options.prepare();
    const audio = options.sound.enable();
    const screen = options.fullscreen.status().active ? Promise.resolve(true) : options.fullscreen.toggle();
    options.focus();
    const token = generation, deadline = performance.now() + 15000;
    function advance() {
      timer = null; if (disposed || token !== generation) return;
      try {
        if (options.step() || performance.now() >= deadline) { options.release(); return; }
        timer = setTimeout(advance, 20);
      } catch (error) { cancel(); options.fail(error); }
    }
    timer = setTimeout(advance, 20);
    return Promise.allSettled([audio, screen]).then(() => { if (!disposed && token === generation) { options.focus(); options.update(); } });
  }
  return { play, cancel, dispose() { cancel(); disposed = true; } };
}
module.exports = createGameLauncher;
