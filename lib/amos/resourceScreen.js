/* jshint esversion: 6 */
'use strict';

// Resource graphics table: word image count, count relative longs, then
// colours/mode and 32 palette words. Screen Open skips the image payloads.
function readResourceScreen(input=null) {
  /* Default resource metadata notice:
   * MIT License
   * Copyright (c) 1992 Europress Software
   * Copyright (c) 2020 Francois Lionet
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   */
  const fail=message=>{throw Error('Resource screen: '+message);};
  // Screen metadata from the pinned AMOSPro_Default_Resource.Abk. Full system
  // graphics/messages/programs are separate from this screen-only reader.
  const system=()=>({colours:8,control:0xb200,mode:0x8000,source:'system',palette:[0,242,119,4095,3840,221,170,4083,1365,819,1843,883,1907,823,1847,887,0,3784,3168,3744,639,1181,1454,2783,3039,3311,4095,1032,2574,3598,3592,3822]});
  if(input==null)return system();
  if(!ArrayBuffer.isView(input)||Object.prototype.toString.call(input)!=='[object Uint8Array]'||input.length>1048576)fail('expected bounded Resource bank bytes');
  const bytes=Uint8Array.from(input),view=new DataView(bytes.buffer);
  const need=(at,size)=>{if(!Number.isInteger(at)||at<0||at%2||at+size>bytes.length)fail('truncated or unaligned resource table');};
  const word=at=>{need(at,2);return view.getUint16(at,false);};
  const sections=word(0);if(!sections)return system();
  const headerEnd=2+Math.min(sections,3)*4;need(0,headerEnd);
  const graphics=view.getUint32(2,false);if(!graphics)return system();
  if(graphics<headerEnd)fail('graphics pointer overlaps resource header');
  const count=word(graphics);if(count>4096)fail('unsupported image table size');
  const metadata=graphics+2+count*4;need(metadata,68);
  const colours=word(metadata),control=word(metadata+2),mode=control&0x8004;
  if(![2,4,8,16,32,64,4096].includes(colours))fail('invalid colour count');
  const palette=Array.from({length:32},(_,i)=>word(metadata+4+i*2)&0xfff);
  return {colours,control,mode,palette,source:'bank'};
}
if(typeof module==='object'&&module.exports)module.exports=readResourceScreen;
else globalThis.AMOS_RESOURCE_SCREEN=readResourceScreen;
