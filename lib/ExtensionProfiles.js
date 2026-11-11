/* jshint esversion: 6 */
'use strict';

// Only implemented commands belong here. Full recovered tables remain diagnostic.
const libraries = {
  'amcaf-1.50beta4': {
    0x1016:{name:'Turbo Draw',method:'extensionTurboDraw',args:Array(5).fill('number'),separators:[',','To',',',',']},
    0x1030:{name:'Turbo Draw',method:'extensionTurboDraw',args:Array(6).fill('number'),separators:[',','To',',',',',',']},
    0x0388:{name:'Turbo Plot',method:'extensionTurboPlot',args:Array(3).fill('number')},
    0x1042:{name:'Blitter Fill',method:'extensionBlitterFill',args:Array(2).fill('number')},
    0x1058:{name:'Blitter Fill',method:'extensionBlitterFillTo',args:Array(4).fill('number'),separators:[',','To',',']},
    0x1066:{name:'Blitter Fill',method:'extensionBlitterFill',args:Array(6).fill('number')},
    0x1078:{name:'Blitter Fill',method:'extensionBlitterFill',args:Array(8).fill('number'),separators:[...Array(5).fill(','),'To',',']},
    0x1258:{name:'Blitter Wait',method:'extensionBlitterWait',args:[]},
    0x15de: { name: 'Pt Cpattern', method: 'extensionPtCpattern', args: [], result: 'integer' },
    0x15f0: { name: 'Pt Cpos', method: 'extensionPtCpos', args: [], result: 'integer' },
    0x15fe: { name: 'Pt Cinstr', method: 'extensionPtCinstr', args: ['number'], result: 'integer' },
    0x160e: { name: 'Pt Cnote', method: 'extensionPtCnote', args: ['number'], result: 'integer' },
    0x10e6: { name: 'Pt Vu', method: 'extensionPtVu', args: ['number'], result: 'integer' },
    0x10b6: { name: 'Pt Signal', method: 'extensionPtSignal', args: [], result: 'integer' },
    0x10d6: { name: 'Pt Voice', method: 'extensionPtVoice', args: ['number'] },
    0x0456: { name: 'Wload', method: 'extensionWload', args: ['string','number'] },
    0x0472: { name: 'Wsave', method: 'extensionWsave', args: ['string','number'] },
    0x0480: { name: 'Dsave', method: 'extensionWsave', args: ['string','number'] },
    0x092e: { name: 'Lsl', method: 'extensionLsl', args: ['number','number'], result: 'integer' },
    0x093a: { name: 'Lsr', method: 'extensionLsr', args: ['number','number'], result: 'integer' },
    0x0eb8: { name: 'Lzstr$', method: 'extensionLzstr', args: ['number','number'], result: 'string' },
    0x0ec8: { name: 'Lsstr$', method: 'extensionLsstr', args: ['number','number'], result: 'string' },
    0x02f0: { name: 'Filename$', method: 'extensionFilename', args: ['string'], result: 'string' },
    0x03e0: { name: 'Path$', method: 'extensionPath', args: ['string'], result: 'string' },
    0x03ec: { name: 'Extpath$', method: 'extensionExtpath', args: ['string'], result: 'string' },
    0x0e8a: { name: 'Imploder Unpack', method: 'extensionImploderUnpack', args: ['number','number'], separators: ['To'] },
    0x04f8:{name:'Binexp',method:'extensionBinexp',args:['number'],result:'integer'},
    0x16a4:{name:'Itemstr$',method:'extensionItemString',args:['string','number'],result:'string',unverifiedOptionalArgs:['string']},
    0x16b6:{name:'Itemstr$',method:'extensionItemString',args:['string','number','string'],result:'string'},
    0x143c:{name:'Pt Sam Play',method:'extensionPtSamPlay',args:['number'],unverifiedOptionalArgs:['number','number']},
    0x1450:{name:'Pt Sam Play',method:'extensionPtSamPlay',args:['number','number']},
    0x145a:{name:'Pt Sam Play',method:'extensionPtSamPlay',args:['number','number','number']},
    0x1204:{name:'Change Bank Font',method:'extensionChangeBankFont',args:['number']},
    0x11a0:{name:'Change Print Font',method:'extensionChangePrintFont',args:['number']},
    0x11ee:{name:'Make Bank Font',method:'extensionMakeBankFont',args:['number']},
    0x059c:{name:'Change Font',method:'extensionChangeFont',args:['string'],unverifiedOptionalArgs:['number','number']},
    0x05b0:{name:'Change Font',method:'extensionChangeFont',args:['string','number']},
    0x05ba:{name:'Change Font',method:'extensionChangeFont',args:['string','number','number']},
    0x0ea2: { name: 'Imploder Load', method: 'extensionImploderLoad', args: ['string','number'] },
    0x1106: { name: 'Qsin', method: 'extensionQsin', args: ['number','number'], result: 'integer' },
    0x1114: { name: 'Qcos', method: 'extensionQcos', args: ['number','number'], result: 'integer' },
    0x1366: { name: 'Qsqr', method: 'extensionQsqr', args: ['number'], result: 'integer' },
    0x16c2: { name: 'Qarc', method: 'extensionQarc', args: ['number','number'], result: 'integer' },
    0x121c: { name: 'Blitter Clear', method: 'extensionBlitterClear', args: ['number','number'] },
    0x1234: { name: 'Blitter Clear', method: 'extensionBlitterClear', args: Array(6).fill('number'), separators: [',',',',',','To',','] },
    0x063a:{name:'Examine Dir',method:'extensionExamineDir',args:['string']},
    0x064c:{name:'Examine Next$',method:'extensionExamineNext',args:[],result:'string'},
    0x0660:{name:'Examine Stop',method:'extensionExamineStop',args:[]},
    0x0688:{name:'Object Type',method:'extensionObjectType',args:[],result:'integer'},
    0x06d8:{name:'Object Name$',method:'extensionObjectName',args:[],result:'string'},
    0x06f4:{name:'Object Date',method:'extensionObjectDate',args:[],result:'integer'},
    0x070e:{name:'Object Time',method:'extensionObjectTime',args:[],result:'integer'},
    0x0742:{name:'Object Protection',method:'extensionObjectProtection',args:[],result:'integer'},
    0x0762:{name:'Object Comment$',method:'extensionObjectComment',args:[],result:'string'},
    0x0728:{name:'Object Protection$',method:'extensionProtectionString',args:['number'],result:'string'},
    0x0f0a:{name:'Cd Date$',method:'extensionDateString',args:['number'],result:'string'},
    0x0f1a:{name:'Ct Time$',method:'extensionTimeString',args:['number'],result:'string'},
    0x0532:{name:'Io Error',method:'extensionIoError',args:[],result:'integer'},
    0x0522:{name:'Io Error$',method:'extensionIoErrorString',args:['number'],result:'string'},
    0x02d0:{name:'Disk Type',method:'extensionDiskType',args:['string'],result:'integer'},
    0x0300:{name:'Pattern Match',method:'extensionPatternMatch',args:['string','string'],result:'integer'},
    0x0672:{name:'Examine Object',method:'extensionExamineObject',args:['string']},
    0x06a2:{name:'Object Size',method:'extensionObjectSize',args:[],result:'integer'},
    0x06b4:{name:'Object Size',method:'extensionObjectSizeNamed',args:['string'],result:'integer'},
    0x1520:{name:'Bzoom',method:'extensionBzoom',args:Array(9).fill('number'),separators:[',',',',',',',','To',',',',',',']},
    0x08e0:{name:'Pjoy',method:'extensionPjoy',args:['number'],result:'integer'},
    0x15be:{name:'Xfire',method:'extensionXfire',args:['number','number'],result:'integer'},
    0x153c:{name:'X Smouse',method:'extensionXSmouse',args:[],result:'integer'},
    0x154a:{name:'Y Smouse',method:'extensionYSmouse',args:[],result:'integer'},
    0x1558:{name:'Smouse X',method:'extensionSmouseX',args:['number']},
    0x1568:{name:'Smouse Y',method:'extensionSmouseY',args:['number']},
    0x1578:{name:'Smouse Speed',method:'extensionSmouseSpeed',args:['number']},
    0x159c:{name:'Limit Smouse',method:'extensionLimitSmouse',args:[]},
    0x15b0:{name:'Limit Smouse',method:'extensionLimitSmouse',args:Array(4).fill('number'),separators:[',','To',',']},
    0x158c: { name: 'Smouse Key', method: 'extensionSmouseKey', args: [], result: 'integer' },
    0x0346: { name: 'Raster Wait', method: 'extensionRasterWait', args: ['number'], control: true },
    0x108e: { name: 'Pt Play', method: 'extensionPtPlay', args: ['number'] },
    0x10a8: { name: 'Pt Stop', method: 'extensionPtStop', args: [] },
    0x10c6: { name: 'Pt Volume', method: 'extensionPtVolume', args: ['number'] },
    0x10f2: { name: 'Pt Cia Speed', method: 'extensionPtCiaSpeed', args: ['number'] },
    0x1412: { name: 'Pt Raw Play', method: 'extensionPtRawPlay', args: Array(4).fill('number') },
    0x142a: { name: 'Pt Sam Bank', method: 'extensionPtSamBank', args: ['number'] },
    0x1400: { name: 'Pt Sam Stop', method: 'extensionPtSamStop', args: ['number'] },
    0x05d6: { name: 'Flush Libs', method: 'extensionFlushLibs', args: [] },
    0x0956: { name: 'Audio Lock', method: 'extensionAudioLock', args: [] },
    0x008a: { name: 'Bank Temporary', method: 'extensionBankTemporary', args: ['number'] },
    0x08c4: { name: 'Chr.w$', method: 'extensionChrWord', args: ['number'], result: 'string' },
    0x08d2: { name: 'Chr.l$', method: 'extensionChrLong', args: ['number'], result: 'string' },
    0x098c: { name: 'Asc.w', method: 'extensionAscWord', args: ['string'], result: 'integer' },
    0x0998: { name: 'Asc.l', method: 'extensionAscLong', args: ['string'], result: 'integer' },
    0x1632: { name: 'Vclip', method: 'extensionVclip', args: ['number', 'number', 'number'], separators: [',', 'To'], result: 'integer' },
    0x1642: { name: 'Vin', method: 'extensionVin', args: ['number', 'number', 'number'], separators: [',', 'To'], result: 'integer' },
    0x16d0: { name: 'Even', method: 'extensionEven', args: ['number'], result: 'integer' },
    0x16dc: { name: 'Odd', method: 'extensionOdd', args: ['number'], result: 'integer' }
  },
  'turbo-plus-2.15': {
    0x0928: { name: 'Amos Pri', method: 'extensionAmosPriority', args: ['number'] },
    0x036e: { name: 'F Plot', method: 'extensionFastPlot', args: Array(3).fill('number') },
    0x044c: { name: 'F Point', method: 'extensionFastPoint', args: Array(2).fill('number'), result: 'integer' },
    0x04fe: { name: 'Set Planes', method: 'extensionSetPlanes', args: ['number'] },
    0x0b86: { name: 'Word Hunt', method: 'extensionWordHunt', args: Array(5).fill('number'), separators: ['To', ',', ',', 'To'], result: 'integer' }
  }
};
for (const entries of Object.values(libraries)) {
  for (const entry of Object.values(entries)) {
    Object.freeze(entry.args);
    if(entry.unverifiedOptionalArgs)Object.freeze(entry.unverifiedOptionalArgs);
    if (entry.separators) Object.freeze(entry.separators);
    Object.freeze(entry);
  }
  Object.freeze(entries);
}
Object.freeze(libraries);

function normalize(extensions = {}) {
  if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) throw Error('extensions must be a slot-to-library object');
  const result = {};
  for (const [slot, library] of Object.entries(extensions)) {
    if (!/^[1-9][0-9]*$/.test(slot) || Number(slot) > 255) throw Error(`Invalid extension slot: ${slot}`);
    if (typeof library !== 'string' || !Object.hasOwn(libraries, library)) throw Error(`Unknown extension library: ${library}`);
    result[slot] = library;
  }
  return Object.freeze(result);
}

function parseMappings(values = []) {
  const result = {};
  for (const value of values) {
    const match = /^(\d+)=([^=]+)$/.exec(value);
    if (!match) throw Error('Expected extension mapping SLOT=LIBRARY');
    if (Object.hasOwn(result, match[1])) throw Error(`Duplicate extension slot: ${match[1]}`);
    result[match[1]] = match[2];
  }
  return normalize(result);
}

module.exports = { libraries, normalize, parseMappings };
