/* jshint esversion: 6 */
'use strict';

// Source-derived finite Boom renderer. The beam word is a portable constant,
// not a claim to reproduce the native startup beam or audio interrupt tail.
function createBoom(options = {}) {
  const standard = options.standard || 'PAL', hz = options.vblHz == null ? 50 : options.vblHz;
  const clock = standard === 'PAL' ? 3546895 : 3579545, rate = 44100;
  const beam = options.beam == null ? 0x0101 : options.beam;
  let seed = options.seed == null ? 0 : options.seed;
  if (!['PAL','NTSC'].includes(standard) || !Number.isFinite(hz) || hz <= 0) throw new Error('Unsupported Boom timing');
  if (![seed,beam].every(n=>Number.isInteger(n)&&n>=0&&n<=65535)) throw new Error('Invalid Boom noise seed/beam word');
  if (options.fieldTime != null && typeof options.fieldTime !== 'function') throw new Error('Boom fieldTime must be synchronous');
  const wave = new Uint8Array(510);
  let initialized = false, pointer = 0, mask = 0, started = 0, lastField = 0;
  const volumes = [0];
  // EnvBoom {1,64,10,50,50,0,0,0}, EnvDVol=56. Signed DIVS truncates.
  let fixed = 0;
  for (const [steps,goal] of [[1,64],[10,50],[50,0]]) {
    const delta = Math.trunc((((56*goal)>>6)-(fixed>>16))*256/steps)*256;
    for (let i=0;i<steps;i++) { fixed += delta; volumes.push(fixed>>16); }
    fixed &= 0xffff0000;
  }
  function time() {
    const value = options.fieldTime ? options.fieldTime() : 0;
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER-64) throw new Error('Invalid Boom field clock');
    return value;
  }
  function word(value) { return (((value+beam)&65535)*0x3171>>>8)&65535; }
  function write(bytes,at,value) { bytes[at]=value>>>8;bytes[at+1]=value&255; }
  function initialize() {
    if (initialized) return;
    for(let at=0;at<510;at+=2){seed=word(seed);write(wave,at,seed);}
    initialized = true;
  }
  function advance(now = time()) {
    const field = Math.floor(now);
    if (field < lastField) throw new Error('Boom clock moved backwards');
    const changed = field>lastField ? mask : 0;
    const until = Math.min(field,started+61);
    if (mask) for(let next=lastField+1;next<=until;next++) {
      if(next-started===61){mask=0;break;}
      for(let i=0;i<8;i++){seed=word(seed);write(wave,pointer,seed);pointer=pointer===0?508:pointer-2;}
    }
    lastField = field;
    return {mask:changed,volume:volumes[Math.min(61,Math.max(0,field-started))]};
  }
  function cancel(bits) { mask &= ~(bits&15); }
  function begin(initialVolumes = [56,56,56,56]) {
    if(hz>1000)throw new Error('Unsupported Boom timing');
    const now=time();advance(now);initialize();
    const field=Math.floor(now), phase=now-field;
    const snapshots=[wave.slice()];let nextSeed=seed,nextPointer=pointer;
    // The slowest voice finishes its 510-byte initial fetch within about 24 PAL fields.
    // Build only the bounded future shared-noise states needed for these streams.
    // Shout notes 36..39 on voices 3..0; 2000*TNotes[note+2]/440.
    const frequencies=[1336,1259,1190,1122],periods=frequencies.map(f=>Math.max(124,Math.floor(clock/f)));
    const fieldCount=Math.ceil(phase+510/(clock/Math.max(...periods))*hz);
    for(let frame=1;frame<=fieldCount;frame++){
      const bytes=snapshots[frame-1].slice();
      for(let i=0;i<8;i++){nextSeed=word(nextSeed);write(bytes,nextPointer,nextSeed);nextPointer=nextPointer===0?508:nextPointer-2;}
      snapshots.push(bytes);
    }
    const events=[];
    for(let voice=3;voice>=0;voice--){
      const nativeRate=clock/periods[voice],length=Math.ceil(510/nativeRate*rate),data=new Float32Array(length);
      for(let at=0;at<length;at++){
        const frame=Math.floor(phase+at*hz/rate),index=Math.min(509,Math.floor(at*clock/(rate*periods[voice])));
        const value=(snapshots[frame][index]<<24)>>24,volume=frame===0?initialVolumes[voice]:volumes[frame];
        data[at]=value/128*volume/64;
      }
      events.push({type:'play',effect:'boom',mask:1<<voice,period:periods[voice],nativeRate,
        rate,volume:64,loopMask:0,sample:{bank:0,number:0,name:'Boom    ',frequency:rate,length,data,format:'float32'}});
    }
    mask=0;started=field;lastField=field;
    return events;
  }
  return {begin,advance,cancel,activate(bits){mask|=bits&15;},snapshot(synchronize = true){if(synchronize)advance();return {seed,pointer,mask,started,lastField,wave:wave.slice(),volumes:volumes.slice(),beam};}};
}
if (typeof module === 'object' && module.exports) module.exports = createBoom;
else globalThis.AMOS_BOOM = createBoom;
