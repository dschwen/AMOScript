/* jshint esversion: 6 */
'use strict';

// Driver-clocked AMCAF playback. Times are fractional VBL fields, never rounded
// instruction counts or rAF timestamps. CIA latch values come from AMCAF R179.
function createAmcafPlayback(module, factories, options = {}) {
  const hz = options.vblHz == null ? 50 : options.vblHz, standard = options.standard || 'PAL';
  if (!Number.isFinite(hz) || hz <= 0 || !['PAL','NTSC'].includes(standard)) throw new Error('Invalid AMCAF clock profile');
  const rate = options.sampleRate == null ? 48000 : options.sampleRate;
  const player = factories.stream(module,factories,{...options,sampleRate:rate});
  const constant = standard === 'PAL' ? 1773447 : 1789773, frequency = standard === 'PAL' ? 709379 : 715909;
  let cia = options.cia !== false, playing = true, paused = false, rendering=false, pausePending=false;
  let origin = options.field == null ? 0 : options.field, rendered = origin, frames = 0;
  const validTime = value => { if (!Number.isFinite(value) || value < 0) throw new Error('Invalid AMCAF field clock'); return value; };
  validTime(origin);
  const interval = () => (Math.floor(constant/player.state.sequence.bpm)+1)/frequency*hz;
  const deadline = now => cia ? now+interval() : Math.floor(now)+1;
  let next = deadline(origin);
  function stop() { if (!playing) return; playing=false;next=null;player.stop(); }
  function renderUntil(now) {
    const target = Math.floor((now-origin)*rate/hz+1e-7), count=target-frames;
    if(count<0)throw new Error('AMCAF PCM clock moved backwards');
    frames=target;rendered=now;
    if(count){rendering=true;try{player.render(count);}finally{rendering=false;}}
    if(pausePending&&playing){pausePending=false;player.pause();}
  }
  function advance(now) {
    validTime(now);
    if(!playing||paused)return;
    if(now<rendered-1e-9)throw new Error('AMCAF clock moved backwards');
    if(now-rendered>hz*5)throw new Error('AMCAF clock catch-up exceeds five seconds');
    let count=0;
    try{
      while(playing&&!paused&&next<=now+1e-10){
        if(++count>250)throw new Error('AMCAF tick catch-up exceeds 250 ticks');
        const at=next;
        // Hardware reloads the current latch at underflow, before the ISR's
        // Fxx writes. A row tempo change therefore affects the following reload.
        const duration=cia?interval():1;
        renderUntil(at);if(!playing||paused)return;
        next=at+duration;player.tick();
      }
    }catch(error){try{stop();}catch(_){/* preserve initiating failure */}throw error;}
  }
  return Object.freeze({advance,stop,nextField:()=>next,
    setSpeed(value,now){
      if(!Number.isInteger(value)||value!==0&&(value<32||value>255))throw new Error('Pt Cia Speed requires 0 or 32..255');
      advance(now);if(!playing)return;
      const mode=value!==0;
      if(value)player.setTempo(value);
      if(paused){cia=mode;return;}
      if(mode!==cia){renderUntil(now);if(!playing)return;cia=mode;next=deadline(now);}
    },
    setVolume:value=>player.setVolume(value),
    pause(){if(!playing||paused)return;paused=true;next=null;if(rendering)pausePending=true;else player.pause();},
    resume(now){validTime(now);if(!playing||!paused)return;paused=false;player.resume();origin=rendered=now;frames=0;next=deadline(now);},
    get state(){return Object.freeze({playing,paused,cia,next,rendered,frames,position:player.state});}
  });
}

if(typeof module==='object'&&module.exports)module.exports=createAmcafPlayback;
else globalThis.AMOS_AMCAF_PLAYBACK=createAmcafPlayback;
