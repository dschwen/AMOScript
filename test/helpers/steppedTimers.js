/* jshint esversion: 6 */
'use strict';

// Run one cooperative callback at a time. Unlike draining tick(0), this stays
// under the caller's finite budget when a real program has a busy menu loop.
function createSteppedTimers(){
  let now=0,sequence=0;const tasks=new Map();
  return {now:()=>now,setTimeout(fn,delay=0){const id=++sequence;tasks.set(id,{fn,due:now+Math.max(0,delay)});return id;},
    clearTimeout:id=>tasks.delete(id),pending:()=>tasks.size,
    next(){const selected=Array.from(tasks).sort((a,b)=>a[1].due-b[1].due||a[0]-b[0])[0];if(!selected)return false;
      tasks.delete(selected[0]);now=selected[1].due;selected[1].fn();return true;}};
}
module.exports={createSteppedTimers};
