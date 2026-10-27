# Final help-page source fix

Physical line 1129 displays help entries 49–52 after the first six pages have
shown entries 1–48. The supplied source subtracts 40 in both of its position
expressions. For entry 49 this places the icon at pixel Y=200 and calls
`Locate 4,26` on a 320×200 screen with 25 text rows (0–24). The exact failure is
`Text cursor out of bounds at line 1129, byte 60532`.

Both integer literals change from 40 to 48 in the AMOS source:

```basic
For J=49 To 52
  Paste Icon 0,(J-48)*24-16,J : Locate 4,(J-48)*3-1 : Print DESCR$(J)
Next J
```

The four icons now start at pixel Y=8,32,56,80, with text rows 2,5,8,11. The rest
of the original help sequence, including its timed colour/ball examples and menu
return, is unchanged. No cursor clamping, wrapping or compiler exception is added.

This patch changes two payload bytes on line 1129: the integer tokens begin at
60496 and 60554; their four-byte values follow the token words. File length,
physical line count, token locations, header and bank trailer remain unchanged.
The pre-help-fix program SHA-256 is
`3637b3b07b79d1b352174f8a3e770a5a0f28b73cf8077f2110853b03071836c8`.
The current manifest records the new hash and this fix separately from the
[movement edge fix](movement-edge-fix.md). The working `RII/Roller II.AMOS` gets
the same two-literal correction; the frozen earlier source stays unchanged.

The full-source input replay enters Help through the raw Help key, advances all
seven icon pages, lets the original demonstrations finish, acknowledges the last
prompt and returns to the original menu with MOD playback. No VM variable, IP or
bank edits are used. Restoring the two old literals reproduces the reported error.
Independent Python AmIc extraction checks all 1,024 final-icon pixels at the
expected positions; nine Canvas/GPU comparisons cover the pages and menu return.
This is source/asset-derived evidence, not an external Amiga capture.
