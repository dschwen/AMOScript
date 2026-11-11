# Original AMCAF graphical requester

The unchanged `FileRequester.AMOS` now runs on its own
[repository demo page](../demos/amcaf-example-filerequester.html).
It uses the supplied session filesystem and explicitly selected `execVersion:39`
profile; it does not open a native OS file picker. Its returned filename goes
through the original two confirmation requesters before End.

## Enumeration and metadata

Examine Dir takes one checked `files.stat` result and one synchronous `files.list`
snapshot. It validates every entry before installing a per-program cursor.
Examine Next$ selects the next entry's captured metadata and returns its basename.
At exhaustion it closes the cursor, returns an empty string and records error
232. Examine Stop closes an existing cursor or does nothing when none exists.
Examine Object updates the same metadata record but not the directory cursor.
Failed examination preserves the previous valid object metadata. Opening a new
directory first retires its previous cursor, including on failure.

Objects expose size, directory type (2 or -3), name, date, packed time, comment
and protection. Optional adapter metadata has checked AMCAF values. Missing
fields use explicit portable defaults: day 0 (1 January 1978), time 0, comment
empty and protection 0. They are not claims about the files' original timestamps
or host permissions. Dates are supported through 2099; packed time contains
minutes in the high word and 50-Hz ticks within the minute in the low word.
Cd Date$/Ct Time$ format these deterministically with UTC arithmetic. Protection
formatting follows AMCAF's `dewr----apsh` table (`----rwed` for zero).

Io Error is per program. The implemented English message subset covers missing
objects (205), wrong directory type (212), read protection (224) and exhaustion
(232); other values retain a numeric fallback. These are portable diagnostics,
not a localized implementation of every DOS Fault message or native lock API.

## Devices and patterns

The optional synchronous `files.devices()` adapter returns explicit name/type
records. Core Dev First$/Dev Next$ use the existing shared directory-result
cursor and padded strings. Supported filters are empty, D or A. Disk Type queries
these checked descriptors. Memory files infer colon-prefixed aliases as assigns
(type 1); Node files report no Amiga device list by default. Volume aliases stay
out of relative-root directory listings and remain accessible through their
explicit prefixes. No physical drive or printer detection is implied.

Pattern Match expands every `*` to `#?`, as AMCAF does before ParsePatternNoCase.
The bounded parser supports literals/ASCII case folding, `?`, `#` repetition,
parenthesized alternatives, `~` complement, classes/ranges and single-quote
escaping. It caps byte-string lengths, nesting and matching work. It uses an AST
and memoized endpoint sets rather than a potentially unbounded host regular
expression. Unsupported/malformed inputs fail with source context. This is a
portable subset, not a complete AmigaDOS pattern parser or locale implementation.

## Foreground and drawing

Amos Here returns -1/0 from per-program foreground intent. Amos To Back/Front
notify the optional synchronous system adapter and commit their flags only on
success. The browser keeps its viewport inspectable and offers **Return to AMOS**
after a back request. The control restores foreground intent without injecting
AMOS text, joystick input or a restart. Request On/Off record requester intent;
I/O errors still follow the program's ordinary Trap handling.

The parser now applies its normal Else statement-boundary rule inside procedure
bodies too. This handles the original `If ... : ... : Else Multi Wait : Endif`
without source edits.

Gr Writing 2 supports solid complement Bar: enabled bitmap planes are inverted
regardless of Ink, with inclusive clipped bounds and ordinary Autoback/Bob
ownership. Window printing and clearing retain their separate semantics. Patterned
or bordered complement fills and other graphics primitives remain gated. Native
AMOS InGrWriting passes the mode to graphics.library SetDrMd; mode 2 is COMPLEMENT.

## Evidence and limits

Tests run the original source with prepared files and mouse input to select a
file, answer both requesters and reach End. Browser checks use actual pointer and
keyboard events, visit Data, edit the filename field, restore foreground intent,
compare a complete selected-row region against independent XOR expectations and
compare three actual GPU outputs with the CPU display reference. Unit checks
cover cursor isolation/exhaustion, metadata failure, patterns, device aliases,
compiled foreground controls and the procedure Else form. These checks are not
native Amiga captures, exhaustive requester replays or persistent filesystem tests.

Native references are `Lib.s` FnAmosHere/InAmosToBack/InGrWriting and AMCAF
R06b–R081, $379a (pattern preprocessing), $7218/$7326 (date/time strings), and
$3bd0 (protection formatting), retained under the existing reference-source paths.
