# Roller II target assets

These are byte-for-byte copies from the user-provided `RII/` directory. The
manifest records 32 source/data files and SHA-256 hashes. No upstream revision or
native execution capture is inferred. The supplied main program's credits name
Daniel Schwen for program and graphics.

The target is `Roller II.AMOS` (65,808 bytes, 1,199 physical lines), rather than the
native `Roller.exe` launcher. Intro, help and game-over source are retained for
later path coverage. Original filenames and casing are preserved. Host adapters
must handle AMOS's case-insensitive volume/relative paths; the browser load fixture
uses an explicit prepared lookup, without changing global filesystem semantics.

The main track is `music/mod.Roller_II_mus`, a four-channel `M.K.` MOD. `Over.mus`
and `Ywon.mus` are AMOS `Music   ` bank files, not ProTracker MODs. Samples, icons,
sprites, five IFF images, fifteen numbered levels, highscores and help text are
also retained. Amiga system libraries, executables, Workbench icons and backups
are not needed for the source/data fixture and have not been copied. The supplied
`RII/` directory is unchanged.

See [the milestone](../../docs/roller2.md) and
[the source-load/MOD inspector](../../demos/roller2.html). The
[music demo](../../demos/tracker.html) now plays the main MOD through bounded
compiled original statements. Full-game compilation and the separate AMOS Music
bank end tunes remain open.
The [startup demo](../../demos/roller2-startup.html) runs the unchanged first 17
physical lines with a synthetic Wait Key guard before the first image request.
The [first-image demo](../../demos/roller2-title.html) also executes original
line 18 and FLOAD (63–68), then stops before WTIN. It shows the first logo through
AMSC placement and palette fading. The [intro transition demo](../../demos/roller2-intro.html)
continues through original WTIN/FDZ input and fade-out, then uses a declared
handoff to load the main title image. Original scores/arrays, SASINIT and work/
image-bank loading now run; setup 281–286, the menu and gameplay remain open.

The [connected menu demo](../../demos/roller2-menu.html) now joins original startup,
intro, initialization, setup and menu with continuing MOD playback. Optional sound
controls and WebGL/fullscreen share the live host. Explicit destination guards
stop before game screen/level setup and editor/scores/help routines.

The [level metadata demo](../../demos/roller2-levels.html) executes original time
reads/writes across all fifteen pinned level files. Edits affect memory only;
the original game/editor loops and file persistence remain excluded.

The [icon-copy inspector](../../demos/roller2-icons.html) shows original ICCOPY
through bounded raw icon views. Connected menu game selection now reaches these
original entry calls, then continues through original screen/rainbow/status setup and level 1 loading,
with a guard before board drawing.
