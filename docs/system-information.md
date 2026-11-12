# Portable system information and startup commands

Programs sometimes inspect the Amiga Exec library version with
`Deek(Leek(4)+20)`. Ordinary AMOScript execution rejects those addresses. A host
may now explicitly provide a version for compatibility checks:

```js
const program = create({
  setTimeout, clearTimeout,
  systemInfo: { execVersion: 40 }
});
```

This is declared portable metadata, not a running Amiga OS. No version is
assumed by default. The only supported field is an integer `execVersion` in
0..65535. It is copied into per-factory bytes when the program is created;
subsequent changes to the input object do not alter those bytes.

The shared checked-memory resolver exposes two read-only islands:

| Address range, end exclusive | Contents |
|---|---|
| 4..8 | Big-endian virtual ExecBase pointer `$00002000` |
| `$2014..$2016` | Big-endian `Library.lib_Version` word |

The virtual ExecBase address is below the bank allocation range, not an actual
host pointer. The rest of the Exec structure is absent. Reads crossing an island
boundary reject; adjacent bytes do not become zero-filled RAM. The existing bank,
display and variable regions retain their bounds and ownership rules.

Peek/Deek/Leek and checked bulk readers share the same bytes. Poke/Doke/Loke,
Bload, Fill and Copy destinations cannot mutate the islands; complete operations
preflight before writing. A valid Copy source may copy the information into a
normal bank. The low-number bank/address convention in Bload is unchanged.

For custom page builders, `buildGamePage(source, {systemInfo:{execVersion:40}})`
validates and embeds this setting, passing it to each fresh/restarted/linked VM.
The desktop form exposes this as **Advanced → AmigaOS compatibility**, saved
as `options.systemInfo` in project files. The project CLI uses the same setting;
the direct page-builder CLI has no system-information flag. See the
[desktop guide](desktop-builder.md#extension-slots-and-amigaos-compatibility) and
[planned automatic diagnostics](amigaos-memory-diagnostics-plan.md).

## Startup commands

The existing optional synchronous `system.command(name)` adapter now also receives:

| Command | Encoding | Logical effect after successful notification |
|---|---|---|
| Request Off | Official slot 3, `$0016` | `state.system.requesterTarget = 'off'` |
| Amos To Front | Core `$24aa` | `state.system.amosFront = true`, without changing lock state |
| Flush Libs | AMCAF `$05d6` | Increment `state.system.libraryFlushRequests` |
| Audio Lock | AMCAF `$0956` | `state.system.audioLocked = true` |

AMCAF requires the explicit compile-time library/slot mapping. Other official
slot defaults remain as described in [extension profiles](extension-profiles.md).
Absent an adapter, these record portable intent. There is no native requester,
library cache or audio.device reservation in the JavaScript runtime. Audio Lock
does not allocate browser audio resources, grant permission, reserve another VM's
voices or bypass gesture activation; actual sound remains owned by the existing
audio session. Stop retains final logical diagnostics and cleans up playback
through the ordinary audio lifecycle.

Invalid adapters, thrown errors and promise results halt with source context.
These new state fields are committed only after successful synchronous commands;
programs that do not use them keep their previous default system-state shape.

## Evidence and limits

Synthetic standalone-module tests check both sides of Ghostlight's version-36
comparison, boundary/cross-boundary reads, all shared write paths, factory
isolation, byte order, host errors and page option validation. The browser
[system-information demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/system-information.html)
uses the same evaluator as its browser test and contains no Ghostlight assets.

A local, hash-checked fixture retains original Ghostlight line 34's PREPARE call
and procedure lines 1986–2005, omits other source lines and adds an End guard
before INIT. It completes for explicitly supplied versions 34 and 40, exercising
the original old-version Break Off branch and Close Workbench/Flush Libs/Audio
Lock. This was a bounded headless check, not native OS execution, full game
compilation or a graphics/audio run. The complete game still rejects at Pt Play.
