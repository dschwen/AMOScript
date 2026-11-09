/* jshint esversion: 6 */
'use strict';

// AMCAF 1.50beta4 Protracker pitch primitives. No clocks, PCM preprocessing or
// host effects. Keep inside one factory for future standalone VM embedding.
function createAmcafPitch() {
  // Original words at library file offsets $974c..$9bcb, in raw fine order
  // 0..7,-8..-1. Do not replace with equal-temperament approximations.
  const hex = [
    '0358032802fa02d002a60280025c023a021a01fc01e001c501ac0194017d016801530140012e011d010d00fe00f000e2',
    '00d600ca00be00b400aa00a00097008f0087007f007800710352032202f502cb02a2027d02590237021701f901dd01c2',
    '01a90191017b01650151013e012c011c010c00fd00ef00e100d500c900bd00b300a9009f0096008e0086007e00770071',
    '034c031c02f002c5029e027802550233021401f601da01bf01a6018e01780163014f013c012a011a010a00fb00ed00e0',
    '00d300c700bc00b100a7009e0095008d0085007d007600700346031702ea02c0029902740250022f021001f201d601bc',
    '01a3018b01750160014c013a01280118010800f900eb00de00d100c600bb00b000a6009d0094008c0084007d0076006f',
    '0340031102e502bb0294026f024c022b020c01ef01d301b901a001880172015e014a013801260116010600f700e900dc',
    '00d000c400b900af00a5009c0093008b0083007c0075006e033a030b02e002b6028f026b02480227020801eb01cf01b5',
    '019d01860170015b0148013501240114010400f500e800db00ce00c300b800ae00a4009b0092008a0082007b0074006d',
    '0334030602da02b1028b026602440223020401e701cc01b2019a0183016d01590145013301220112010200f400e600d9',
    '00cd00c100b700ac00a3009a009100890081007a0073006d032e030002d502ac02860262023f021f020101e401c901af',
    '01970180016b01560143013101200110010000f200e400d800cc00c000b500ab00a1009800900088008000790072006c',
    '038b0358032802fa02d002a60280025c023a021a01fc01e001c501ac0194017d016801530140012e011d010d00fe00f0',
    '00e200d600ca00be00b400aa00a00097008f0087007f007803840352032202f502cb02a3027c02590237021701f901dd',
    '01c201a90191017b01650151013e012c011c010c00fd00ee00e100d400c800bd00b300a9009f0096008e0086007e0077',
    '037e034c031c02f002c5029e027802550233021401f601da01bf01a6018e01780163014f013c012a011a010a00fb00ed',
    '00df00d300c700bc00b100a7009e0095008d0085007d007603770346031702ea02c0029902740250022f021001f201d6',
    '01bc01a3018b01750160014c013a01280118010800f900eb00de00d100c600bb00b000a6009d0094008c0084007d0076',
    '03710340031102e502bb0294026f024c022b020c01ee01d301b901a001880172015e014a013801260116010600f700e9',
    '00dc00d000c400b900af00a5009c0093008b0083007b0075036b033a030b02e002b6028f026b02480227020801eb01cf',
    '01b5019d01860170015b0148013501240114010400f500e800db00ce00c300b800ae00a4009b0092008a0082007b0074',
    '03640334030602da02b1028b026602440223020401e701cc01b2019a0183016d01590145013301220112010200f400e6',
    '00d900cd00c100b700ac00a3009a009100890081007a0073035e032e030002d502ac02860262023f021f020101e401c9',
    '01af01970180016b01560143013101200110010000f200e400d800cb00c000b500ab00a1009800900088008000790072'
  ].join('');
  const periods = Array.from({ length: 576 }, (_, i) => parseInt(hex.slice(i * 4, i * 4 + 4), 16));
  const sine = [0,24,49,74,97,120,141,161,180,197,212,224,235,244,250,253,
    255,253,250,244,235,224,212,197,180,161,141,120,97,74,49,24];
  function integer(value, min, max, name) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`AMCAF pitch: invalid ${name}`);
    return value;
  }
  function fine(value) { return integer(value, -8, 7, 'finetune') & 15; }
  function word(value) { return integer(value, 0, 65535, 'period'); }
  function read(index) {
    if (index < 0 || index >= periods.length) throw new Error('AMCAF pitch: period table address out of bounds');
    return periods[index];
  }
  function tune(period, finetune) {
    integer(period, 1, 4095, 'note');
    const start = fine(finetune) * 36;
    let i = 0;
    // DBF #36 performs 37 comparisons; a miss leaves index 37.
    while (i < 37 && period < read(i)) i++;
    return read(start + i);
  }
  function target(period, finetune) {
    integer(period, 1, 4095, 'note');
    const raw = fine(finetune), start = raw * 37;
    let i = 0;
    while (i < 37 && period < read(start + i)) i++;
    if (i === 37) i = 35;
    if ((raw & 8) && i) i--;
    return read(start + i);
  }
  function slide(period, parameter, down) {
    word(period); integer(parameter, 0, 255, 'slide');
    const value = (period + (down ? parameter : -parameter)) & 65535;
    const low = value & 4095;
    const result = down ? (low >= 856 ? (value & 61440) | 856 : value)
      : (low < 113 ? (value & 61440) | 113 : value);
    return Object.freeze({ period: result, output: result & 4095 });
  }
  function arpeggio(period, finetune, parameter, counter) {
    word(period); const start = fine(finetune) * 36;
    integer(parameter, 0, 255, 'arpeggio'); integer(counter, 0, 255, 'tick counter');
    const phase = counter % 3;
    if (!phase || !parameter) return period;
    const offset = phase === 1 ? parameter >> 4 : parameter & 15;
    // Native code reads the shifted entry before comparing the base entry.
    // A failed 37-entry search leaves the hardware period unchanged.
    for (let i = 0; i < 37; i++) {
      const output = read(start + i + offset);
      if (period >= read(start + i)) return output;
    }
    return null;
  }
  function vibrato(period, position, memory, parameter = 0) {
    word(period); integer(position, 0, 255, 'vibrato position');
    integer(memory, 0, 255, 'vibrato memory'); integer(parameter, 0, 255, 'vibrato parameter');
    if (parameter & 15) memory = (memory & 240) | (parameter & 15);
    if (parameter & 240) memory = (memory & 15) | (parameter & 240);
    const delta = (sine[(position >> 2) & 31] * (memory & 15)) >> 7;
    return Object.freeze({ output: (period + (position & 128 ? -delta : delta)) & 65535,
      position: (position + ((memory >> 2) & 60)) & 255, memory });
  }
  return Object.freeze({ tune, target, slide, arpeggio, vibrato });
}

if (typeof module === 'object' && module.exports) module.exports = createAmcafPitch;
else globalThis.AMOS_AMCAF_PITCH = createAmcafPitch;
