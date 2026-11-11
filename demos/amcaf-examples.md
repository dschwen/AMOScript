# Original AMCAF examples

[Demo gallery](index.md)

9/12 original programs compile. The working pages include the controller monitor, Bzoom animation, fonts, two file utilities, quick maths and both Protracker interfaces. Other programs have explicit compile-blocker pages. Sources and restored original data files are under examples/AMCAF; builds select AMCAF 1.50beta4 in slot 8.

## Try the working examples

[FileRequester — original graphical file browser](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-filerequester.html): open Data, select a file and click Load, then answer the two original confirmation dialogs. Abort also reaches those dialogs. The screen-to-back gadget exposes a Return to AMOS button on the page.

[GamePorts — original controller monitor](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-gameports.html): two browser gamepads, keyboard controls for port 1, and clearly labelled simulations for parallel joysticks and second-mouse movement. Escape exits the program after leaving fullscreen.

[Bzoom animation player](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bzoomanimplayer.html): watch the original ANIM play with a doubled central crop. Escape or a mouse button exits.

[Fonts — original bank-font showcase](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-fonts.html): view the embedded Iva and Print fonts, then press Space twice to complete the font capture/restore demonstration. The page supplies a declared AROS-compatible Topaz font.

[IFF to raw converter](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-iff2raw.html) and [Sample-bank fixer](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-sambankfixer.html): upload an input file or use the synthetic sample, start the original program and download its output. The fixer waits for Space after each sample.

[Protracker1 — original music interface](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker.html): play the recovered 4 spirits tune. Typing mode is selected. Use arrows to adjust volume/tempo and keys 1–4 to toggle voices. A mouse button on the canvas exits. The restored original packed tune drives the drum/text synchronization cues.

[Protracker2 — original music visualizer](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker2.html): start the supplied Hawkeye tune, watch the frequency meters and note trail, then press a mouse button on the canvas to exit.

[Quick sine, cosine, angle and square root](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-qsincosarcsqr.html): move the pointer to aim the line and resize the circle. Press Escape outside fullscreen or a mouse button to exit.

[Quick-maths browser checks and captured frames](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-quick-maths.html)

[Protracker status and VU support checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-status.html).

[String, shift and raw Work-file support checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-utilities.html) — a synthetic compatibility demo for the shared utilities needed by the remaining examples.

[Blitter graphics and original Protracker2 browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-blitter.html).

## Drum animation preview

[Play the original drum sequences](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-drums.html): a declared synthetic scheduler cycles the six original Anim strings and embedded sprites without music. [Native field/image and Canvas/WebGL checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-anim.html).

## Music support preview

[Play Hawkeye with AMCAF voice controls](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-hawkeye.html). A declared compiled harness loads the original packed module into a chip Work bank. Press keys to disable voice 1, re-enable it, then stop. Protracker2 now has its own original visualizer page above; the first version also runs with the recovered 4 spirits module. [Voice DMA and native audio graph checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-voice.html).

## Complete collection

| Program | Build | Runtime evidence / first blocker |
| --- | --- | --- |
| [BZoomAnimPlayer.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bzoomanimplayer.html) | Compiles | Original 42-frame ANIM, raw-bank continuation and doubled central crop loop with WebGL. |
| [BankManager.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bankmanager.html) | Blocked | Unsupported extension 8:0x1ac (amcaf-1.50beta4) at line 100, byte 3616 |
| [BigAmcafIntro.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bigamcafintro.html) | Blocked | Unsupported token 0x10ac at line 21, byte 704 |
| [FileRequester.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-filerequester.html) | Compiles | Original graphical directory/file selection, device aliases, confirmation dialogs and foreground restore with WebGL. |
| [Fonts.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-fonts.html) | Compiles | Original Iva/Print banks, declared AROS topaz-compatible host font, bank capture/restore and both key exits covered with WebGL. |
| [GamePorts.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-gameports.html) | Compiles | Original controller monitor, seven-button gamepads, labelled parallel/secondary-mouse simulations and Escape exit. |
| [Iff2Raw.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-iff2raw.html) | Compiles | Original raw/ByteRun1 IFF conversion with prepared synchronous selections, uploads and byte-checked downloads. |
| [Protracker.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker.html) | Compiles | Original music interface, recovered 4 spirits playback, voice/volume/tempo controls, pause/resume and mouse exit covered with WebGL. The restored original packed tune drives the drum/text synchronization cues. |
| [Protracker2.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker2.html) | Compiles | Original frequency meters, note trail, packed music and mouse exit covered with Canvas/WebGL. |
| [QsinCosArcSqr.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-qsincosarcsqr.html) | Compiles | Original input loop, three mouse directions, double-buffer publication and Escape exit covered. |
| [SamBankFixer.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-sambankfixer.html) | Compiles | Original sample-bank playback, key prompt, PCM-word fix and saved-file download. |
| [ShowAGAPic.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-showagapic.html) | Blocked | Invalid AMOS line length at byte 4786 |

[Rebuild instructions, scope and implementation plan](../docs/amcaf-examples.md)
