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
