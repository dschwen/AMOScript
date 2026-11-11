# AMCAF GamePorts and Bzoom animation

Both original programs are unchanged. Their standalone pages are linked from
[the AMCAF catalogue](../demos/amcaf-examples.md). Builds select AMCAF 1.50beta4
in slot 8. Source-derived expectations and browser GPU comparisons are not
native Amiga captures.

## Controller state

Xfire accepts ports 0/1 and buttons 0–6 and returns AMOS -1/0. It polls the same
synchronous joystick reader used by Joy, then reads an independent seven-bit
button mask. Joy retains its five-bit direction/fire result; Smouse Key retains
only the first three button bits. `setPortButtons(port, mask)` accepts 0–127.
The two basic buttons do not require a simulated OS library. All seven buttons
have a portable implementation, so the original trapped capability query succeeds
without pretending that an Amiga lowlevel.library has been loaded.

Browser keyboard/Gamepad mappings optionally expose `fire2` through `fire7`.
Opposite directions still cancel without cancelling buttons. The GamePorts page
maps two browser pads to normal ports 0/1. Its button indices are 0,1,3,2,4,5,9
(primary/secondary/yellow/green/reverse/forward/play). Keyboard input maps only
to port 1. These are explicit host choices. Other application pages keep their
existing input configurations.

Pjoy reads two separate, initially disconnected masks through
`setParallelJoystick(port, mask)`, with ports 0/1 and five-bit masks 0–31.
The page's labelled parallel controls feed these masks. No printer/adapter probe
or physical parallel-port access is implied. Stop/End clears both kinds of held
input. Key Speed preserves holds. The simulation panel clears pointers/timers
on release, cancellation, visibility/fullscreen changes, blur, replacement and
disposal. The core keeps these virtual inputs distinct from AMOS text and mouse
clicks.

Native Xfire routine $2202 maps button 2 to lowlevel bit 21 (yellow) and button 3
to bit 20 (green); the source comments call these colours in the opposite order.
The implementation follows the native button indices. Pjoy is routine $20f4.

## Secondary mouse

X/Y Smouse read signed 16-bit position words shifted arithmetically by the speed
exponent. Smouse X/Y store shifted low words. Smouse Speed preserves the current
integer coordinate while rescaling these words, with the portable supported
range 0–4. Limit Smouse stores low-word bounds without moving the position;
the bare form takes the current screen's hardware origin and bitmap extent.

`moveSecondaryMouse(dx,dy)` applies a host sample of relative counter motion,
with the bounded supported delta range -126..126 per axis. It adds signed words
and clamps against shifted signed limits in the native order. Speed 1 gives
half-pixel accumulation: two raw increments move one coordinate unit. Position,
speed and limits survive Stop. Buttons share normal port 1 and Smouse Key.

This is a sample-driven adapter: it does not install a hardware VBL mouse-counter
reader. Assignments outside the limits remain visible until the next host sample
(including a zero-delta sample) applies clamping. Counter wrap/ambiguous ±127
increments and native OS pointer control remain outside this subset. The demo's
mouse arrows supply explicit 20-ms samples while held.

Native evidence: AMCAF routines $4656–$475e and the VBL word update at
$1d06–$1d9c in `tools/reference/amcaf-v1.50beta4/ira.s`.

## Metadata and raw animation banks

Examine Object calls synchronous `files.stat(resolvedName)` once and captures a
checked size/directory snapshot without reading file contents. Object Size reads
the last snapshot; its filename overload examines first. Missing/async/invalid
metadata fails without replacing a previous valid snapshot. Memory and Node
adapters supply this metadata; the browser wrapper preserves case/volume handling.
Native object dates, comments, protection and directory enumeration are separate.

Frame Play now also accepts a generic bank containing a complete FORM ANIM file,
with either no suffix or the exact 12-byte FORM/zero-length/DLTA suffix used by
the original Bzoom program. Frame addresses retain the original file's outer
12-byte wrapper offset. They do not point into a normalized Frame Load copy.
The decoded cache checks the entire current bank before reuse; raw writes cause
revalidation. Swaps preserve identity/address behavior. Existing Frame Load
banks retain their write/shrink guards.

ANIM-5 zero delta width/height are unspecified; nonzero values must still match
the first bitmap. Plane offsets bound every column stream. Bytes after the
required bitmap columns are opaque padding, as in native IffDLTA; this animation
has four trailing bytes per plane and an occasional extra alignment byte. The
parser still checks every referenced opcode, plane, row and complete read range.
It does not execute the opaque bytes. Native `Lib.s` IffDLTA uses the current
bitmap row stride rather than these ANHD geometry fields.

## Bzoom writes

Bzoom decodes the low nibbles as horizontal 1/2/4/8 and vertical 1–15 integer
replication factors. Source x endpoints are byte-aligned with `$0ff8` and the
destination x is word-aligned with `$0ff0`, matching native routine $7b76.
Source endpoints are exclusive. Geometry is preflighted inside both bitmaps;
aliased pixel storage and destination depth greater than source depth reject.
Coordinates are bounded to 0–4095, and factor words to 0–255. This is a declared
safe subset of the native unchecked-memory operation.

Writes go directly to logical indexed storage, copying the destination's common
planes. They do not change screen selection, physical buffers, palette, cursor,
line phase or Bob/Autoback state. The existing snapshot/chip bridge supplies real
WebGL display; there is no RGBA overlay.

`tools/reference/check_amcaf_devices.py` independently decodes original GamePorts
planar icons and all 42 ANIM frames. It also models the application's alternating
raw patches, exact loop restart and doubled crop for 90 output frames. Fixtures
are under `test/fixtures/amcaf/`. Tests compare independent joystick/pad image
hashes and all 90 output hashes; browser checks add actual keyboard/gamepad/
pointer input, lifecycle cleanup, two controller GPU frames and six animation
GPU frames across natural loops, pause/resume and source exit.
