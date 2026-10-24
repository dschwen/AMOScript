# Fade to black on the AMOS clock

`Fade speed` (`$0dfe`) now starts a nonblocking fade to black on the selected
screen. The supported speed is an integer 1–32767 after shared numeric conversion.
Zero, negative, oversized and string speeds reject with source locations. Explicit
colour lists, Fade To screen/bank/mask forms and the original word-boundary cases
remain unsupported; they fail rather than being interpreted as this form.

## Palette and field semantics

AMOS owns one fade job, so starting a new fade replaces the previous one even
when it targets another screen. Selection afterward does not retarget that job.
All 32 colour registers participate, including registers beyond the screen's
bitplane depth. Starting captures the nonblack registers and their RGB components;
normal drawing, logical/physical bitmap bytes, Autoback and Bob backgrounds remain
unchanged.

The first component step occurs on the next nominal VBL, including when the command
starts partway through a field. Subsequent steps occur every speed VBLs. Each
nonzero four-bit red, green and blue component decreases by one independently.
For example, `$f31` becomes `$e20`, then `$d10`. Each component reaches zero
without wrapping. The source's final completion check occurs one interval after
the last component step; black pixels can therefore precede inactive status.
Already-black palettes allocate no wakeup.

The captured component state is authoritative for participating registers during
the fade. A later Colour/Palette write can be overwritten by the next component
step. Completed or initially black entries are not restarted by later writes.
Rainbow row tables remain separate: fading a normal palette register does not
rewrite a rainbow table that overrides it on a physical row.

Canvas, CPU and GPU consume the same updated palette through the existing
snapshot path. EHB derives its half-bright colour after the fade step; HAM uses
the changing base palette. Old snapshots remain immutable. No RGBA darkening
effect or browser-only colour multiplier is introduced.

## Scheduling and lifecycle

The driver owns one optional palette wake in addition to its execution wake.
It uses the same injected `now`, `setTimeout`, `clearTimeout` and `vblHz` clock as
Timer. [Flash](flash.md) shares this wake; coincident writes follow the original
Flash-before-Fade ordering and late reconciliation retains the latest field write.
Timer assignment and sleepScale do not alter the fade phase. Palette wakes
continue during Wait and Wait Key without executing program instructions.
requestAnimationFrame only presents the resulting state. Late wakes reconcile at
most fifteen component steps plus a completion check, independent of elapsed time.

Stop cancels host wakeups and preserves the fade job and displayed palette.
Resume reconciles elapsed nominal VBLs and rearms a wake only if work remains.
The VM's existing paused-wait behavior remains unchanged. End, runtime failures
and explicit host `cancelFade()` cancel the job and retain the last palette.
This host lifecycle contract freezes stopped output; it does not emulate an Amiga
interrupt continuing visibly behind a stopped browser program. Exact interrupt
ordering, bus timing and display-list captures remain open.

Closing or replacing the target screen cancels immediately, including under
Auto View Off. `display.subscribeScreens` reports bitmap-identity lifecycle changes
independently of presentation notifications, so a staged old screen can retain its
last palette without retaining a fade timer. Detaching a Canvas host does not stop
the headless program; callers disposing an instance must also stop it, as the demos
do. Owned-task identity guards ignore callbacks that could not be physically
cancelled. Asynchronous display/clock failures halt with the Fade instruction's
source location, including a coincident execution wake.

`program.state.fade` is a frozen diagnostic snapshot with `active`, `screen`,
`speed` and `nextVbl`; it is separate from the source language. The internal
advance/wake hooks belong to the driver, keeping browser APIs out of operations.

## Wonderland and evidence

The [Fade demo](../demos/fade.html) copies original startup/title lines 1–64 and
post-death lines 235–238 unchanged: Screen 0, Fade 2, Wait 64, Wait Vbl. Synthetic
Wait Key trigger/exit guards connect the slices. This does not execute gameplay
or the death animation/routines. The title and banks are original; its nine
sampled frames use independent expectations formed by reducing the pinned title
PNG's four-bit RGB components. Live controls expose the same source slices.

Pinned source evidence comes from
[`src/interp/graphics.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/interp/graphics.cpp),
[`src/w/colours.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/colours.cpp)
and [`src/w/vbl.cpp`](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/7f32e0abe1b6b415c9502b598cd3e4cb131018f8/src/w/vbl.cpp).
These are source-derived expectations, not an Amiga execution capture.

Eight execution groups cover timing/phase at 50/60 Hz, typed speeds, palette
ownership, normal/EHB/HAM output, physical buffers, immutable snapshots, staged
replacement, Stop/Resume, stale callbacks and failure context. An independent-byte
conformance case advances its fake clock by an explicit bounded duration.
Chromium checks nine original-title fade frames without running an animation
callback and exercises the live controls. Four additional native GPU comparisons
use independent RGB expectations, bringing local coverage to 169 GPU/CPU frames.

The unmodified Wonderland source now compiles completely. Controlled game entry
reaches the attached-sprite publication gate at Wait Vbl line 204; see
[the milestone](wonderland.md) and [selector/whole-program evidence](file-selector.md).
