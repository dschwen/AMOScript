# Original AMCAF examples

[Demo gallery](index.md)

2/12 original programs compile. The original quick-maths example and Protracker2 music visualizer run with Canvas/WebGL. The remaining programs have explicit blocker pages. Sources, four original data files and the separately recovered 4 spirits module are under examples/AMCAF; builds select AMCAF 1.50beta4 in slot 8.

## Try the working examples

[Protracker2 — original music visualizer](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker2.html): start the supplied Hawkeye tune, watch the frequency meters and note trail, then press a mouse button on the canvas to exit.

[Quick sine, cosine, angle and square root](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-qsincosarcsqr.html): move the pointer to aim the line and resize the circle. Press Escape outside fullscreen or a mouse button to exit.

[Quick-maths browser checks and captured frames](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-quick-maths.html)

[Protracker status and VU support checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-status.html).

[String, shift and raw Work-file support checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-utilities.html) — a synthetic compatibility demo for the shared utilities needed by the remaining examples.

[Blitter graphics and original Protracker2 browser checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-blitter.html).

## Music support preview

[Play Hawkeye with AMCAF voice controls](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-hawkeye.html). A declared compiled harness loads the original packed module into a chip Work bank. Press keys to disable voice 1, re-enable it, then stop. Protracker2 now has its own original visualizer page above; the first Protracker version remains blocked. [Voice DMA and native audio graph checks](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-voice.html).

## Complete collection

| Program | Build | Runtime evidence / first blocker |
| --- | --- | --- |
| [BZoomAnimPlayer.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bzoomanimplayer.html) | Blocked | Unsupported extension 8:0x672 (amcaf-1.50beta4) at line 14, byte 644 |
| [BankManager.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bankmanager.html) | Blocked | Unsupported token 0x24d0 at line 27, byte 756 |
| [BigAmcafIntro.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-bigamcafintro.html) | Blocked | Unsupported token 0x10ac at line 21, byte 704 |
| [FileRequester.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-filerequester.html) | Blocked | Unsupported token 0x24d0 at line 251, byte 10314 |
| [Fonts.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-fonts.html) | Blocked | Unsupported extension 8:0x1204 (amcaf-1.50beta4) at line 16, byte 770 |
| [GamePorts.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-gameports.html) | Blocked | Unsupported extension 8:0x15be (amcaf-1.50beta4) at line 14, byte 720 |
| [Iff2Raw.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-iff2raw.html) | Blocked | Unsupported token 0x3c0 at line 30, byte 1206 |
| [Protracker.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker.html) | Blocked | Unsupported token 0x2226 at line 101, byte 4486 |
| [Protracker2.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-protracker2.html) | Compiles | Original frequency meters, note trail, packed music and mouse exit covered with Canvas/WebGL. |
| [QsinCosArcSqr.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-qsincosarcsqr.html) | Compiles | Original input loop, three mouse directions, double-buffer publication and Escape exit covered. |
| [SamBankFixer.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-sambankfixer.html) | Blocked | Unsupported token 0x28ae at line 22, byte 882 |
| [ShowAGAPic.AMOS](https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/amcaf-example-showagapic.html) | Blocked | Invalid AMOS line length at byte 4786 |

[Rebuild instructions, scope and implementation plan](../docs/amcaf-examples.md)
