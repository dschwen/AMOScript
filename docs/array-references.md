# Array references for Interface

`Array` ($25c0) now returns a checked integer reference to a dimensioned AMOS
array. `Vdialog(channel,index)=Array(A$(0))` can pass that reference into a
prepared Interface channel. The original Sliders program now executes unchanged
through line 51, including all 101 list entries and its Array/Vdialog assignment.
Its next compile blocker is `Dialog Run`, at line 52. Full_Example also advances
to `Dialog Run`, at line 119; its earlier music/sample dependencies remain outside
the executed fixture.

## Evaluation and lifetime

The argument must be an array element expression. The native `FnArray` retains
the array header, then calls `Saut_D0Param`, which **evaluates** the subscript
expressions through `Fn_New_Evalue`. Their results do not select an element or
change the returned header. The implementation therefore:

1. Resolves the actual array and checks its rank before host callbacks.
2. Evaluates each subscript once, left to right, without applying element bounds.
3. Checks that the captured array owner and dimensions remain valid after each
   expression, then returns a stable reference for that array identity.

Missing arrays, wrong ranks and non-array arguments reject. A callback exception
publishes no reference; replacement of the captured owner or its geometry stops
before later callbacks. Ordinary element edits remain visible. Shared/global
arrays use their actual owner; locals remain valid in a suspended caller frame
and retire when that procedure returns. Fresh procedure invocations get different
references. Stop/Resume, dialogue close and Default retain surviving AMOS arrays.
There is no new re-Dim support.

References occupy a private per-program integer namespace `$1000..$fffc`, with
15,360 lifetime identities and no reuse after retirement. They are logical header
references, separate from bank bytes (allocated at `$10000` and above), bitmap
memory and Varptr regions. Peek/Poke/Bload/native machine code do not gain access
to native array headers or string pointers. An unregistered or retired reference
rejects when consumed. Separate program instances own independent registries.

Integer, string and float arrays, including multiple dimensions, can receive a
reference. The checked backing for future Interface AR/AS consumers accepts only
one-dimensional integer/string arrays with a word-sized upper bound. Float raw
words and general native header layouts remain gated. String values are
owned Latin-1 strings; numeric values retain their signed longword bits. The
Interface list renderer and its string-width/editing rules remain separate work.

## Inspection and regression demo

The host can inspect references without exposing mutable array objects:

```js
const ref = program.dialogVariable('number', 1, 0);
program.arrayReferenceInfo(ref); // frozen { handle, type, dimensions }
program.interfaceArraySize(ref);
program.interfaceArrayRead(ref, 99); // native AR
program.arrayReferenceValue(ref, 100); // logical inspector, includes final element
```

The host helpers do not execute Interface expressions. `InDim` stores the
inclusive AMOS upper bound in the header, while native `Dia_FASize` returns that
word unchanged and `Dia_FArray` rejects indices **greater than or equal to** it.
Consequently `Dim A$(100)` allocates 101 entries, native AS returns 100, and AR
allows only indices 0–99. The checked Interface backing preserves this source
behavior. `arrayReferenceValue` is a separate full-array inspector that can read
entry 100; it is not an expanded AR implementation.

These Interface backing helpers prepare checked AR/AS reads. Size of the null reference is zero, matching native AS;
reading through null, invalid indices, incompatible types or retired owners
fails before exposing a value.

The shared [Interface demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/interface-channels.html)
now includes the original Sliders Array assignment and all 101 independently
expected strings, live edits and dialogue-close ownership. Five Canvas/WebGL
inspector previews and 640,000 independent blank pixels cover the combined
channel fixtures. All visible inspector/list text is added by the harness;
Interface drawing, selectors and `Dialog Run/Box` are still unsupported.

Source evidence: `InDim`, `FnArray` and `Saut_D0Param` in
[official +ILib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BILib.s),
`Dia_FArray`, `Dia_FASize` and `Dia_List` in the same pinned revision's
[+Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s),
and [Reading arrays in the Interface manual](https://amospromanual.dev/09-03-advanced-control-panels.html).
The manual's first-item description is refined here by the actual header reads
in the native implementation. This is source-derived evidence, not an Amiga capture.
