# Fastball compilation regressions

These files are unmodified copies from `fastball/elms`, pinned in `manifest.json`.
They cover the three previously blocked editable programs: the current intro,
older editor, and current high-score display. Originals and compiled wrappers
remain separate. These are source regression inputs, not a complete game asset
manifest or a claim of full browser execution.

The uncached AMOS 1.3 forms select existing operations: Cls colour/rectangle,
Screen Hide/Show screen, and Logic/Physic(screen). Get Disc Fonts and Set Font
select explicitly preloaded portable bitmap-font records for graphics Text.

`Fastballfont.font` is only an Amiga font descriptor. It names `Fastballfont/9`,
whose actual glyph file is missing from the supplied directory. No substitute
font is silently installed. Tests use a declared synthetic atlas to verify the
font API; that atlas is not the original artwork. See
[the font and compilation contract](../../docs/fastball.md).
