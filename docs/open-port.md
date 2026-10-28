# Open Port and parallel output capture

`Open Port channel,"par:"` ($18de) now compiles as an ordinary effectful channel
operation. All three supplied printer sources finish unchanged:

| Program | Captured bytes |
| --- | ---: |
| ASCIIPC.Bak | 2,409 |
| LetterQualityProcs.amos | 178 |
| LetterQualityProcs.Bak | 3,074 |

The [repository demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/open-port.html)
runs the originals, checks every byte and offers `.prn` downloads plus hexadecimal
inspection. These are raw device streams, not rendered pages or physical printer
output. Source escape commands, including apparent command-string typos, remain
unchanged. Original bytes/hashes are pinned in `test/fixtures/open-port.json`.

## Explicit adapter

Generated modules require an opt-in synchronous `ports` adapter. Device names
pass unchanged to this adapter, without Dir$ prefixing, filesystem reads or file
creation. Files and ports share channels 1–10; an occupied channel cannot be
reopened. Open Port is not an alias for Open Out.

```js
const { createMemoryPorts } = require('./lib/amos/ports');
const ports = createMemoryPorts();
const program = require('./compiled.js')({ setTimeout, clearTimeout, ports });
program.tick(10000);
for (const job of ports.snapshot()) {
  // Convert byte strings before writing binary downloads or files.
  const bytes = Uint8Array.from(job.bytes, character => character.charCodeAt(0));
  console.log(job.device, bytes.length, job.closed);
}
```

The adapter protocol is `ports.open(device, frozenRequest)` returning a handle
with `write(byteString)` and `close()` methods. The request contains `channel`.
All methods must finish synchronously; Promises/thenables reject. Core Open Port
retains the returned handle and checks it before installation. Same-channel
operations during open/write callbacks reject. Close consumes the channel before
calling the host, so failed or reentrant callbacks cannot replay the old close.
Close All snapshots channel identities and preserves replacements made by callbacks.

Print # sends bytes at the statement, rather than accumulating until Close.
Commas append TAB (9), semicolons append nothing, and an unsuppressed end appends
CR/LF (13,10). Length-based strings preserve NUL, escape and high bytes; Unicode
outside the byte range rejects before host output. Existing numeric/Print Using
formatting is shared; this slice does not claim full native floating formatting
or native 121-byte write-burst boundaries. A failing synchronous adapter may have
already emitted bytes; the VM does not retry, roll back or duplicate the write.

The supplied `createMemoryPorts()` adapter accepts case-insensitive **PAR:** only,
with one active output handle per adapter, separate records for reopened jobs and
owned immutable snapshot records. It rejects unsupported device names and caps
each job at 1 MiB, total retained bytes at 8 MiB and jobs at 256. Independent
adapters have independent state; sharing an adapter deliberately shares device
occupancy. Browser downloads use Uint8Array/Blob with owned URL revocation on
rerun and page exit.

Close explicitly releases a handle. End, Edit and execution failure close remaining
port handles once; cleanup errors do not replace an existing source error. Stop
keeps handles for Resume. Hosts discarding a paused VM call `program.closePorts()`
before replacing it; that terminal operation prevents future opens on that VM.
Serial/printer handlers, input, Port(), device readiness, OS printing, PCL
interpretation and physical-device timing remain unsupported. Disc-specific
Eof/Lof/Pof and input statements reject on these output-only channels.

## Procedure verifier gap

The current LetterQuality source contains an uncached integer identifier followed
by bracketed procedure arguments. At statement position this now becomes the
same procedure-call AST as the verified procedure token. The lowerer still checks
its declaration, parameter count/types and ordinary local procedure frame.
Typed identifiers and ordinary array/scalar assignments retain their grammar;
unknown procedures fail with source context. No source rewrite or special printer
procedure dispatch is used.

## Evidence

`tools/reference/open-port.py` independently transcribes the literal escape
commands, ASCII rows and procedure sequence into complete expected streams. It
imports no production compiler/runtime. Reproduce with:

```sh
python3 tools/reference/open-port.py
npm run build:demo
npm run check
npm run test:browser
```

Unit checks cover byte/separator fidelity, channel conflicts, output-only gates,
synchronous adapter failures, reentry, Stop/Resume, terminal cleanup and all three
complete sources. Browser checks verify all captures, download their exact bytes,
rerun without duplicate panels and check URL revocation/cleanup. This I/O-only
slice adds no rendering feature or GPU-parity claim.

Source contracts come from InOpenPort/OpIn and Cloa1 in pinned AMOS
[Lib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BLib.s),
and InPrintH/ssprint in
[ILib.s](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/%2BILib.s).
The [manual's Open Port section](https://amospromanual.dev/10-03-accessing-a-printer.html#open-port)
describes shared sequential commands and excludes disc-specific queries. Native
Open Port permits wider read/write devices; the implemented adapter is explicitly
bounded to captured parallel output. No Amiga or printer capture is claimed.
