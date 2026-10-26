/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=require('../lib/amos/musicBank'),create=require('../lib/amos/music'),expected=require('./fixtures/roller2/music.json').banks;
const bytes=name=>fs.readFileSync(path.join(__dirname,'../examples/Roller2/music',name)).subarray(20);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),traceHash=value=>hash(JSON.stringify(value));

test('AMOS Music reader: both original banks match independent instrument PCM/repeat/stored hashes, orders and table metadata with owned bytes',()=>{
  for(const bank of expected){const raw=bytes(bank.file),m=read(raw);assert.strictEqual(m.byteLength,bank.byteLength);assert.strictEqual(m.instruments.length,bank.instrumentCount);assert.strictEqual(m.patterns.length,bank.patternCount);assert.strictEqual(m.songs.length,1);assert.strictEqual(m.songs[0].name,bank.songName);assert.deepStrictEqual(m.songs[0].voices.map(v=>v.orders),bank.orders);assert.ok(m.songs[0].voices.every(v=>v.loop));
    for(const [i,reference]of bank.instruments.entries()){const instrument=m.instruments[i];for(const key of ['number','name','offset','repeatOffset','length','repeatLength','storedLength','volume'])assert.strictEqual(instrument[key],reference[key]);assert.strictEqual(hash(instrument.pcm),reference.pcmSha256);assert.strictEqual(hash(instrument.repeatPcm),reference.repeatSha256);assert.strictEqual(hash(instrument.storedPcm),reference.storedSha256);}
    const owned=Uint8Array.from(m.instruments[0].pcm);raw[owned.length>0?m.instruments[0].offset:0]^=255;assert.deepStrictEqual(m.instruments[0].pcm,owned);
  }
});

test('AMOS Music reader: malformed section/sample/song/pattern ranges and terminators reject without repairing or aliasing metadata',()=>{
  const original=bytes('Over.mus'),ib=original.readUInt32BE(0),sb=original.readUInt32BE(4),pb=original.readUInt32BE(8),song=sb+original.readUInt32BE(sb+2);
  for(const modify of [b=>b.writeUInt32BE(15,0),b=>b.writeUInt32BE(pb,4),b=>b.writeUInt32BE(b.length,8),b=>b.writeUInt16BE(0,ib),b=>b.writeUInt16BE(257,sb),b=>b.writeUInt32BE(0,ib+2),b=>b.writeUInt32BE(1,ib+6),b=>b.writeUInt16BE(0,ib+10),b=>b.writeUInt16BE(0xffff,ib+12),b=>b.writeUInt16BE(1,ib+16),b=>b.writeUInt32BE(0,sb+2),b=>b.writeUInt16BE(0,song),b=>b.writeUInt16BE(0x1234,song+28),b=>b.writeUInt16BE(0x1234,song+78),b=>b.writeUInt16BE(1,pb+2),b=>b.writeUInt16BE(0, b.length-2),b=>b.writeUInt16BE(0x8000,pb+original.readUInt16BE(pb+2))]){
    const raw=Buffer.from(original);modify(raw);assert.throws(()=>read(raw),/AMOS Music:/);
  }
  for(const end of [0,15,16,ib+1,sb+1,pb+1,original.length-1])assert.throws(()=>read(original.subarray(0,end)),/AMOS Music:/);assert.throws(()=>read([]),/expected byte/);assert.throws(()=>read(new DataView(new ArrayBuffer(16))),/expected byte/);
});

test('AMOS Music player: every original note and held period/volume field through the first wrap match independent PAL/NTSC hashes',()=>{
  for(const bank of expected)for(const standard of ['PAL','NTSC']){const notes=[],controls=[],events=[],p=create(read(bytes(bank.file)),{standard,host:{command(event){if(event.type==='play')notes.push([event.field,Math.log2(event.mask),event.sample.number,event.period,event.volume]);if(event.type==='voice')controls.push([event.field,Math.log2(event.mask),event.period||0,event.volume]);if(event.type==='stop')events.push(event.field);}}});const ref=bank.traces[standard];p.advance(ref.fields);assert.strictEqual(notes.length,ref.noteCount);assert.strictEqual(traceHash(notes),ref.notesSha256);assert.strictEqual(traceHash(controls),ref.controlsSha256);assert.deepStrictEqual(p.state.voices.map(v=>v.loops),[1,1,1,1]);assert.deepStrictEqual(notes.slice(0,12),ref.firstNotes);assert.deepStrictEqual(notes.slice(-8),ref.lastNotes);assert.deepStrictEqual(events,[0]);p.stop();p.tick();assert.deepStrictEqual(events,[0,ref.fields]);}
});

test('AMOS Music player: master gain uses clamped 63-scale and reaches hardware on non-step fields rather than replacing a playing sample',()=>{
  const events=[],p=create(read(bytes('Over.mus')),{host:{command:e=>events.push(e)}});p.advance(1);const first=events.find(e=>e.type==='play');assert.strictEqual(first.volume,0);assert.strictEqual(p.state.tempo,16);assert.strictEqual(p.state.counter,17);p.advance(2);assert.strictEqual(p.state.voices[0].hardwareVolume,55);const plays=events.filter(e=>e.type==='play').length;p.setVolume(63);assert.strictEqual(p.state.voices[0].volume,62);assert.strictEqual(p.state.voices[0].hardwareVolume,55);p.advance(3);assert.strictEqual(p.state.voices[0].hardwareVolume,62);p.setVolume(0);p.advance(4);assert.strictEqual(p.state.voices[0].hardwareVolume,0);assert.strictEqual(events.filter(e=>e.type==='play').length,plays);for(const value of [-1,64,0.5,NaN,Infinity])assert.throws(()=>p.setVolume(value),/volume/);assert.strictEqual(p.state.volume,0);p.stop();
});

test('AMOS Music player: Ywon slide-up, unsigned period clamps and PAL/NTSC tempo phase follow the source field schedule',()=>{
  const p=create(read(bytes('Ywon.mus')));p.advance(1);assert.strictEqual(p.state.voices[1].note,285);p.advance(2);assert.strictEqual(p.state.voices[1].note,197);p.advance(3);assert.strictEqual(p.state.voices[1].note,113);assert.strictEqual(p.state.voices[1].effect,0);p.stop();
  for(const [standard,next]of [['PAL',7],['NTSC',8]]){const events=[],q=create(read(bytes('Over.mus')),{standard,host:{command:e=>{if(e.type==='play'&&e.mask===2)events.push(e.field);}}});q.advance(next-1);assert.deepStrictEqual(events,[1]);q.advance(next);assert.deepStrictEqual(events,[1,next]);q.stop();}
});

test('AMOS Music player: unsupported commands/notes, invalid tempo/instrument/song, short fetches and zero-delay loops preflight before audio',()=>{
  const original=()=>read(bytes('Over.mus'));for(const mutate of [m=>{m.patterns[0][0].words[0]=0x8a12;},m=>{m.patterns[0][0].words[0]=0x4001;},m=>{m.patterns[0][0].words[0]=0x8800;},m=>{m.patterns[0][0].words[0]=0x89ff;},m=>{for(const s of m.patterns[0])if(s)for(let i=0;i<s.words.length;i++)if(s.words[i]>>8===0x89)s.words[i]=0x8300;},m=>{m.instruments[0].length=2;},m=>{for(const pattern of m.patterns)pattern[0]={words:Uint16Array.of(0x8000)};}]){const m=original(),events=[];mutate(m);assert.throws(()=>create(m,{host:{command:e=>events.push(e)}}),/AMOS Music/);assert.deepStrictEqual(events,[]);}
  assert.throws(()=>create(original(),{song:0}),/not defined/);assert.throws(()=>create(original(),{song:2}),/not defined/);assert.throws(()=>create(original(),{volume:64}),/volume/);assert.throws(()=>create(original(),{standard:'other'}),/standard/);assert.throws(()=>create(original(),{host:{}}),/synchronous/);
});

test('AMOS Music player: initial fetch and external repeats are owned independently; source edits, host failures and catch-up errors cannot leak another player',()=>{
  const m=read(bytes('Ywon.mus')),p=create(m),q=create(m);for(const [i,instrument]of m.instruments.entries()){const sample=p.samples[i];assert.strictEqual(sample.initialLength,instrument.length);assert.strictEqual(sample.length,instrument.length+instrument.repeatLength);assert.deepStrictEqual(sample.data.slice(0,instrument.length),instrument.pcm);assert.deepStrictEqual(sample.data.slice(instrument.length),instrument.repeatPcm);}
  const untouched=q.samples[0].data[0];p.samples[0].data[0]^=255;assert.strictEqual(q.samples[0].data[0],untouched);m.patterns[0][0].words.fill(0);m.instruments[0].pcm.fill(0);q.advance(1);assert.strictEqual(q.state.voices[0].note,190);p.stop();q.stop();
  const events=[],failing=create(read(bytes('Over.mus')),{host:{command(event){events.push(event.type);if(event.type==='play')throw Error('music host failed');}}});assert.throws(()=>failing.advance(1),/music host failed/);assert.strictEqual(failing.state.playing,false);assert.strictEqual(events[events.length-1],'stop');const count=events.length;failing.tick();assert.strictEqual(events.length,count);assert.throws(()=>create(read(bytes('Over.mus')),{host:{command(){return{then(){}};}}}),/synchronously/);
  const stable=create(read(bytes('Over.mus')));for(const field of [-1,NaN,100001])assert.throws(()=>stable.advance(field),/catch-up/);assert.strictEqual(stable.state.field,0);stable.stop();
});
