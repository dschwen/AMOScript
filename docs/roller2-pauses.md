# Original Roller II pause modes

The [pause demo](../demos/roller2-pauses.html) extends the connected progression
fixture with unchanged PAUSE/IPause lines 966–984. The original JOAB branches
select them; returning to JOAB resumes normal input. The fixture retains original
startup, first-level collection, bonus and real next-level loading. Earlier demos
keep their explicit pause guards. Other tile and game-over handlers remain guarded.

Hold the mouse button or Help with positive HI to enter the paid pause. Original
JOAB saves TIM and OH and resets Timer to zero. PAUSE assigns
`HI=OH-(Timer/50)` using integer division, displays `Score(Paused):`, and restores
TIM on release before clearing the full score text row with Cline. The initial
`HI=HI-1` is followed by that assignment; it does not impose an extra point per
loop. If the score runs out while held, the source exits without restoring TIM.
With zero score the original gate ignores mouse/Help pause. Native MOD playback
continues during both game pause modes.

Space selects IPause. The source copies the game palette to screen 1, fades the
board to black, switches off the sprite and presents original icon 78 at (100,5)
in the existing foreground window. Original WTIN accepts keyboard text, mouse
click or joystick fire. The source then hides the foreground, restores the ball
and fades back to its saved palette. JOAB captures `TIM=Timer-30`, and IPause
restores that exact value after its fade/wait. Early pauses can therefore restore
a negative Timer and display a larger countdown. These source expressions are
preserved rather than replaced with a host pause operation. Holding the mouse
button beyond popup return can immediately enter paid pause; the finite mouse
exit test releases it before return.

This demo maps keyboard joystick fire to **Enter**, keeping **Space** available
as native AMOS text input. Arrow directions and browser Gamepad mappings retain
the existing adapter behavior. Other demos keep their existing keyboard mapping.
The live preview retains fullscreen, host Stop/Resume and Restart, and is silent.
Host Stop freezes VM execution, palette presentation and tracker playback; Resume
continues the original wait and later source Timer restoration.

`tools/reference/roller2_pauses.py` independently composes three complete images
from raw original banks and pinned public-domain font8x8 glyphs: settled paid score,
black-board pause popup, and resumed board/status. It reuses only the independent
Python asset/oracle helpers. The declared replay starts level 2 at 13000 ms with
score 227. Help/mouse held for 2040 ms gives score 225; releasing for 100 ms,
Space for 400 ms and a WTIN exit followed by 600 ms produce the final frame.
Timer restores to -19 and reaches -4 in that capture, with printed countdown 30.
The prior paid-score image at 2020 ms would still print 226 while logical HI is
225, because the source print follows Wait Vbl. Settled captures avoid conflating
that deliberate wait with a font mismatch. Images use the portable font/origin;
no native AMOS execution or timing capture is claimed.

Four headless groups check mouse/Help costs, source Timer restoration, exact
pixels, Cline cleanup, all three WTIN exit families, unchanged bank data and
ordinary stacks, continued music, host Stop/Resume, zero-score gating and natural
score exhaustion. Two browser replays compare twenty independent Canvas images
and ten actual GPU frames with CPU presentation disabled during GPU renders.
Their input paths cover keyboard Help/Space/text and pointer-paid pause/Gamepad
return. Live gallery checks additionally use real mouse holds, fullscreen,
host Stop/Resume inside the popup, and Restart.

The next level-2 movement path reaches PFEIL. Its original timeout branch calls
Boom, so adding the whole routine requires synthesized noise/envelope playback.
The existing Samples/MOD controllers do not implement that command. Do not omit
its timeout or count a replacement sample as native Boom. Pause support does not
complete level-2 movement, game-over/win music, editor/highscores or full compilation.
