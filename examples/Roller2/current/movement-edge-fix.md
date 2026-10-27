# Movement edge-check source fix

The supplied game reads the next tile and its colour on physical lines 643–644,
then checks the board boundary on line 645. At level 3's bottom-right time bonus,
`BX=17`, `BY=11`, `DX=0`, `DY=1`: the second Peek requests bank-10 offset 497,
beyond its 490-byte payload. Top-edge movement can also read before the bank.

The fix is in `Roller II.AMOS`, not in the compiler or memory implementation:

- Line 642 keeps `LAST=HD`, then checks all four board edges before either read.
  It uses the original bump sound, voice increment, Wait Vbl, current-cell HD
  reload and Goto JOAB actions.
- Lines 643–644 keep their ordinary next-cell reads for in-bounds moves.
- Line 645 retains the original wall (`HD=33`) branch after those reads.

This movement fix changes only physical lines 642 and 645. The current source
also has a separate [help-page fix](help-page-fix.md) on line 1129. The file retains 1,199 lines; its code
length/header is updated and its bank trailer is unchanged. The current manifest
records the corrected 65,966-byte file and original SHA-256. The earlier supplied
65,808-byte source remains unchanged in `../Roller II.AMOS` for regression work.
The working `RII/Roller II.AMOS` has the same source fix.

Readable equivalent of the corrected ordering:

```basic
BEWEG:
LAST=HD
If (BX=0 And DX=-1) Or (BX=19 And DX=1) Or (BY=0 And DY=-1) Or (BY=11 And DY=1)
  Sam Play 2^V*FX,2 : Add V,1,0 To 3 : Wait Vbl
  HD=Peek(Start(10)+BX+BY*20) : Goto JOAB
End If
HD=Peek(Start(10)+(BX+DX)+(BY+DY)*20)
HC=Peek(Start(10)+(BX+DX)+(BY+DY)*20+240)
If HD=33 Then Sam Play 2^V*FX,2 : Add V,1,0 To 3 : Wait Vbl : HD=Peek(Start(10)+BX+BY*20) : Goto JOAB
```

The binary keeps single-line If statements to preserve physical line numbers.
The block above is a readable reference, not compiler ASCII input.

The full-game regression reaches the tile through original input: Right, Down,
Right, Up, Right, Down, Up, Right, Down from level 3's starting ball. It
checks the intermediate stops, the colour collection and disk push, removal of
the bonus tile, `TM=30`, the bottom-edge bump and a second blocked downward press.
The score is 299 on the declared injected clock. No variable/IP/bank edits or
runtime read exceptions are used to make that replay pass. Bank bounds remain
strict. These are source/fixture checks, not external Amiga captures.

The later supplied level-3 refresh removes the stop at (17,7) and starts with
TM=20. The current route therefore needs one final Down slide instead of two;
the source time bonus adds 10. The earlier map yielded TM=20 and score 301.
