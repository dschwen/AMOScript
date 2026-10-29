# Planet Zybex lightning and per-screen background colours

The reported crash at **line 1251, byte 58398** is a display-runtime limitation,
not an error in the AMOS game. Original lines 1232–1242 fade screen 2's COLOR00
up towards white for lightning, then back to black. Screen 5's hires score panel
keeps its black background. The priority bridge formerly required every window
to share COLOR00, even for disjoint equal-hardware-width windows.

The normal-speed PAL frozen route reproduces the failure at host time 12,180 ms,
with the VM waiting at the reported location and palette zero values `$111` and
`$000`. The older progression captures surround the flash rather than capturing
it. Compilation and reaching level 3 therefore did not verify these intermediate
presentations. The same source effect runs in vertical gameplay at line 1423,
byte 64474.

## Physical display fix

The bridge now permits a separate COLOR00 for each supported screen slice.
The copper builder writes a changed COLOR00 immediately after disabling bitplane
DMA on the setup row, ahead of the later invisible playfield setup. It therefore
colours the setup row as well as subsequent zero-index pixels, and restores the
next owner's background when that screen resumes. It does not paint an RGBA
background or use a CPU fallback.

This order follows `EcCopHo` / `MkC5` in
[AMOS-Professional-Official +W.s, revision 533b4b1](https://github.com/AOZ-Studio/AMOS-Professional-Official/blob/533b4b1f5acd604814513f78e02c7b4796cb0531/%2BW.s):
the native routine disables DMA and begins the screen palette with COLOR00 before
writing bitplane pointers. The portable builder retains its existing bounded
scheduling and capture model; this is not a native DMA-timing capture.

The half-speed vertical fade also exposed an armed but entirely transparent
attached sprite row on the score-panel setup row. Zero data in both sprite words
cannot display a sprite colour. Such rows no longer demand an unused sprite
palette capture. Nonzero data in either half of an attached pair still triggers
the existing palette-budget guard. Capture/fetch deadlines, sprite palette limits,
priority geometry, unsupported hires overlaps and HAM/fine-scroll bounds remain
unchanged. No AMOS or asset bytes change.

## Regression coverage

`planetZybexLightning.js` observes the frozen joystick progression at every host
clock advance, capturing every changed playfield COLOR00, including its return
to black. It uses the complete current source, actual Fade instructions, assets
and original level loading. No VM variables, IPs, AMAL strings, pixels or bank
contents are edited. Both docking sequences and level-3 entry retain five lives.

Four PAL/NTSC normal/half-speed runs capture **184 palette steps**. The unchanged
source Timer test reverses the fade at shade 11 at normal speed and shade 12 at
half speed; Timer and fade clocks remain real VBL clocks. Frozen sequences are
execution regressions, not native timing claims.

Each capture verifies all **171 background-palette rows**: 160 playfield rows use
the current grey, while the score setup row and ten hires HUD rows stay black.
All snapshots retain zero overflow events. Synthetic overlap tests independently
check literal zero-index pixels, both setup rows and underlying-screen restoration
with different background colours. Another case distinguishes transparent armed
rows from nonzero attached sprite data without relaxing the latter's guard.

The [lightning demo](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/planet-zybex-lightning.html)
shares its evaluator with the browser suite. It contains **31,464 independent
palette-row assertions**, 184 Canvas captures and **184 actual GPU comparisons**
against Canvas/reference output, with CPU presentation disabled during GPU
rendering. This raises total Zybex GPU comparisons to **510**, including earlier
fixtures. These checks do not provide independent full moving composites or
Amiga display/audio/timing captures.

`npm run build:demo` rebuilds the regression page and both regular/debug game
launchers. Verify with `npm run check` and `npm run test:browser`. Other reported
crashes still need their own error locations/replays; this change addresses the
background-colour failure and transparent-row false rejection above.
