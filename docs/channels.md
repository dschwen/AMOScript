# AMAL channel routing

`Channel channel To Bob number` and `Channel channel To Sprite number` use the
original `$1f94` encoding. Each factory owns 64 type/number pairs, initially
mapping channel n to Sprite n. Both operands must be integers in 0–63 after the
ordinary numeric conversion. Negative or out-of-range values reject without
changing the pair. Channel validation precedes evaluation of the target
expression; each expression evaluates once, from left to right. Compiler type
errors and runtime bounds/host failures retain ordinary source locations.

A binding is a selector for a later animation installation. It does not require
an existing Bob, Sprite, image bank or screen. In particular, binding Sprite 15
is valid while computed-Sprite rendering remains unsupported. The target limit
is 64 even if the host configures more Bob slots. Binding does not create,
remove, move or render objects, swap buffers, change registers, or schedule an
animation wake. Several channels may select the same object. Rebinding changes
only that channel's pair.

`program.channelBinding(channel)` returns a frozen independent `{type, number}`
snapshot for inspection. The generated `setChannel` call receives its target as
a thunk so the native evaluation boundary is preserved. File channel state is
separate. Stop/Resume retains mappings; a fresh factory or Default restores all
64 identity Sprite mappings. Existing snapshots remain independent.

## Native evidence and remaining gates

[`+ILib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BILib.s),
`InChannel`, evaluates/checks the channel, reads the target kind, then evaluates
and checks its number before storing two bytes in `AnCanaux`. Its Bob/Sprite
limits are both 64. `DefRun1` restores all Sprite identity pairs.
[`+Lib.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BLib.s),
`MvA3`/`InAMv0`, reads the pair when installing an AMAL/animation program;
[`+W.s`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s),
`ResAMAL`, resolves that installation's actual object address. The [manual AMAL controller](amal.md) captures/resolves the pair at installation;
this table does not contain live pointers or retarget installed programs.

Routing remains separate from [manual AMAL execution](amal.md), which now
supports bounded strings/local registers, On/Off, manual Synchro and Update.
Freeze, wider AMAL grammar and automatic synchronization remain unsupported.
No no-op AMAL programs are emitted. Screen display/size/offset, Rainbow and raw
address targets remain rejected; computed/wide Sprites and native captures are
separate gates. Global Amreg continues to use the existing shared signed-word
array, not a new set of animation globals.

## Planet Zybex demo and checks

Choose **Channel routing (fixture)** in the
[Zybex demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex.html).
It retains original level-1 Load/Unpack 245–247 and then joins these unchanged
routing excerpts with declared stage variables/key guards:

| Stage | Original lines | Behavior |
| --- | --- | --- |
| Four enemies | 383–385 | Channels 20–23 select their same-number Bobs |
| Twenty enemies | 460–462 | Channels 20–39 select their same-number Bobs |
| Player/bullets | 991, 1029–1031 | Sprite 15 and Bobs 1–8 |

These are paths from different parts of the game, joined for inspection. Object
creation, surrounding gameplay and AMAL execution are omitted. The table displays
the Bob routes and the player Sprite route; the original world remains still.
Keys or Advance move between guards. This is not connected level progression.

Literal independent mapping lists in `test/fixtures/planet-zybex/channels.json`
check every channel at all three guards (192 comparisons). Unit tests also
compile all 27 original Channel statements with declared `l=31`/`lop=5` inputs
where loops are omitted. Existing independent packed-picture hashes verify that
routing preserves the background; one additional actual GPU comparison brings
the Zybex total to 58. Browser host checks exercise real key/button advancement,
table visibility, mode replacement and fullscreen/disposal. These checks do not
establish AMAL movement or native execution parity.
