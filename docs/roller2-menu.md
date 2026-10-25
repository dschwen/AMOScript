# Roller II original intro to guarded menu

The [menu demo](../demos/roller2-menu.html) now runs the original executable
startup-to-menu sequence through line 316. `roller2ConnectedMenu` retains raw
lines 1–71, WTIN 163–165, SASINIT 205–239 and setup/menu 275–316. Omitted intervening
code consists of unused procedure definitions/comments. There is no synthetic
title load, jump across executable setup, or host variable/IP edit.

Destination guards record `game`, `editor`, `scores` or `help`
and wait. Game selection now first runs original entry 565–570 (both ICCOPY
calls); its guard follows those copies. Screen/level setup after 570 and the
editor/scores/help routines remain excluded. This is not a running game. The complete source still fails
decoding at Boom in an omitted procedure; selected routines, gameplay and their
later dependencies remain open. The earlier isolated menu helper remains in
headless tests, and the earlier [intro demo](roller2-intro.md) retains its declared
handoff for focused rendering/input regression coverage.

## Original setup and music

The initial FLOAD fades the logo in; original WTIN accepts input, FDZ fades out,
and the original array/highscore/SASINIT/bank setup runs. Setup 281–286 now also
executes: Led Off, Make Icon Mask, Screen Close 0 and the second Led Off. It uses
existing runtime semantics. All 113 nonempty icon records receive masks; null
slots remain null. The first screen is retired before the main FLOAD creates the
320×512 EHB title and its bounded window. The temporary palette clone is closed
before the original LIMM and menu zones/input loop begin.

The chip Tracker bank and playback continue across both FLOADs, setup and menu.
The normal path does not reload/restart the music. Original Highend 291–292 also
reloads and starts the MOD if that bank is absent. One explicit headless lifecycle
probe erases the bank during the intro to verify this fallback; this mutation is
not part of the normal browser replay.

The optional Enable/Mute music button uses the existing browser audio session.
Construction and VM binding create no AudioContext; activation requires its user
gesture. Muted notes are dropped. Stop silences voices and freezes tracker fields;
Resume continues without restoring held sample phase. Restart preserves the audio
session preference and replaces its program binding, silencing old voices. Disposal
closes the owned context. These controls reuse the established tracker/Web Audio
subset; they add no new claim of Amiga analog or MOD-effect fidelity.

## Original input and branches

Four original zones cover the game button (1), editor button (2), highscore
region (3), and help symbol (4). The original loop moves X/Y Mouse through
joystick directions, waits for VBL while Joy is active, consumes Inkey$/Scancode,
and branches on held mouse/fire input. It retains its original precedence:

- `h` selects the scores guard, setting VTB to one.
- The Amiga Help raw code 95 selects help. Browser tests inject a `Help` event;
  F10 retains its distinct raw code and is not a Help alias.
- Fire before joystick movement selects game directly, regardless of the zone.
- After movement sets MOVJ, fire selects the zone beneath the moved mouse.
- A left mouse button selects the current zone. Empty regions keep polling.
- Game/editor selection executes the original `FDZ[2]` before its guard.

The live preview defaults to WebGL2 with a labelled Canvas fallback and a stable
fullscreen container. A key/fire leaves the intro logo. At the menu, keyboard
arrows and Space/Enter map to joystick port 1; Gamepad API queries poll independently
of rendering. Pointer events use the hardware-coordinate adapter. Joystick mouse
assignments do not warp the browser cursor. Restart begins the original intro
again; Stop/Resume preserve the host's existing input/fullscreen contracts.

## Evidence and limits

The isolated headless menu test still classifies all 85,760 title positions
against independently transcribed rectangles. Four additional connected-flow
groups cover the ordered asset reads, mask/filter/screen setup, tracker continuity,
all four target guards, two-button highscore bypass, factory ownership, Stop/Resume
and the bank-reload lifecycle probe. Source and assets are unchanged.

The shared browser evaluator now traverses the complete connected prefix in each
of ten bounded cases. Nine select guards. Independent PNGs check the first logo,
main title and black output after original FDZ. Three snapshots run on the same
actual WebGL host across screen replacement and match CPU output; disabling the
CPU presentation path guards against a fallback. These replace the earlier two
isolated-menu GPU checks, rather than adding three to that earlier count.

Chromium gallery checks additionally exercise real pointer/H-key input, a
controlled Help event, music activation/mute, silent Stop, restart bindings,
fullscreen and owned-context closure. Every browser case is available from the
self-contained demo's HTML Preview link in the gallery.

The controlled clock has a four-millisecond minimum host callback delay and finite
budgets, preventing busy polling from starving VBL wakes. Input leaves WTIN at
1000 ms; the menu is checked at 2840 ms (tracker field 142), and selections after
another 640 ms, including original FDZ where applicable. These are injected clocks,
not exact native busy-loop timing, physical-controller evidence, Amiga captures
or target-GPU performance. See [Mouse Zone](zones.md), [mouse assignment](mouse.md)
and [tracker limits](mod-tracker.md).

The [raw icon bridge and inspector](icon-memory.md) provide independent before/
after pixels for ICCOPY. Connected menu replays verify its copied pixels and
unchanged masks on every game selection; existing title GPU frame counts remain
three, with two additional GPU frames in the separate icon inspector.
