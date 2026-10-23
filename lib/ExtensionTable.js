/* jshint esversion: 6 */
'use strict';

// Original AMOSPro_Music.Lib slot/offsets. Only commands with implemented
// semantics belong here; tools/reference contains the larger diagnostic table.
module.exports = {
  1: {
    0x008a: { name: 'Sam Bank', method: 'samBank', args: ['number'] },
    0x009a: { name: 'Sam Loop On', method: 'samLoopOn', args: [] },
    0x00b4: { name: 'Sam Loop Off', method: 'samLoopOff', args: [] },
    0x00c6: { name: 'Sam Loop Off Voices', method: 'samLoopOff', args: ['number'] },
    0x00de: { name: 'Sam Play', method: 'samPlay', args: ['number'] },
    0x00ee: { name: 'Sam Play Voices', method: 'samPlayVoices', args: ['number', 'number'] },
    0x00f8: { name: 'Sam Play Frequency', method: 'samPlayVoices', args: ['number', 'number', 'number'] },
    0x01ca: { name: 'Led On', method: 'ledOn', args: [] },
    0x01d6: { name: 'Led Off', method: 'ledOff', args: [] },
    0x0246: { name: 'Sam Stop', method: 'samStop', args: [] },
    0x0256: { name: 'Sam Stop Voices', method: 'samStop', args: ['number'] }
  }
};
