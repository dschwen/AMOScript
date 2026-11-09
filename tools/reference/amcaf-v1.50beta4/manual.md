# AMCAF supplied manual: command/function nodes and history

Transcribed from the supplied AmigaGuide, whose main reference is V1.40.
History supplements it for the V1.50beta4 binary. This is documentation evidence, not a behavioral verification.

<a id="sbuglist"></a>

## Some bugs you must take care of

Bug report

This is a small list of AMOS bugs you must be aware of:

1. The AMOS string management is not bugfree. Be especially careful with
   AMAL programs!

2. The AMOS Default routines are not called:
   If you load AMOS and then start a program, the extension default
   routines are not called. I.e if a music is running from the previous
   call, it will not be stopped.
   Conclusion: - Call any accessory (e.g the help-accessory) once.

3. Programs cannot be compiled:
   The compiler prints out the error 'Not an AMOS program'. If you use
   memory banks, all bank lengths must be even. If this is not the case,
   the programs do work from the editor but not compiled.
   Conclusion: - Extend odd banks by one byte using Bank Stretch.

4. A program that uses data lines does not work correctly when compiled:
   There must not be any comments after a data line. Data commands must be
   completely alone on a line. Otherwise the compiler will interprete
   these comments as data.
   Conclusion: - Write the comments into a seperate line.

   Even worse: a friend of mine was faced to a guru when trying to compile
   a program that uses aprox. 500 KB of data lines. As for now, I found no
   solution for this problem.

Bugs that are interesting for extension programmers:

1. Your commands or functions can only have a maximum of 9 parameters.
   Everything above this will not be put on -(a3).

2. All routines, that are jumped to directy by a token must be placed in
   the first 32 KB of code. Otherwise the command will crash. Additionally
   the distance of a RBras or RBccs jump must not exceed 32 KB.

<a id="shistory"></a>

## AMCAF history

AMCAF extension history.

V1.50beta 11-Jan-98
-------------------
- Found some wrongly assembled lines in the protracker vibrato table.
  If someone encountered some scarce problems the modules using
  fine-vibrato, these should be gone now.
- New c2p routine by Mikael Kalms. Up to 20%-80% faster and now also
  supports plane depth from 4 to 6!
- Fixed a little bug that wouldn't play samples longer than 64KB
  correctly (just a lsr.w instead of a lsr.l).
- Probably fixed a lot of bugs and spurious crashes introduced with the
  last beta.
- Fixed a newly introduced bug in Lzstr$ and Lsstr$.
- Found something new out about AMOS and fixed some bugs with editor-
  compiled programs.
- Added new transition commands:
  - Alloc Trans Source bank
  - Set Trans Source bank/address
  - Alloc Trans Map bank,width,height
  - Set Trans Map bank/address,width,height
  - Alloc Code Bank bank,size
  - Trans Screen Runtime scr,bitplane,ox,oy
  - Trans Screen Dynamic scr,bitplane,ox,oy
  - Trans Screen Static NOT YET IMPLEMENTED
  - Trans C2p chkbuf NOT YET IMPLEMENTED
  Some last words: Allocating the Code bank to small will cause memory
  overwrites. Wrong or stupid parameter values are not checked for
  validity. The Trans commands are still a bit slow (3 VBLs for a 256x256
  pixel transition with MC68060 and all caches disabled, 0.8 VBLs for the
  same transition with all caches turned on).
  Maybe the C2P Transition will be a bit better. Still need to update the
  c2p to a state-of-the-art routine (by Kalms).
- New for ALL PT sample commands: Entering a negative value as channel
  bitmask will trigger the Pt Free Voice function which will search for
  the best channel number to use for sample replaying. Really handy
  indeed! Pt Free Voice is rather complex:
  - it first checks if the bitmask is zero and if so, it returns 0.
  - then it checks, if only one bit was set in the mask and returns
    the same.
  - after that, it finds out if all four channels (or the ones given in
    the bitmask) are currently playing a sound. If so, it returns the
    channel bit of the sound which will cut off least.
  - if there are free channels, it verifies, if music is playing at all.
    If not, it returns the first free channel.
  - so for music is playing, it looks if the user has masked out a
    channel from the music (and which is currently free).
  - then it checks for the remaining channels are playing looping sounds
    for those will be not taken if necessary.
  - the last step finds out the shortest sound currently played on the
    channels, and then returns its channel bit.
  So you'll get the most of your game sfx and music if you're using the
  free voice function!
- New functions:
  - =Pt Free Voice[(bitmask)]
- Lzstr and Lsstr now return '9999...' if number is too large to fit into
  the given amount of digits.
- Sample&music-mixer changed to be more accurate (samples could have been
  cut off some VBLs too early if the music was playing at higher cia
  speeds than 125bmp) with cia-timed mods (at least this should have been
  the case in theory).
- The sample replayer now uses a 2 byte chip mem buffer to kill the
  high pitched beep sound sometimes appeared on samples which started
  with 2 non-zero bytes. FixSamBank should now no longer be required.
- Pt Raw Play can now play looping samples by giving a negative length.
- Implemented Vu Meters to AMAL. BUT it will ONLY work, if you REMOVE
  the original AMOS Music Extension. No other way to get it work!
- Added support for negative numbers in Lzstr$ and Lsstr$.

V1.44 27-Jul-96
---------------
- Fixed a bug in Ssave.
- Fixed a minor bug in Pt Play (cia speed is now reset to 125).
- Fixed a bug in Qsqr. Now bigger numbers than 0-65535 can be used.
  (Warning: starting with numbers >65535 it gets a bit inaccurate!
  Remember that the resolution of the result remains 8 bit!)

V1.43 02-Nov-96
---------------
- Added Sload/Ssave. Just the same commands like in the music
  extension. Now you can really remove it!
- Misc bugfixes.

V1.42 18-Oct-96
---------------
- Added support for Set Tmpras for Fellipse&Fcircle commands.
- Added type check for Protracker modules.

V1.41 29-Mar-96
---------------
- Fixed bug in Xfire.
- Misc changes.

V1.40 26-Dec-95
---------------
- New commands:
  - =Pt Cpattern
  - =Pt Cpos
  - =Pt Cinstr(channel)
  - =Pt Cnote(channel)
  - Pt Sam Freq channel,freq
  - =Vclip(v,lower To upper)
  - =Vin(v,lower To upper)
  - =Vmod(v,upper)
  - =Vmod(v,lower To upper)
  - =Insstr$(a$,b$,pos)
  - =Cutstr$(a$,pos1 To pos2)
  - =Replacestr$(a$,search$ To replace$)
  - =Itemstr$(a$,item)
  - =Itemstr$(a$,item,sep$)
  - =Qarc(dx,dy)
  - =Even(val)
  - =Odd(val)
  - =Ham Point(x,y)
  - Set Object Date file$,date,time
  - =Aga Detect
  - Pal Spread c1,rgb1 To c2,rgb2
  - =Ct String(time$)
  - =Cd String(date$)
  - C2p Convert st,wx,wy To screen,ox,oy
  - C2p Shift st,wx,wy To st2,shift
  - C2p Fire st,wx,wy To st2,sub
- Pal Set Screen now does a 'View' automatically.
- Another bug in Ptile Paste has been fixed.
- Sine-Table moved and shortened, so I save about 1536 Bytes,
  added Arctan-Table.
                                   
V1.31 03-Oct-95
---------------
- Actually, the bug hasn't been in Change Bank Font but in Make Bank Font.
  Although this bug is now fixed, I suppose you have to recreate all old
  bank fonts.
- Finally removed Rnc Unpack and =Rnp.
- Fixed a bug in Pt Stop which cut off the channels, even if no music had
  been playing.
- New commands:
  - Pt Continue
- Fixed a bug in Change Bank Font.
 
V1.30 31-Aug-95
---------------
- NEXT OFFICAL UPDATE.
- Various changes to get the extension under the 32 KB limit.
- Best Pen now supports EHB mode.
- Found a bug in the PlaySample routine and removed it.
- Removed a little bug in Pt Raw Play.
- Obvious bug in Extpath$ fixed (Thx Ben!)
- New commands:
  - =Best Pen($RGB[,c1 To c2])
  - Bzoom s1,x1,y1,x2,y2 To s2,x3,y3,m
  - =X Smouse
  - =Y Smouse
  - Limit Smouse [x1,y1 To x2,y2]
  - Smouse X x
  - Smouse Y y
  - Smouse Speed speed
  - =Smouse Key
  - =Xfire(port,button)
 
V1.19 30-Jun-95
---------------
- New commands:
  - Exchange Bob i1,i2
  - Exchange Icon i1,i2
 
V1.18 21-Mar-95
---------------
- NEXT OFFICAL UPDATE.
- Fixed a very scarcely appearing bug in Turbo Plot.

V1.17 16-Feb-95
---------------
- Little bug in the protracker routines: mask for FineSlideUp was $D
  instead of $F, what resulted in ignoring $2 slides. (Thx Patrick)

V1.16 29-Jan-95
---------------
- Little flaw appeared with the protracker cia replay code: Pt Cia Speed
  did not work correctly in compiled programs (but I don't know why!).
- Forgotten a Pt Sam command by mistake:
  - Pt Sam Volume [voice,] volume
- Reworked code a bit to ensure the demoversion is working (32 KB limit!).
- New palatte handling commands:
  - Pal Get Screen palnr,screen
  - Pal Set Screen palnr,screen
  - =Pal Get(palnr,colindex)
  - Pal Set palnr,colindex,colour

V1.1 28-Dec-94
--------------
- Adapted protracker replaycode to handle samples correctly.
- New commands:
  - =Pt Data Base
  - =Pt Instr Address(samnr)
  - =Pt Instr Length(samnr)
  - Pt Bank bank
  - Pt Raw Play voice,address,length,freq
  - Pt Instr Play samnr
  - Pt Instr Play voice,samnr[,freq]
  - Pt Sam Bank bank
  - Pt Sam Play samnr
  - Pt Sam Play voice,samnr[,freq]
  - Pt Sam Stop voice
- Tiny optimations on Ham Fade.
- One more bug in Ptile Paste removed.
- Bug in Speek: Speek did only allow even addresses.
- Silly bug in Lsstr$ and Lzstr$. Often they did produce trashed strings
  or didn't return from the call.

V1.0 16-Oct-94
--------------
- VERY FIRST RELEASE VERSION!
- Removed a few little bugs in the registration code.

V1.0ß 06-Oct-94
---------------
- Imploder Load didn't free the lock on a file if the loading process was
  successful. Fixed.

V1.0ß 22-Sep-94
---------------
- Every string allocation reserves two bytes more. Now there seem to be no
  problems with the stringbuffer anymore.

V1.0ß 28-Aug-94
---------------
- Ptile Paste had a bug. Removed.
- =Extpath$ did overwrite 32 KB of variable buffer using empty strings!!!
  Argl...
- =Ham Best completely rewritten. Works even better now.
- Added one more errorcheck to Coords Read and =Count Pixels.
- Coords Bank reserved a bank which was not completely used up and could
  hold exactly one pair of coordinates less.
- Coords Bank corrupted the memory or crashed when trying to create a bank
  with zero coordinates.
  The same with Splinters Bank. Bug removed.
- =Ham Best rewritten. Now it is much quicker as before!
  Hint came from Dr. Peter Kittel, now ex-employee of Commodore, Class 95.
- Protracker: Vumeter did not support the C-Command, for that reason
  =Pt Vu returned 64 as volume most of the time. Bug removed.
- Protracker: If a channel had been turned off, neither the signal could
  be received nor have speed and other commands been taken notice of.
  Implemented subroutine to handle this case.
- Renamed Secexp to Binexp and Seclog to Binlog.
- Protracker: added more init code. Now there should not be any flaws with
  funks or patternrepeats when playing many modules after each other.
- Moved database from chipram to fastram (really should have done this
  much earlier!).
- Due to the improvements named above, the code became to long to execute
  a certain branch command. This caused AMOS to crash. Bug removed.

V0.992ß 27-Jul-94
-----------------
- Yeah, got some vacations at last and can now fully concentrate on the
  manual. Releasedate of V1.0 was set to 1.9.94.
- Extension restructured, so ensure that all functions, that do have a
  token, are placed into the upper 32 KB. Now everything should work again
  correctly.
- Now you can switch between CIA and VBL timing while playing a module.
- Encountered a small bug in Bank Copy which was killed immediately.
- Reimplemented some commands: Rnc Unpack and =Rnp.
- New commands:
  - =Qsqr(value)
  - Bcircle x,y,r,c
- Added clipping for Turbo Plot, Shade Pix and Turbo Point. Now they are
  as secure as the normal Plot and Point commands.
- Improved the speed of Ham Fade a little.
- When reaching the end of a song, Pt Signal now reports $FF.

V0.991ß 18-Jul-94
-----------------
- New commands:
  - Set Rain Colour rainnr,colour
  - Rain Fade rainnr,colour
  - Rain Fade rainnr To rainnr

V0.990ß 01-Jul-94
-----------------
- Removed some command to shrink the size of the extension:
  - Rnc Unpack
  - =Rnp
- Deleted a few error messages from Io Error$.

V0.990ß 04-Jun-94
-----------------
- 'Created' a lethal bug by resorting the command groups. Seems to be an
  AMOS interior bug, but when I write Audio Lock and Audio Free at the end
  of the extension every other command should work. However, I could not
  test if every command works, so be warned! Strangely enough, all
  commands do work when compiled, which indicates the existence of this
  AMOS bug.
  DO NOT USE AUDIO LOCK OR AUDIO UNLOCK IN THE INTERPRETER MODE!!!
- New commands:
  Blitter Copy Limit screen
  Blitter Copy Limit x1,y1 To x2,y2
  Blitter Copy sc1,pl1 [,sc2,pl2 [,sc3,pl3]] To sc4,pl4 [,minterm]

V0.989ß 03-Jun-94
-----------------
- Discovered bugs in Blitter Fill and Blitter Clear which have caused some
  strange structure faults (e.g quiting from For-Next loops)

V0.989ß 03-Jun-94
-----------------
- Made Blitter Fill more secure.
- New commands:
  - Blitter Clear screen,plane
  - Blitter Clear screen,plane,x1,y1 To x2,y2
  - Blitter Wait
  - flag=Blitter Busy
  - Shade Pix x,y
  - Shade Pix x,y,planes

V0.988ß 02-Jun-94
-----------------
- At last Turbo Draw does now support clipping. Even implemented some
  special checkroutines for the blitter mode.

V0.988ß 31-May-94
-----------------
- Hurray!!! Splinters do now work totally correctly.
- Various optimations on Splinters and Td Stars.
  - Reduced memory consumption from 32 to 22 bytes per Splinter.
  - Reduced memory consumption from 16 to 12 bytes per Td Star.

V0.987ß 29-May-94
-----------------
- New commands, to satisfy Markus:
  - Make Bank Font bank
  - Change Bank Font bank
- New function:
  - =Cop Pos
- Little flaw: Pt Play did not reset the signal to zero.
- New functions:
  - =Vec Pos Z(x,y,z)
  - =Vec Pos Z
- Removed private commands.

V0.986ß 27-May-94
-----------------
- Added three quite private temporary commands (for a maildisk)
  Will be removed immediately after completing the maildisk.
  - Private A bank1,bank2,bitplane,maxrand
  - =Private B(bank2)
  - =Private C(bank2)
  DO NOT USE!!! Wrong use will crash the computer!!!
- New function:
  - =Qrnd(value) as replacement for Rnd... does not need Randomize and is
    faster.
- Error in the tokenlist caused a wrong syntax of Blitter Fill to be
  converted into Pt Play. Funny :)
- Found and removed an error in the Blitter Fill commands. Blitter Fill
  filled the screen one line to deep -> memory got corrupted.
- There was a bug in the vector rotation calculation with negative
  positions.

V0.986ß 25-May-94
-----------------
- New command to stop Bernd from complaining:
  - Change Print Font bank

V0.986ß 24-May-94
-----------------
- Completed the Vec Rot commands. Removed =Vec Rot Adr again.
- Vec Rot commands:
  - Vec Rot Pos posx,posy,posz
  - Vec Rot Angles angx,angy,angz
  - Vec Rot Precalc
  - =Vec Rot X(x,y,z)
  - =Vec Rot X
  - =Vec Rot Y(x,y,z)
  - =Vec Rot Y

V0.985ß 24-May-94
-----------------
- Removed a bug in Cd Date$. (Thx Bernd)
- Discovered and corrected a cheap bug in Blitter Fill screen,plane.
- Removed the bug in Turbo Draw when using the blitter mode.
- New commands:
  - =Qsin(angle,factor)                 angle must be between 0 and 1023
  - =Qcos(angle,factor)                 factor is the value that is
                                        multiplied with the sinus value.
  - Vec Rot Pos midx,midy,midz          Positions for the vector rotation.
  - Vec Rot Angles angx,angy,angz       Rotationangle.
- Still buggy:
  - Vec Rot Precalc                     Creation of the matrix
  - =Vec Rot X(x,y,z)                   Calculation of the new x-value
  - =Vec Rot Y(x,y,z)                   Calculation of the new y-value
- Added the function =Vec Rot Adr for testing reasons.

V0.984ß 21-May-94
-----------------
- New syntaxes for Blitter Fill:
  - Blitter Fill screen,plane
  - Blitter Fill screen,plane,x1,y1,x2,y2
  - Blitter Fill s1,p1 To s2,p2
  - Blitter Fill s1,p1,x1,y1,x2,y2 To s2,p2
- Turbo Draw doesn't draw on non-existing bitplanes anymore. (Thx Marc)
- Change Font now adds '.font' automatically, if needed. (Thx Markus)

I'm afraid to say that there are no history entries for the other half of
the year.

<a id="fagadtct"></a>

## Function: =Aga Detect

flag=Aga Detect

This is a simple function that checks for the existance of the AGA
chipset, found in A1200, A4000 and CD³² machines. It returns -1 (True),
if the new chipset is mounted or 0 (False) if the ecs or ocs chipsets
are still in use.

Note that it does not check for the kickstart version only, so A2000 and
A500 machines with kick 3.0 or higher will be detected as non-aga
correctly. This function is 100% system conform and won't hack the
hardware for it's result. Therefore, if the aga chipset had been disabled
either using the bootmenu or the "Setpatch NOAGA" command, it will return
that no aga is available.

<a id="famcafba"></a>

## Function: =Amcaf Base

adr=Amcaf Base

Returns the base address of the [AMCAF data base](#dstructur).

Also see:

[=Amcaf Length](#famcafle)

<a id="famcafle"></a>

## Function: =Amcaf Length

le=Amcaf Length

Returns the length of the [AMCAF data base](#dstructur).

Also see:

[=Amcaf Base](#famcafba)

<a id="famcafvs"></a>

## Function: =Amcaf Version$

Print Amcaf Version$

Returns the current AMCAF version number and a greetings list.

<a id="famoscli"></a>

## Function: =Amos Cli

n=Amos Cli

This function gives back the number of the cli process out of which the
program/AMOS has been started off or zero, if AMOS has been started from
Workbench. This gives you the choice to either interprete options from the
command line or from the tool types of the appropriate icon.

Also see:

[=Command Name$](#fcomname)
[=Tool Types$](#ftooltyp)

<a id="famostsk"></a>

## Function: =Amos Task

address=Amos Task

For advanced programmers. This function returns the address of the AMOS
task structure. Using this you can for example increase the task priority:

Areg(1)=Amos Task
Dreg(0)=3
dummy=Execall(-$12C)

This program sets the task priority to +3.

<a id="fasclong"></a>

## Function: =Asc.l

long=Asc.l(long$)

The Asc.l-function converts a [4 bytes](#dlong) long string back into a number.
This value can range between -2147483648 and +2147483647. If 'long$'
contains less than four characters, you will get an error message
immediately.

Also see:

[=Chr.l$](#fchrlong)
[=Asc.w](#fascword)
[=Chr.w$](#fchrword)

<a id="fascword"></a>

## Function: =Asc.w

word=Asc.w(word$)

Asc.w is used to convert a [word string](#dword) to a number value. Therefore the
result will be between 0 and 65535. If the length of 'word$' is less than
two, the function is aborted and an error message is returned.

Also see:

[=Chr.w$](#fchrword)
[=Asc.l](#fasclong)
[=Chr.l$](#fchrlong)

<a id="fbnkchec"></a>

## Function: =Bank Checksum

number=Bank Checksum(bank)
number=Bank Checksum(startaddress To endaddress)

This function calculates a checksum of a bank with specific contents.
Using this checksum you can find out if the contents of a bank has been
changed. The second version of this command calculates the checksum from
the memory area from startaddress to endaddress.

<a id="fbnkname"></a>

## Function: =Bank Name$

name$=Bank Name(bank)

The function Bank Name$ returns the name of bank number bank.

Also see:

[Bank Name](#cbnkname)

<a id="fbestpen"></a>

## Function: =Best Pen

pen=Best Pen($RGB)
pen=Best Pen($RGB,c1 To c2)

This function acquires the pen which is nearest to the colour $RGB.
Optionally, you can give the range to search for the best colour.
The Best Pen function can be used to recolour pictures with limited
palette.

<a id="fbinexpo"></a>

## Function: =Binexp

v=Binexp(a)

This function calculates the result of the exponential function 2^a, but
is much faster than the normal AMOS expression. The parameter a must lie
between 0 and 31.

Examples: Binexp(1)=2, Binexp(3)=8, Binexp(16)=65536, Binexp(24)=16777216

Also see:

[=Binlog](#fbinloga)
[=Lsl](#flogleft)
[=Lsr](#flogrigh)

<a id="fbinloga"></a>

## Function: =Binlog

a=Binlog(v)

Binlog is the reverse function to Binexp. It returns the logarithm to the
value 'v' with basis 2. 'v' therefore must be a power of 2, otherwise you
will get an error. Binlog is handy to get the number of bitplanes out from
the amount of colours of a screen (exception: [HAM](#dham)).

Examples: Binlog(2)=1, Binlog(8)=3, Binlog(65536)=16, Binlog(16777216)=24

Also see:

[=Binexp](#fbinexpo)
[=Lsl](#flogleft)
[=Lsr](#flogrigh)

<a id="fbltbusy"></a>

## Function: =Blitter Busy

flag=Blitter Busy

This function returns -1 (True), if the [Blitter chip](#dblitter) is currently busy
and working on a job, e.g is currently clearing a bitplane or drawing a
line etc. This can be used to wait for the end of the blitter activity,
although Blitter Wait is preferred in this case. Or you could Blitter Busy
to decide, if you want to do some more calculations using the processor or
better start the next blitter activity.

Also see:

[Blitter Wait](#cbltwait)
[Blitter Copy](#cbltcopy)
[Blitter Fill](#cbltfill)
[Blitter Clear](#cbltcler)

<a id="fcbluval"></a>

## Function: =Blue Val

b=Blue Val(rgb)

This function acquires the blue value of a colour. Together with the other
Val functions, you can separate the colour into its three contents.

Also see:

[=Red Val](#fcredval)
[=Green Val](#fcgreval)
[=Glue Colour](#fgluecol)

<a id="fcddates"></a>

## Function: =Cd Date$

date$=Cd Date$(date)

This simple function returns the date stamp 'date' as string in the format
'WWW DD-MMM-YY'.

Also see:

[=Current Date](#fcurdate)
[=Cd Year](#fcd_year)
[=Cd Month](#fcdmonth)
[=Cd Day](#fcd__day)
[=Cd Weekday](#fcdweekd)
[=Cd String](#fcd_strg)

<a id="fcd__day"></a>

## Function: =Cd Day

day=Cd Day(date)

This function returns the day in the month of the date stamp
parameter 'date'. The result 'day' will be a value between 1 and 31.

Also see:

[=Current Date](#fcurdate)
[=Cd Date$](#fcddates)
[=Cd Year](#fcd_year)
[=Cd Month](#fcdmonth)
[=Cd Weekday](#fcdweekd)
[=Cd String](#fcd_strg)

<a id="fcdmonth"></a>

## Function: =Cd Month

month=Cd Month(date)

Cd Month calculates the month of the argument 'date'. 'month' therefore
lies between 1 and 12.

Also see:

[=Current Date](#fcurdate)
[=Cd Date$](#fcddates)
[=Cd Year](#fcd_year)
[=Cd Day](#fcd__day)
[=Cd Weekday](#fcdweekd)
[=Cd String](#fcd_strg)

<a id="fcd_strg"></a>

## Function: =Cd String

date=Cd String(date$)

This function will evaluate the valid date in the date$ string and then
return the date stamp or -1, if the string has been invalid.

The string has to be in the format "DD-MMM-YY" or "DD-month-YY".
Strings like "Today" or "Tomorrow" are also allowed, weekday strings refer
to the last occurence of the week, i.e "Monday" represents last monday and
not next monday.

This command only works on OS2.0 and higher.

Also see:

[=Current Date](#fcurdate)
[=Cd Date$](#fcddates)
[=Cd Year](#fcd_year)
[=Cd Month](#fcdmonth)
[=Cd Day](#fcd__day)
[=Cd Weekday](#fcdweekd)

<a id="fcdweekd"></a>

## Function: =Cd Weekday

weekday=Cd Weekday(date)

Returns the weekday of the parameter 'date'. 'weekday' can range between
1 (monday) and 7 (sunday).

Also see:

[=Current Date](#fcurdate)
[=Cd Date$](#fcddates)
[=Cd Year](#fcd_year)
[=Cd Month](#fcdmonth)
[=Cd Day](#fcd__day)
[=Cd String](#fcd_strg)

<a id="fcd_year"></a>

## Function: =Cd Year

year=Cd Year(date)

Returns the year out from the DOS date stamp 'date'.

Also see:

[=Current Date](#fcurdate)
[=Cd Date$](#fcddates)
[=Cd Month](#fcdmonth)
[=Cd Day](#fcd__day)
[=Cd Weekday](#fcdweekd)
[=Cd String](#fcd_strg)

<a id="fchrlong"></a>

## Function: =Chr.l$

long$=Chr.l$(long)

The Chr.l$ function converts a number into a 4 bytes string. 'long' can be
any number you like. Using this technique, you can save numbers as normal
strings.

Also see:

[=Asc.l](#fasclong)
[=Chr.w$](#fchrword)
[=Asc.w](#fascword)

<a id="fchrword"></a>

## Function: =Chr.w$

word$=Chr.w$(word)

This function converts a number into a 2 bytes string. The upper 16 bits
of the value are ignored and therefore you should only use values from
0 to 65535.

Also see:

[=Asc.w](#fascword)
[=Chr.l$](#fchrlong)
[=Asc.l](#fasclong)

<a id="fcomname"></a>

## Function: =Command Name$

fname$=Command Name$

Returns the file name of the program under which AMOS or the compiled
program has been started. This is required for example to read the own
Tool Types.

Also see:

[=Tool Types$](#ftooltyp)
[=Amos Cli](#famoscli)

<a id="fcop_pos"></a>

## Function: =Cop Pos

address=Cop Pos

If you create your own copperlist, you can use this function to remember
the position of the next copper instruction. Later you can then write to
this address directly to change the values of a copper instruction.

<a id="fcounpix"></a>

## Function: =Cound Pixels

amount=Count Pixels(screen,colour,x1,y1 To x2,y2)

Counts the pixels in the rectangular are from x1,y1 to x2,y2 in the screen
with number screen, that don't have the colour index colour. This function
can be used to first acquire the number of points in this area and then to
reserve a coordinates bank.

Also see:

[Coords Bank](#ccrdbank)
[Coords Read](#ccrdread)

<a id="fcpu"></a>

## Function: =Cpu

chip=Cpu

The cpu function returns the identification number of the central
processing unit currently installed your amiga. This number can currently
lie between 68000 to 68060. Kickstart 1.3 knows only CPUs to the 68020.

Also see:

[=Fpu](#ffpu)

<a id="fct_hour"></a>

## Function: =Ct Hour

hour=Ct Hour(time)

Separates the hour from the packed time.

Also see:

[=Current Time](#fcurtime)
[=Ct Time$](#fcttimes)
[=Ct Minute](#fctminut)
[=Ct Second](#fctsecon)
[=Ct Tick](#fct_tick)
[=Ct String](#fct_strg)

<a id="fctminut"></a>

## Function: =Ct Minute

minute=Ct Minute(time)

Returns the number of minutes passed out from the longword 'time'.

Also see:

[=Current Time](#fcurtime)
[=Ct Time$](#fcttimes)
[=Ct Hour](#fct_hour)
[=Ct Second](#fctsecon)
[=Ct Tick](#fct_tick)
[=Ct String](#fct_strg)

<a id="fctsecon"></a>

## Function: =Ct Second

second=Ct Second(time)

The Ct Second function returns the number of seconds from the
parameter 'time'.

Also see:

[=Current Time](#fcurtime)
[=Ct Time$](#fcttimes)
[=Ct Hour](#fct_hour)
[=Ct Minute](#fctminut)
[=Ct Tick](#fct_tick)
[=Ct String](#fct_strg)

<a id="fct_strg"></a>

## Function: =Ct String

time=Ct String(time$)

This function will evaluate the valid time in the time$ string and then
return the time as number or -1, if the string has been invalid.

The time string has to be in the format "HH:MM" or "HH:MM:SS".

This command only works on OS2.0 and higher.

Also see:

[=Current Time](#fcurtime)
[=Ct Time$](#fcttimes)
[=Ct Hour](#fct_hour)
[=Ct Minute](#fctminut)
[=Ct Second](#fctsecon)
[=Ct Tick](#fct_tick)
[=Ct String](#fct_strg)

<a id="fct_tick"></a>

## Function: =Ct Tick

tick=Ct Tick(time)

Calculates the number of vertical blanks (=1/50 of a second) from the
parameter 'time'.

Also see:

[=Current Time](#fcurtime)
[=Ct Time$](#fcttimes)
[=Ct Hour](#fct_hour)
[=Ct Minute](#fctminut)
[=Ct Second](#fctsecon)
[=Ct String](#fct_strg)

<a id="fcttimes"></a>

## Function: =Ct Time$

time$=Ct Time$(time)

This very handy function converts the normal parameter 'time' into a
string in the format 'HH:MM:SS'.

Also see:

[=Current Time](#fcurtime)
[=Ct Hour](#fct_hour)
[=Ct Minute](#fctminut)
[=Ct Second](#fctsecon)
[=Ct Tick](#fct_tick)
[=Ct String](#fct_strg)

<a id="fcurdate"></a>

## Function: =Current Date

date=Current Date

Returns the current system date. This value counts the days passed since
1st January 1978. To separate the number of years, months and day there
certainly are many supporting function.

Also see:

[=Current Time](#fcurtime)
[=Cd Date$](#fcddates)
[=Cd Year](#fcd_year)
[=Cd Month](#fcdmonth)
[=Cd Day](#fcd__day)
[=Cd Weekday](#fcdweekd)
[=Cd String](#fcd_strg)

<a id="fcurtime"></a>

## Function: =Current Time

time=Current Time

This function contains the current time. This is NOT a value in the
standard DOS-format as this one would require two longwords.

For everyone, who's interested: the time is created out of
Wordswap(minutes)+ticks.

Also see:

[=Current Date](#fcurdate)
[=Ct Time$](#fcttimes)
[=Ct Hour](#fct_hour)
[=Ct Minute](#fctminut)
[=Ct Second](#fctsecon)
[=Ct Tick](#fct_tick)
[=Ct String](#fct_strg)

<a id="fcutstrg"></a>

## Function: =Cutstr$

newstr$=Cutstr$(s$,pos1 To pos2)

Cuts out the part of the string s$ from letter position pos1 to pos2.

Example:

Print Cutstr$("Hello dear Ben!",7 To 11) would generate 'Hello Ben!'.

Also see:

[=Insstr$](#finsstrg)
[=Replacestr$](#frplcstr)

<a id="fdskstat"></a>

## Function: =Disk State

flags=Disk State(directory$)

Acquires the current state of a disk drive. 'flags' is a bitmap which
holds two bits:

Bit
 0=0: The disk is not write protected, you can write onto the disk.
 0=1: The volume is write protected or is currently being validated.
 1=0: Currently the disk is not in use, nobody is reading or writing.
 1=1: The disk is currently in use.

If no disk is in the drive, it normally should return -1, but I'm afraid
in this case a requester will be opened with the title "No disk in
drive xxx:" which creates the error 'File not found'.

Please use the following workaround:

Request Off
Trap FLAGS=Disk State(DIRECTORY$)
Request On
If Errtrap Then FLAGS=-1

<a id="fdsktype"></a>

## Function: =Disk Type

type=Disk Type(directory$)

The Disk Type function returns the type of a directory. This value can be:

0: It is a real device (e.g. 'DF0:')
1: The path is a directory (assign) (e.g. 'LIBS:')
2: It is the name of a volume (e.g. 'Workbench2.0:')

Using this function you can filter specific disk types out of a device
list.

<a id="fdoshash"></a>

## Function: =Dos Hash

hash$=Dos Hash$(file$)

Returns the hash value of a file. Only for advanced users who want to read
directly from dos disks.

<a id="feven"></a>

## Function: =Even

flag=Even(value)

Returns True (-1), if a number is even or False (0), if a number is odd.

Also see:

[=Odd](#fodd)

<a id="fexanext"></a>

## Function: =Examine Next$

file$=Examine Next$

Gets information about the next [Object](#dobject) in the directory and returns
its name. More information can be acquired using the object functions. If
the end of the directory list is reached, 'file$' will contain an empty
string and the drawer will be closed.

Also see:

[Examine Dir](#cexamdir)
[Examine Stop](#cexastop)
[=Object Name$](#fobjname)
[=Object Type](#fobjtype)
[=Object Size](#fobjsize)
[=Object Blocks](#fobjblks)
[=Object Protection](#fobjprot)
[=Object Time](#fobjtime)
[=Object Date](#fobjdate)
[=Object Comment$](#fobjcomm)

<a id="fextpath"></a>

## Function: =Extpath$

newpath$=Extpath$(directory$)

Adds a slash to a pathname, if it is a directory. Handy if you want to
add a filename to a path.

Examples: Extpath$("DH2:AMOS")+"AMOSPro" returns "DH2:AMOS/AMOSPro",
          Extpath$("DH2:")+"AMOS" returns "DH2:AMOS".

Also see:

[=Path$](#fpathstr)
[=Filename$](#ffilname)

<a id="ffilname"></a>

## Function: =Filename$

file$=Filename$(pathfile$)

Cuts the filename out of an mixed path and file string.

Example: Filename$("DH2:AMOS/AMOSPro") results in "AMOSPro".

Also see:

[=Path$](#fpathstr)
[=Extpath$](#fextpath)

<a id="ffontsty"></a>

## Function: =Font Style

style=Font Style

This functions replaces the AMOS function Text Styles, because this one
does not return the multicoloured font bit (Bit 6). Apart from this,
Font Style is totally identical with the AMOS function.

Also see:

[Change Font](#cchafont)

<a id="ffpu"></a>

## Function: =Fpu

chip=Fpu

This function returns the number of an installed mathematic coprocessor
or 0, if none is fitted. As before, Kickstart 1.3 only knows the 68881.

On 68040/68060 machines, the cpu contains the fpu, so 68040 or 68060 will
be returned instead.

Also see:

[=Cpu](#fcpu)

<a id="fgluecol"></a>

## Function: =Glue Colour

rgb=Glue Colour(r,g,b)

Combines red, green and blue value of a colour to a normal colour value.

Also see:

[=Red Val](#fcredval)
[=Green Val](#fcgreval)
[=Blue Val](#fcbluval)

<a id="fcgreval"></a>

## Function: =Green Val

b=Green Val(rgb)

This function acquires the green value of a colour. Together with the
other Val functions, you can separate the colour into its three contents.

Also see:

[=Red Val](#fcredval)
[=Blue Val](#fcbluval)
[=Glue Colour](#fgluecol)

<a id="fhambest"></a>

## Function: =Ham Best

c=Ham Best(newrgb,oldrgb)

As you cannot achieve the desired colour by plotting only one pixel in
[HAM mode](#dham), you can use the Ham Best function to search the best colour
for the next dot. 'newrgb' holds the target colour and 'oldrgb' the colour
of the pixel exactly before the current dot. Please note that the current
screen must be the HAM screen!

Also see:

[=Ham Colour](#fhamcolo)
[=Ham Point](#fhampoin)

<a id="fhamcolo"></a>

## Function: =Ham Colour

newrgb=Ham Colour(c,oldrgb)

This function calculates the new colour value, that is created, when
plotting a pixel in colour 'c' directly behind the last point.

Also see:

[=Ham Best](#fhambest)
[=Ham Point](#fhampoin)

<a id="fhampoin"></a>

## Function: =Ham Point

rgb=Ham Point(x,y)

This function simplifies the process of finding the right colour of a
point at the coordinates x,y on a [HAM](#dham) screen. There's no need to
proceed from the left to the right until the right pixel value is found,
although it the Ham Colour method is a little bit faster when processing a
picture from left to the right, whereas Ham Point can access any point on
the screen indiviually without preprocessing.

If the point x,y is not on the screen, rgb will contain -1 instead of the
red-green-blue value of a pixel.

Also see:

[=Ham Colour](#fhamcolo)
[=Ham Best](#fhambest)

<a id="finsstrg"></a>

## Function: =Insstr$

newstr$=Insstr$(a$,b$,pos)

Inserts the string b$ at the position pos into string a$.

Example:

Print Insstr$("Hello Ben!","dear ",6) creates 'Hello dear Ben!'.

Also see:

[=Cutstr$](#fcutstrg)
[=Replacestr$](#frplcstr)

<a id="fioerror"></a>

## Function: =Io Error

errnumber=Io Error

The Io Error function gives back the number of the last DOS-error.

Also see:

[=Io Error$](#fioerstr)

<a id="fioerstr"></a>

## Function: =Io Error$

error$=Io Error$(errnumber)

Returns the string of the corresponding DOS error message. If no string
for the error number exists, an empty string will be returned. When using
Kickstart 2.0 not the interior list is taken but the localized strings of
the system.

Also see:

[=Io Error](#fioerror)

<a id="fitemstr"></a>

## Function: =Itemstr$

item$=Itemstr$(s$,itemnum)
item$=Itemstr$(s$,itemnum,sep$)

This is a very handy function that helps you to avoid little string arrays
where actually no are required. s$ contains a number of so called items,
which are numbered increasingly from zero onwards. Normally, the items are
seperated with a '|' character, but you can give your own single character
for seperation in the optional string sep$.

Empty strings for s$ are not allowed and will create an error message,
however, empty items can be used without hesitation. Trying to access a
item, that does not exist, will create an error aswell.

Example:

Print Itemstr$("Ben|Semprini|Petri|Andy",1) would return 'Semprini'.

Print Itemstr$("The quick brown fox",2," ") would return 'brown'.

Print Itemstr$("zero|one|two||four|five,5) would return 'five'.

Print "The weather is "+Itemstr$("great|fine|nice|not bad|rainy|awful|apocalyptic",WEATHER)

would have a similar effect to:

Dim W$(6)
For A=0 To 6
  Read W$(A)
Next
Print "The weather is "+W$(WEATHER)
[...]
Data "great","fine","nice","not bad","rainy","awful","apocalyptic"

<a id="flogleft"></a>

## Function: =Lsl

nv=Lsl(v,n)

Rotates the number 'v' to the left by 'n' bits. I.e that a number 'v',
which is shifted one bit to the left contains the value v*2, with two bits
v*4, with 3 bits v*8 etc. This function is very quick and should be used
instead of multiplications whereever possible.

Also see:

[=Lsr](#flogrigh)

<a id="flogrigh"></a>

## Function: =Lsr

nv=Lsr(v,n)

Shifts a number 'v' to the right by 'n' bits. This function does the same
as a division by 2^n, but is much quicker.

Also see:

[=Lsl](#flogleft)

<a id="flsstrin"></a>

## Function: =Lsstr$

s$=Lsstr$(v,n)

Similar to the AMOS function Str$, Lsstr$ creates a string out of a
number. However, with Lsstr$ the number will be created right justified
with 'n' digits, leading zeros are replaced by spaces. The sign of the
number will not be printed. 'n' must lie within 1 to 10.

Also see:

[=Lzstr$](#flzstrin)

<a id="flzstrin"></a>

## Function: =Lzstr$

s$=Lzstr$(v,n)

This function is nearly identical to Lsstr$ with the difference that
leading zeros are not replaced by space characters. The parameter 'n' sets
the number of digits the string should contain and can range from 1 to 10.

Also see:

[=Lsstr$](#flsstrin)

<a id="fmixcolo"></a>

## Function: =Mix Colour

newrgb=Mix Colour(rgb1,rgb2)
newrgb=Mix Colour(oldrgb,addrgb,lrgb To urgb)

The first version of the function mixes the two colours 'rgb1' and 'rgb2'
and returns the resulting colour value.

The second version behaves a little bit differently: The colour 'addrgb'
is added to the colour value 'oldrgb', if 'addrgb' is a positive value or
subtracted, if the value is negative. 'lrgb' defines the lower and 'urgb'
the upper boundary of the allowed resulting colours.

<a id="fnofunct"></a>

## Function: =Nfn

dummy=Nfn

This 'function' returns nothing useful. It's only used, like Nop, in speed
testing routines.

Also see:

[Nop](#cnoopera)

<a id="fodd"></a>

## Function: =Odd

flag=Odd(value)

Returns True (-1), if a number is odd or False (0), if a number is even.

Also see:

[=Even](#feven)

<a id="fobjblks"></a>

## Function: =Object Blocks

numblks=Object Blocks
numblks=Object Blocks(pathfile$)

Object Blocks returns the number of blocks the current or the [Object](#dobject)
'pathfile$' uses on a specific volume.

Also see:

[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjcomm"></a>

## Function: =Object Comment$

comment$=Object Comment$
comment$=Object Comment$(pathfile$)

This function gives back the file note of an [Object](#dobject).

Also see:

[Set Object Comment](#cobjcomm)
[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjdate"></a>

## Function: =Object Date

date=Object Date
date=Object Date(pathfile$)

Returns the date stamp of an [Object](#dobject) as numeric value, which can be
separated into year, month, day and weekday using the date functions.

Also see:

[=Cd Date$](#fcddates)
[=Cd Year](#fcd_year)
[=Cd Month](#fcdmonth)
[=Cd Day](#fcd__day)
[=Cd Weekday](#fcdweekd)
[Set Object Date](#cobjdate)
[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjname"></a>

## Function: =Object Name$

file$=Object Name$
file$=Object Name$(pathfile$)

Object Name$ returns the name of the [Object](#dobject) 'pathfile$'. This function
is similar to the Filename$-Function, but acts quite differently as the
existance of the file is checked, more information about the object is
stored in the info block and the name is read out with correct case. The
first version of Object Name$ gets the name of the object from the info
block which has been read out earlier using Examine Object.

Also see:

[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjprot"></a>

## Function: =Object Protection

prot=Object Protection
prot=Object Protection(pathfile$)

Object Protection returns the [Protection flags](#dprotflags) of an [Object](#dobject). The
Object Protection$ function converts this numeric value into a string in
the format "hsparwed".

Also see:

[Protect Object](#cprotobj)
[=Object Protection$](#fobjprst)
[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjprst"></a>

## Function: =Object Protection$

prot$=Object Protection$(prot)

Converts the [Protection Flags](#dprotflags) into a string in "hsparwed" format.

Also see:

[Protect Object](#cprotobj)
[=Object Protection](#fobjprot)

<a id="fobjsize"></a>

## Function: =Object Size

length=Object Size
length=Object Size(pathfile$)

Returns the size of a Object. The first version copies the size directly
from the current info block, the second version fills the info block with
other datas of the [Object](#dobject) 'pathfile$'.

Also see:

[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjtime"></a>

## Function: =Object Time

time=Object Time
time=Object Time(pathfile$)

Returns the time of the last write access to an [Object](#dobject). This value
'time' can be converted into hours, minutes, seconds and ticks using
the time functions.

Also see:

[=Ct Time$](#fcttimes)
[=Ct Hour](#fct_hour)
[=Ct Minute](#fctminut)
[=Ct Second](#fctsecon)
[=Ct Tick](#fct_tick)
[Set Object Date](#cobjdate)
[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fobjtype"></a>

## Function: =Object Type

type=Object Type
type=Object Type(pathfile$)

This functions finds out if 'pathfile$' or the object whose data is
currently in the info block is a directory or a file. In case of file
'type' is greater than 0 and smaller than 0 if the [Object](#dobject) is a drawer.

Also see:

[Examine Object](#cexamobj)
[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="fpgetcol"></a>

## Function: =Pal Get

colour=Pal Get(palnr,index)

This function reads the value of the colour with the number index 'index'
from the internal stored palette buffer 'palnr'.

Also see:

[Pal Set Screen](#cpsetscr)
[Pal Get Screen](#cpgetscr)
[Pal Set](#cpsetcol)

<a id="fpathstr"></a>

## Function: =Path$

pathway$=Path$(pathfile$)

Returns the pathname part of a mixed path-filename string. Could be used
as a kind of Parent$-Function too.

Example: Path$("DH2:AMOS/AMOSPro") returns "DH2:AMOS".

Also see:

[=Filename$](#ffilname)
[=Extpath$](#fextpath)

<a id="fpatmatc"></a>

## Function: =Pattern Match

flag=Pattern Match(sourcestring$,pattern$)

Pattern Match checks, if the string 'sourcestring$' matches the
pattern 'pattern$'. Is this the case, so True (-1) will be returned
otherwise False (0). The pattern may contain any regular DOS jokers a
asterik (*) will be converted into '#?' automatically.

This command only works on OS2.0 and higher.

<a id="ffourfir"></a>

## Function: =Pfire

flag=Pfire(j)

Corresponds to the Fire(j) function for normal joysticks. Fire(j) tests,
if the firebutton for the joystick in the parallel port is currently
pressed. If this is the case, True (-1) will be returned otherwise
False (0).

Also see:

[=Pjoy](#ffourjoy)
[=Pjup](#ffourjup)
[=Pjleft](#ffourjle)
[=Pjdown](#ffourjdo)
[=Pjright](#ffourjri)

<a id="ffourjdo"></a>

## Function: =Pjdown

flag=Pjdown(j)

Corresponds to the Jdown(j) function for normal joysticks. Pjdown tests,
if the joystick in the parallel port is currently pressed down. If this
is the case, True (-1) will be returned otherwise False (0).

Also see:

[=Pjoy](#ffourjoy)
[=Pjup](#ffourjup)
[=Pjleft](#ffourjle)
[=Pjright](#ffourjri)
[=Pfire](#ffourfir)

<a id="ffourjle"></a>

## Function: =Pjleft

flag=Pjleft(j)

Corresponds to the Jleft(j) function for normal joysticks. Pjleft tests,
if the joystick in the parallel port is currently pressed to the left. If
this is the case, True (-1) will be returned otherwise False (0).

Also see:

[=Pjoy](#ffourjoy)
[=Pjup](#ffourjup)
[=Pjdown](#ffourjdo)
[=Pjright](#ffourjri)
[=Pfire](#ffourfir)

<a id="ffourjoy"></a>

## Function: =Pjoy

bitmap=Pjoy(j)

Corresponds to the AMOS function Joy, with the difference, that one of the
parallel port joysticks is checked instead of the normal joysticks.
'j' must be either 0 or 1.

The value 'bitmap' contains the following bits:

Bit 0=1: the joystick is currently moved up
Bit 1=1: the joystick is currently moved down
Bit 2=1: the joystick is pressed to the left
Bit 3=1: the joystick is pressed to the right
Bit 4=1: the fire button has been pressed

Also see:

[=Pjup](#ffourjup)
[=Pjdown](#ffourjdo)
[=Pjleft](#ffourjle)
[=Pjright](#ffourjri)
[=Pfire](#ffourfir)

<a id="ffourjri"></a>

## Function: =Pjright

flag=Pjright(j)

Corresponds to the Jright(j) function for normal joysticks. Pjright tests,
if the joystick in the parallel port is currently pressed to the right. If
this is the case, True (-1) will be returned otherwise False (0).

Also see:

[=Pjoy](#ffourjoy)
[=Pjup](#ffourjup)
[=Pjdown](#ffourjdo)
[=Pjleft](#ffourjle)
[=Pfire](#ffourfir)

<a id="ffourjup"></a>

## Function: =Pjup

flag=Pjup(j)

Corresponds to the Jup(j) function for normal joysticks. Pjup tests,
if the joystick in the parallel port is currently pressed up. If
this is the case, True (-1) will be returned otherwise False (0).

Also see:

[=Pjoy](#ffourjoy)
[=Pjdown](#ffourjdo)
[=Pjleft](#ffourjle)
[=Pjright](#ffourjri)
[=Pfire](#ffourfir)

<a id="fptcinst"></a>

## Function: =Pt Cinstr

num=Pt Cinstr(chan)

Pt Cinstr returns the instrument being played on music channel chan. num
is therefore a value between 0 and 31, whereas 0 tells you, that no
sample has been trigged at that very moment.

Also see:

[=Pt Cpattern](#fptcpatt)
[=Pt Cpos](#fptcposi)
[=Pt Cnote](#fptcnote)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)

<a id="fptcnote"></a>

## Function: =Pt Cnote

num=Pt Cnote(chan)

Pt Cnote returns the frequency of an instrument being played on music
channel chan at that very moment.

Also see:

[=Pt Cpattern](#fptcpatt)
[=Pt Cpos](#fptcposi)
[=Pt Cinstr](#fptcinst)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)

<a id="fptcpatt"></a>

## Function: =Pt Cpattern

songpos=Pt Cpattern

This function returns the current pattern/song position. This can be used
to restart a song at a given position when you stopped the music with
Pt Stop.

Also see:

[=Pt Cpos](#fptcposi)
[=Pt Cinstr](#fptcinst)
[=Pt Cnote](#fptcnote)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)

<a id="fptcposi"></a>

## Function: =Pt Cpos

row=Pt Cpos

This function returns the current 'row' of the songs current pattern. The
returned value is a number between 0 and 63.

Also see:

[=Pt Cpattern](#fptcpatt)
[=Pt Cinstr](#fptcinst)
[=Pt Cnote](#fptcnote)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)

<a id="fptdatab"></a>

## Function: =Pt Data Base

address=Pt Data Base

Returns the starting address of the internal datatable of the protracker
replay routine. Please don't write into this area randomly.

<a id="fptinadr"></a>

## Function: =Pt Instr Address

address=Pt Instr Address(instnr)

Returns the starting address of the music instrument with the
number 'instnr' of the current Protracker module.

Also see:

[=Pt Instr Length](#fptinlen)
[Pt Bank](#cpt_bank)
[Pt Instr Play](#cptinspl)

<a id="fptinlen"></a>

## Function: =Pt Instr Length

length=Pt Instr Length(instnr)

Returns the length of the instrument 'instnr'.

Also see:

[=Pt Instr Address](#fptinadr)
[Pt Bank](#cpt_bank)
[Pt Instr Play](#cptinspl)

<a id="fptsigna"></a>

## Function: =Pt Signal

signal=Pt Signal

The various music trackers Soundtracker, Noisetracker, Startrekker or
Protracker feature effect commands e.g to change the volume of a note,
or for portamento. Example for a Protracker noteline:
setzen oder für Portamento. Beispiel an einer Protracker Notenzeile:

00 C-1 1000 --- 0000 G-2 2000 --- 0000
   ^ ^ ^
   | | `-----------------------------------------------.
   | `---------------------.                           |
   `--------------.        |                           |
   Plays the note C in the 1st octave using instrument 1.

Additionally, you can use effects, e.g like in this line here:

00 C-1 1C20 --- 0F04 G-2 2E00 --- 0801
        ^^^      ^^^      ^^^      ^^^
Set vol.to $20  Speed  Filter Off  \|/
         (=32)  4 VBLs              Y
 .----------------------------------'
 |
Now this is a effect, which is unused in all trackers. It has been left
free to synchronize various events to the music. The value behind the '8'
is directly transferred to Pt Signal, when the music reaches the specific
point. (Warning! The value used in Protracker is entered as hex number!)

With this technique you can wait for a special accustic signal, or sync
some kind of musician bobs to the music.

If there is no signal waiting, zero is returned in the varible 'signal'.
After using Pt Signal, the old signal will be cleared. Pt Signal can only
keep one value at once, i.e if the last value hasn't been read out, the
next signal will overwrite the last one and is therefore lost.

If the end of the music is reached an $FF signal is sent automatically.

Also see:

[Pt Cia Speed](#cptspeed)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Volume](#cptvolum)
[Pt Voice](#cptvoice)
[=Pt Vu](#fptvumet)
[=Pt Cpattern](#fptcpatt)
[=Pt Cinstr](#fptcinst)
[=Pt Cnote](#fptcnote)

<a id="fptvumet"></a>

## Function: =Pt Vu

vol=Pt Vu(channel)

Allows you to read the current volume of channel number 'channel'. If a
new note is played, 'vol' contains the volume level else 0.

Also see:

[Pt Cia Speed](#cptspeed)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Volume](#cptvolum)
[Pt Voice](#cptvoice)
[=Pt Signal](#fptsigna)
[=Pt Cpattern](#fptcpatt)
[=Pt Cinstr](#fptcinst)
[=Pt Cnote](#fptcnote)

<a id="fqarc"></a>

## Function: =Qarc

angle=Qarc(deltax,deltay)

This function will return the angle to a point at the relative coordinates
deltax,deltay. angle is in the same format used with Qsin and Qcos, so an
angle of 360 degree is equalent to 1024. Moreover this function is *very*
fast and rather accurate.

It's normally used for all kinds of 'aiming-at' routines, e.g to get the
angle from one player to another to shoot a missle at ;-)

Also see:

[=Qsin](#fqsine)
[=Qcos](#fqcosine)

<a id="fqcosine"></a>

## Function: =Qcos

value=Qcos(angle,radius)

This is a function to replace the original cosine function of AMOS. It is
faster and even allows you to multiple the value with the a parameter.
Moreover, no maths libraries are required. However, the angle of the sine
'angle' is not value in radians or degrees, but with Qcos, an angle of
360 degrees equals a value of 1024.

Also see:

[=Qsin](#fqsine)
[=Qarc](#fqarc)

<a id="fqrandom"></a>

## Function: =Qrnd

value=Qrnd(maxrnd)

Qrnd is totally identical to the Rnd function, with the only difference,
that this one is much faster.

<a id="fqsine"></a>

## Function: =Qsin

value=Qsin(angle,radius)

This is a function to replace the original sine function of AMOS. It is
faster and even allows you to multiple the value with the a parameter.
Moreover, no maths libraries are required. However, the angle of the sine
'angle' is not value in radians or degrees, but with Qsin, an angle of
360 degrees equals a value of 1024.

Also see:

[=Qcos](#fqcosine)
[=Qarc](#fqarc)

<a id="fqsquare"></a>

## Function: =Qsqr

root=Qsqr(value)

Calculates the square root from the value 'value'. However, it only works
with integer and is faster than the AMOS square root function =Sqr.

<a id="fcredval"></a>

## Function: =Red Val

r=Red Val(rgb)

This function acquires the red value of a colour. Together with the other
Val functions, you can separate the colour into its three contents.

Also see:

[=Green Val](#fcgreval)
[=Blue Val](#fcbluval)
[=Glue Colour](#fgluecol)

<a id="frplcstr"></a>

## Function: =Replacestr$

newstr$=Replacestr$(s$,search$ To replace$)

This function searches in the string s$ for occurences of search$ and
replaces them with the string replace$.

Also see:

[=Insstr$](#finsstrg)
[=Cutstr$](#fcutstrg)

<a id="frgbtaga"></a>

## Function: =Rgb To Rrggbb

rrggbb=Rgb To Rrggbb(rgb)

This function calculates a 12 bit colour value into a 24 bit AGA value.
The missing bits are set to zeros. Using this colour format you can
assign 256 different colour values each to the red, green or blue part,
that is 16777216 different values in total.

Also see:

[Rrggbb To Rgb](#fagatrgb)

<a id="fagatrgb"></a>

## Function: =Rrggbb To Rgb

rgb=Rrggbb To Rgb(rrggbb)

The function Rrggbb To Rgb converts a 24 bit colour value into a 12 bits
value, the other 12 bits will be discarded.

Also see:

[Rgb To Rrggbb](#frgbtaga)

<a id="fscanstr"></a>

## Function: =Scanstr$

key$=Scanstr$(scancode)

This very handy function returns the name of a key according to the
parameter 'scancode', which can be fetched using the AMOS Scancode
function. If there is no key for the scancode, an empty string will be
returned.

<a id="fscrbitm"></a>

## Function: =Scrn Bitmap

bitmap=Scrn Bitmap

Fetches the address of the graphics/bitmap structure of the current AMOS
screen.

Also see:

[=Scrn Rastport](#fscrrast)
[=Scrn Layer](#fscrlaye)
[=Scrn Layerinfo](#fscrlayi)
[=Scrn Region](#fscrregi)

<a id="fscrlaye"></a>

## Function: =Scrn Layer

layer=Scrn Layer

Fetches the address of the graphics/layer structure of the current AMOS
screen.

Also see:

[=Scrn Rastport](#fscrrast)
[=Scrn Bitmap](#fscrbitm)
[=Scrn Layerinfo](#fscrlayi)
[=Scrn Region](#fscrregi)

<a id="fscrlayi"></a>

## Function: =Scrn Layerinfo

layerinfo=Scrn Layerinfo

Fetches the address of the graphics/LayerInfo structure of the current
AMOS screen.

Also see:

[=Scrn Rastport](#fscrrast)
[=Scrn Bitmap](#fscrbitm)
[=Scrn Layer](#fscrlaye)
[=Scrn Region](#fscrregi)

<a id="fscrrast"></a>

## Function: =Scrn Rastport

rastport=Scrn Rastport

Fetches the address of the graphics/rastport structure of the current AMOS
screen.

Also see:

[=Scrn Bitmap](#fscrbitm)
[=Scrn Layer](#fscrlaye)
[=Scrn Layerinfo](#fscrlayi)
[=Scrn Region](#fscrregi)

<a id="fscrregi"></a>

## Function: =Scrn Region

region=Scrn Region

Fetches the address of the graphics/region structure of the current AMOS
screen.

Also see:

[=Scrn Rastport](#fscrrast)
[=Scrn Bitmap](#fscrbitm)
[=Scrn Layer](#fscrlaye)
[=Scrn Layerinfo](#fscrlayi)

<a id="fsgndeek"></a>

## Function: =Sdeek

value=Sdeek(address)

The Sdeek function reads a [Word](#dword) from the EVEN memory address
'address', exactly the AMOS function Deek. However, Bit 15 is used as sign
bit so the result will be a value between -32678 and 32677. You are
adviced to use this function instead of Deek if you have doked a negative
value into memory and then want to read it again.

Also see:

[=Speek](#fsgnpeek)

<a id="fsmousek"></a>

## Function: =Smouse Key

mk=Smouse Key

Returns the state of the mouse buttons in port 1.

Bit
 0 left mouse button
 1 right mouse button
 2 middle mouse button

Also see:

[=X Smouse](#fxsmouse)
[=Y Smouse](#fysmouse)
[Limit Smouse](#climsmou)
[Smouse Speed](#csmouspd)
[Smouse X](#csmousex)
[Smouse Y](#csmousey)

<a id="fsgnpeek"></a>

## Function: =Speek

value=Speek(address)

The Speek function reads a [Byte](#dbyte) from the memory address 'address',
exactly the AMOS function Peek. However, Bit 7 is used as sign
bit so the result will be a value between -128 and 127. You are
adviced to use this function instead of Peek if you have poked a negative
value into memory and then want to read it again.

Also see:

[=Sdeek](#fsgndeek)

<a id="fspliact"></a>

## Function: =Splinters Active

amount=Splinters Active

This function returns how many Splinters are active at the moment. This
can be used to know when the animation has finished.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)

<a id="ftooltyp"></a>

## Function: =Tool Types$

tools$=Tool Types$(filename$)

With this function you can acquire the Tool Type of an icon. The supplied
file 'filename$' must not have a '.info' appended! The various Tool Types
are seperated by a line feed character (Chr$(10)). So they can be printed
out easily using Print. 

The name of your own program can be fetched using Command Name$.

Also see:

[=Command Name$](#fcomname)

<a id="fturpoin"></a>

## Function: =Turbo Point

c=Turbo Point(x,y)

This functions requests the colour of the pixel at the coordinates x,y.
It is much faster as the normal Point instruction.

Also see:

[Turbo Plot](#cturplot)

<a id="fvalclip"></a>

## Function: =Vclip

newval=Vclip(val,lower To upper)

The Vclip function works like a Min(Max(val,lower),upper) expression, it
restricts a value val into its lower and upper boundaries.

Also see:

[=Vin](#fvaluein)
[=Vmod](#fvalmodu)

<a id="fvecrotx"></a>

## Function: =Vec Rot X

newx=Vec Rot X(x,y,z)
newx=Vec Rot X

This function calculates the X coordinate, which results in the vector
rotation of a three dimensional point x,y,z around all three axis. This
coordinate is automatically projected from 3D to 2D by dividing it through
the distance.

If you call the function with the parameters x,y,z all three new
coordinates are calculated, i.e the y,z position too. If you require the
Y coordinate too, when simply write the Vec Rot Y command WITHOUT the
parameters. Same with Vec Rot Z.

This parameter system can be also used on Vec Rot Y in the same way.

Also see:

[=Vec Rot Y](#fvecroty)
[=Vec Rot Z](#fvecrotz)
[Vec Rot Pos](#cvecrpos)
[Vec Rot Angles](#cvecrang)
[Vec Rot Precalc](#cvecrpre)

<a id="fvecroty"></a>

## Function: =Vec Rot Y

newy=Vec Rot Y(x,y,z)
newy=Vec Rot Y

Calculates the new Y coordinate after the rotation. For more detailed
information see Vec Rot X.

Also see:

[=Vec Rot X](#fvecrotx)
[=Vec Rot Z](#fvecrotz)
[Vec Rot Pos](#cvecrpos)
[Vec Rot Angles](#cvecrang)
[Vec Rot Precalc](#cvecrpre)

<a id="fvecrotz"></a>

## Function: =Vec Rot Z

newz=Vec Rot Z(x,y,z)
newz=Vec Rot Z

Calculates the new Z coordinate after the rotation. Please note that the
current camera position has already been added to this value. The Z
coordinate can be used to sort objects by distance or to evaluate a
brightness level.

More information on the syntaxes or the parameters see Vec Rot X.

Also see:

[=Vec Rot X](#fvecrotx)
[=Vec Rot Y](#fvecroty)
[Vec Rot Pos](#cvecrpos)
[Vec Rot Angles](#cvecrang)
[Vec Rot Precalc](#cvecrpre)

<a id="fvaluein"></a>

## Function: =Vin

flag=Vin(val,lower To upper)

The Vin function will create an exquisite bottle of wine... Hehe ;-)

No, actually, this function will check, if a value lies between lower
and upper. Is this the case, flag will return True (-1), otherwise
False (0).

Also see:

[=Vclip](#fvalclip)
[=Vmod](#fvalmodu)

<a id="fvalmodu"></a>

## Function: =Vmod

newval=Vmod(val,upper)
newval=Vmod(val,lower To upper)

Vmod restricts a value val into the lower and upper boundaries. However,
it does it in another way compared to Vclip. If val exceeds upper by 1,
it will be set to lower, if it exceeds upper by 2, it will be set to
lower+1. If it goes deeper than lower by 1, it will be set to upper and
so on.

So this function is not the same as

Add val,delta,lower To upper

If lower is omitted, zero is taken as lower boundary.

Example:

Print Vmod(100,50 To 150) would return 100 (should be clear).

Print Vmod(151,50 To 150) would return 50.

Print Vmod(152,50 To 150) would return 51.

Print Vmod(49,50 To 150) would return 150.

Print Vmod(0,50 To 150) would return 101.

Also see:

[=Vclip](#fvalclip)
[=Vin](#fvaluein)

<a id="fwrdswap"></a>

## Function: =Wordswap

newval=Wordswap(value)

Swaps the upper and the lower [Word](#dword) of a value.

<a id="fxraster"></a>

## Function: =X Raster

x=X Raster

This function returns the current X position of the raster beam in
hardware coordinates. This value is not very accurate because the
raster beam is very fast, sigh.

Also see:

[Raster Wait](#craswait)
[=Y Raster](#fyraster)

<a id="fxsmouse"></a>

## Function: =X Smouse

xpos=X Smouse

Returns the x coordinate of the second mouse.

Also see:

[=Y Smouse](#fysmouse)
[=Smouse Key](#fsmousek)
[Limit Smouse](#climsmou)
[Smouse Speed](#csmouspd)
[Smouse X](#csmousex)
[Smouse Y](#csmousey)

<a id="fextfire"></a>

## Function: =Xfire

flag=Xfire(port,button)

This function returns the state of a possibly existant second fire button
on a joystick or joypad in the gameport numbered port. If the lowlevel-
library is available, all the other buttons can be checked aswell. This
library is distributed along with Kickstart 3.1 but even works with
2.0.

Possible values for the button parameter:

0: This is the normal fire button which exists on every joystick.
1: Second fire button on a few joysticks or the blue button on a gamepad.

2: Yellow fire button on a CD³² controller.
3: Green fire button
4: Reverse button on the gamepad
5: Forward button
6: Play/Pause button

<a id="fyraster"></a>

## Function: =Y Raster

y=Y Raster

Y Raster returns the current Y position of the raster beam. This function
can be used to see how many rasterlines a specific part of a program
takes.

Also see:

[Raster Wait](#craswait)
[=X Raster](#fxraster)

<a id="fysmouse"></a>

## Function: =Y Smouse

ypos=Y Smouse

Returns the y coordinate of the second mouse.

Also see:

[=X Smouse](#fxsmouse)
[=Smouse Key](#fsmousek)
[Limit Smouse](#climsmou)
[Smouse Speed](#csmouspd)
[Smouse X](#csmousex)
[Smouse Y](#csmousey)

<a id="camcafaa"></a>

## Command: Amcaf Aga Notation

Amcaf Aga Notation On
Amcaf Aga Notation Off

Normally, AMCAF commands, which take colour values as parameter, use a
normal 12 bit colour value in the format $RGB. Since machines like the
[A4000/A1200](#dagaamiga) there are 24 bit colour values in the Format $RRGGBB.

After calling Amcaf Aga Notation On, all AMCAF commands and functions take
24 bit values, except [Rrrggbb To Rgb](#fagatrgb) and [Rgb To Rrggbb](#frgbtaga).

The default setting is 12 bit.

<a id="caudfree"></a>

## Command: Audio Free

Audio Free

Using Audio Free you can free previously allocated sound channels again.

Also see:

[Audio Lock](#caudlock)

<a id="caudlock"></a>

## Command: Audio Lock

Audio Lock

When you start AMOS, the audio.device will be not informed, that AMOS
wants to have the audio channels. Due to this flaw, other programs that
are running in the background can replay a sound at any time, which will
irritate the AMOS sound system. To avoid this and to by more system
friendly, you can use the command Audio Lock to reserve the sound
channels. As AMOS has a bug, you'll have to do it like that:

Extremove 1 : Rem removes music extension
Trap Audio Lock : Rem reserves the audio channels
ERR=Errtrap : Rem tests, if audio lock was successful
Extreinit 1 : Rem initialises the music extension again
Extdefault 1 : Rem calls the default routine of the extension

This Routine should be called as soon as possible and BEFORE you start
to play music or sounds.

If the audiochannels are already in use by any other program, ERR holds
an error code, otherwise zero.

To free the channels again, you have to call Audio Free.

Also see:

[Audio Free](#caudfree)
[Extremove](#cextremo)
[Extreinit](#cextrein)
[Extdefault](#cextdefa)

<a id="cbcodadd"></a>

## Command: Bank Code Add

Bank Code Add.b code,bank
Bank Code Add.b code,startaddress To endaddress
Bank Code Add.w code,bank
Bank Code Add.w code,startaddress To endaddress

Encodes the bank numbered 'bank' using the key code 'code'. To decode the
bank, the same instruction has to be used with the negative key code.

Note: This encoding routine works by adding the value and is therefore
very easy to decode.

Also see:

[Bank Code Xor.y](#cbcodxor)
[Bank Code Mix.y](#cbcodmix)

<a id="cbcodmix"></a>

## Command: Bank Code Mix

Bank Code Mix.b code,bank
Bank Code Mix.b code,startaddress To endaddress
Bank Code Mix.w code,bank
Bank Code Mix.w code,startaddress To endaddress

The third possibility to encode a bank, is with Bank Code Mix. So coded
banks should be hard to decode. To decode a bank you should use the same
key code as seen with Bank Code Xor before.

Also see:

[Bank Code Add.y](#cbcodadd)
[Bank Code Xor.y](#cbcodxor)

<a id="cbcodrol"></a>

## Command: Bank Code Rol

Bank Code Rol.b code,bank
Bank Code Rol.b code,startaddress To endaddress
Bank Code Rol.w code,bank
Bank Code Rol.w code,startaddress To endaddress

Using these commands every bit in each byte or word is rotated by 'code'
bits to the left. (Rol=RotateLeft). This results in a restriction of the
'code' parameter from 1 to 7 on '.b' and 1 to 15 on '.w' command version.
To decode a bank either use the negative code with the same instruction or
the same key code along with the Bank Code Ror command.

Also see:

[Bank Code Ror.y](#cbcodror)

<a id="cbcodror"></a>

## Command: Bank Code Ror

Bank Code Ror.b code,bank
Bank Code Ror.b code,startaddress To endaddress
Bank Code Ror.w code,bank
Bank Code Ror.w code,startaddress To endaddress

Similar to Bank Code Rol, but this time the bits are shifted to the right
instead of left.

Also see:

[Bank Code Rol.y](#cbcodrol)

<a id="cbcodxor"></a>

## Command: Bank Code Xor

Bank Code Xor.b code,bank
Bank Code Xor.b code,startaddress To endaddress
Bank Code Xor.w code,bank
Bank Code Xor.w code,startaddress To endaddress

Bank Code Xor encrypts a bank in a similar way to Bank Code Add using an
other algorithm. Each byte or word of the bank is combined by an
'logical exclusive or'. To decode the bank simply use the same command
along with the same key code.
Note: A Xor encrytion is not so easy to crack without the right code.
Good codes are $AA and $55.

Also see:

[Bank Code Add.y](#cbcodadd)
[Bank Code Mix.y](#cbcodmix)

<a id="cbnkcopy"></a>

## Command: Bank Copy

Bank Copy sourcebank To targetbank
Bank Copy startaddress,endaddress To targetbank

Creates a identical copy of the bank with the number 'sourcebank' in the
bank numbered 'targetbank'. The second version does only copy a specific
part of the source bank into the target bank, creating a [temporary](#dtemporaer)
bank of same content.

<a id="cbnkdltd"></a>

## Command: Bank Delta Decode

Bank Delta Decode bank
Bank Delta Decode startaddress To endaddress

These commands decode a previously delta-encoded memory region. See
Bank Delta Encode for more details on delta encoding.

Also see:

[Bank Delta Encode](#cbnkdlte)

<a id="cbnkdlte"></a>

## Command: Bank Delta Encode

Bank Delta Encode bank
Bank Delta Encode startaddress To endaddress

Bank Delta Encode encodes a memory bank with the so-called delta algo.
This is not packing, however, but yields better pack ratios on 8-bit sound
samples. Delta encoding just stores the difference from one byte to the
next, so it certain hull curve patterns in samples can be seen more
'clearly' for packing algorithms.

On Protracker Modules, you could use:

Pt Bank 3
Bank Delta Encode Pt Instr Address(1) To Start(3)+Length(3)

to encode the samples only, and

Pt Bank 3
Bank Delta Decode Pt Instr Address(1) To Start(3)+Length(3)

to reverse this effect again.

Also see:

[Bank Delta Decode](#cbnkdltd)

<a id="cbnkname"></a>

## Command: Bank Name

Bank Name bank,name$

Renames the bank with the number 'bank' to the 8 characters long name
'name$'. Most AMOS commands ignore this ID, but e.g the AMOS Tracker
commands require a bank named 'Tracker '.

Also see:

[=Bank Name$](#fbnkname)

<a id="cbnkperm"></a>

## Command: Bank Permanent

Bank Permanent bank

If you defined a bank as 'Work', but afterwards want this bank to be
[Permanently](#dpermanent) in memory and in the program, you could use Bank Permanent.
This will make the bank stay resident in your program until it is erased.
This command also has use on MED-Modules, which were loaded with the
Med Load command and on Power and Imploder unpacked banks.

Also see:

[Bank Temporary](#cbnktemp)
[Dload](#cfidload)
[Ppfromdisk](#cppfrdsk)
[Imploder Load](#cimpload)
[Imploder Unpack](#cimpunpk)

<a id="cbnkstre"></a>

## Command: Bank Stretch

Bank Stretch bank To length

Extents the bank numbered 'bank' to the given new length 'length'. During
this process, the starting address of the bank is changed. This command
does not work on [Icon and sprite banks](#diconbanks).

<a id="cbnktemp"></a>

## Command: Bank Temporary

Bank Temporary bank

Changes a bank to [Temporary-type](#dtemporaer), i.e it will be erased on the start of
your program or when calling the Default-Command.

Also see:

[Bank Permanent](#cbnkperm)
[Wload](#cfiwload)

<a id="cbnkchip"></a>

## Command: Bank To Chip

Bank To Chip bank

Bank To Chip is the reverse command to Bank To Fast. It moves a bank into
[Chip ram](#dchipram). Obviously, the starting address will therefore change.

Also see:

[Bank To Fast](#cbnkfast)

<a id="cbnkfast"></a>

## Command: Bank To Fast

Bank To Fast bank

Moves a bank into [Fast ram](#dfastram), if any is available. Naturally, the
bank will get a new starting address.
Bank To Fast won't work with [Icon and sprite bank](#diconbanks).
Warning: Do not try to replay musicis or sounds that resist in fast ram.

Also see:

[Bank To Chip](#cbnkchip)

<a id="cbcircle"></a>

## Command: Bcircle

Bcircle x,y,r,plane

Draws an empty circle around x,y with radius 'r' into the bitplane
'plane'. This line is really only one pixel thick to ensure the circle can
be filled by the [Blitter chip](#dblitter).

Also see:

[Blitter Fill](#cbltfill)

<a id="cbltcler"></a>

## Command: Blitter Clear

Blitter Clear screen,bitplane
Blitter Clear screen,bitplane,x1,y1 To x2,y2

The [Blitter chip](#dblitter) can be used to clear [Bitplanes](#dbitplane) as well.
In comparison to the AMOS command Cls, Blitter Clear allows you to wipe
single bitplane instead of all.

Optionally you may include the coordinates of a rectangular region where
the command should have effect on.

Also see:

[Blitter Copy](#cbltcopy)
[Blitter Fill](#cbltfill)
[Blitter Wait](#cbltwait)
[=Blitter Busy](#fbltbusy)

<a id="cbltcopy"></a>

## Command: Blitter Copy

Blitter Copy sourcescreen,sourceplane To targetscreen,targetplane
Blitter Copy sourcescreen,sourceplane To targetscreen,targetplane,miniterm
Blitter Copy s1,p1,s2,p2 To targetscreen,targetplane
Blitter Copy s1,p1,s2,p2 To targetscreen,targetplane,miniterm
Blitter Copy s1,p1,s2,p2,s3,p3 To targetscreen,targetplane
Blitter Copy s1,p1,s2,p2,s3,p3 To targetscreen,targetplane,miniterm

With the help of Blitter Copy you can copy a [Bitplane](#dbitplane) of a screen to
another or the same bitplane on another or the same screen. The Amiga
[Blitter chip](#dblitter) is used to fulfill this action. If two or three
source screens and bitplanes parameters are given, the graphics can be
combined by so called miniterms and the result is then written into
the target screen.

*** IMPORTANT ***

1. Before you can call Blitter Copy, you MUST set the limits of the
   operation using Blitter Copy Limit.
2. Take care that all specified screens have these dimensions and all
   screens are big enough.

The optional parameter miniterm contains a bitmask which defines the way
the source planes should be combined.

If these values are omitted, these default values are used:

One source   : the bitplane is copies normally (=%11110000).
Two sources  : the bitplanes are combined using logical OR (=%11111100).
Three sources: the bitplanes are combined using logical OR (=%11111110).

Frequently used miniterm values:

Sourceplanes one, two and three represent A, B and C.

1: %11110000: copy bitplane                 : A
1: %00001111: invert bitplane               : NOT A
2: %11111100: use logical OR on the planes  : A OR B
2: %00000011: OR planes and invert them     : NOT (A OR B)
2: %11000000: the two planes are ANDed      : A AND B
2: %00111111: planes are ANDed and inverted : NOT (A AND B)
2: %00111100: the planes will be XORed      : A XOR B
2: %11000011: planes are XORed and inverted : NOT (A XOR B)
3: %11111110: OR all planes (create mask)   : A OR B OR C
3: %00000001: OR all planes and invert them : NOT (A OR B OR C)
3: %10000000: Do a logical AND on all planes: A AND B AND C
3: %01111111: AND all planes and invert them: NOT (A AND B AND C)

If you want to create other combinations, simply try out the values you
like (nothing can happen except of bad looking screens). If you have
some knowledge on boolean algebra, read [Blitter miniterms](#dblitterminiterms).

Also see:

[Blitter Copy Limit](#cbltcplm)
[Blitter Fill](#cbltfill)
[Blitter Clear](#cbltcler)
[Blitter Wait](#cbltwait)
[=Blitter Busy](#fbltbusy)

<a id="cbltcplm"></a>

## Command: Blitter Copy Limit

Blitter Copy Limit screen
Blitter Copy Limit x1,y1 To x2,y2

Using this command you define the rectangluar area which will be used for
the Blitter Copy command. If you only specify the 'screen' parameter, the
full screen dimensions of the screen numbered 'screen' will be taken.
Otherwise x1,y1 represents the upper left corner and x2,y2 the lower right
corner of the region which will be affected by the copying and combining
process. This area will be used for ALL screnns, therefore you must ensure
that every screen is at least as big as the lower right corner of the
specified limits.

Also see:

[Blitter Copy](#cbltcopy)

<a id="cbltfill"></a>

## Command: Blitter Fill

Blitter Fill screen,bitplane
Blitter Fill screen,bitplane,x1,y1,x2,y2
Blitter Fill sourcescreen,sourceplane To targetscreen,targetplane
Blitter Fill ss,sp,x1,y1,x2,y2 To ts,tp

With Blitter Fill you can fill polygons. However, there are some
limitations: the filling algorithm of the [Blitter chip](#dblitter) is very simple.
It does only fill the gap between two dots of a horizontal line.
Therefore the limiting lines may only be one pixel think. These lines
can be either created using Turbo Draw or Bcircle.

The 'screen' and 'bitplane' parameter specify the screen which contains
the area to be filled. Additionally you can give a rectangular region
which is defined by the coordinate pairs x1,y1 and x2,y2.

Moverover you can give a second screen 'targetscreen' and a second
bitplane number 'targetplane' into which the filled figures are written.
In this mode, the source screen ist not altered in any way.

If more than one filled figure is to be drawn and these don't overlap, you
can draw all limiting lines first and then fill all figures in one cycle.

The Blitter processes the screen from the lower right to the upper left.
Due to this feature you should draw on Double Buffered or hidden screens
to avoid flickering. 

Also see:

[Turbo Draw](#cturdraw)
[Bcircle](#cbcircle)
[Blitter Copy](#cbltcopy)
[Blitter Clear](#cbltcler)
[Blitter Wait](#cbltwait)
[=Blitter Busy](#fbltbusy)

<a id="cbltwait"></a>

## Command: Blitter Wait

Blitter Wait

This command waits until the [Blitter](#dblitter) has finished his work. You are
adviced to use this command before calling e.g Print or any other command
that does not require the blitter, that will draw onto a screen, which is
currently altered by the blitter. You should use Blitter Wait in front of
Wait Vbl, too.

Also see:

[=Blitter Busy](#fbltbusy)
[Blitter Copy](#cbltcopy)
[Blitter Fill](#cbltfill)
[Blitter Clear](#cbltcler)

<a id="cblkzoom"></a>

## Command: Bzoom

Bzoom s1,x1,y1,x2,y2 To s2,x3,y3,factor

Using this command you can zoom a region on the screen to a integer
multiple very fast. As result the graphics are double, four times or eight
times as wide and from 1 to 15 times as high as before. The command zooms
the rectangular area from x1,y1 to x2,y2 on screen s1 onto the screen s2
at the coordinates x3,y3. The ending coordinates result from the zooming
factor.

The coordinates x1 and x2 are rounded down to the next multiple of eight,
x3 is even rounded to the nearest multiple of 16. Moreover, you must
ensure that the area to be zoomed fits on the target screen, because no
clipping is done at all.

The factor parameter defines how much the original image should be zoomed.
It is divided into two nibbles: $yx. y may be a value from 1 to F, x must
be either 1,2,4 or 8.

Example factors:
$11 copies the image without zooming.
$22 zooms the picture to double width and height.
$34 zooms the graphics to 4 times width and 3 times height.

<a id="cchbkfnt"></a>

## Command: Change Bank Font

Change Bank Font bank

This is a really sensible command which sets the text font on the current
screen to the one saved in the memory bank numbered 'bank'.

If you change the font using this command, no diskfont.library is required
any more. This command is also quite important if you write your programs
to be installed on harddisk that use your own fonts.

Bank Fonts can be created easily with the Make Bank Font command.

Also see:

[Make Bank Font](#cmkbkfnt)
[Change Font](#cchafont)

<a id="cchafont"></a>

## Command: Change Font

Change Font "fontname.font"
Change Font "fontname.font",height
Change Font "fontname.font",height,style

Opens a font directly from disk. This font will be taken for future text
print outs. 'height' represents the vertical size of the font, a default
height of 8 will be filled in if this parameter is omitted. The 'style'
parameter is only required in special cases and sets the type of the
requested charset (see Set Text).

Since OS 2.0 it's even possible to load multicoloured fonts. The poor
guys on Kickstart 1.3 can use the program ColorText (which e.g is included
on the DPaint disk) to patch the graphics.library to handle these fonts as
well. The diskfont.library (length=51200 bytes) found on the Fonts disk
can scale your font to your desired size.

If you open many fonts, you should call the command [Flush Libs](#cflushli) from
time to time to remove unused fonts from memory.

With the Make Bank Font command you can convert this font into a memory
bank, so you don't require the diskfont.library and the font file anymore.

Additionally, you can change the font which is used for the Print
instruction using Change Print Font.

Also see:

[=Font Style](#ffontsty)
[Make Bank Font](#cmkbkfnt)
[Change Bank Font](#cchbkfnt)
[Change Print Font](#cchprfnt)

<a id="cchprfnt"></a>

## Command: Change Print Font

Change Print Font bank

Change Print Font changes the charset which is used for the Print command.
This font always 8x8 pixels big and contains 256 characters, which is
stored in a memory bank of exactly 2 KB (=2048 bytes). Therefore the
'bank' parameter has to point exactly to such a bank. These Print-Font
banks can be created by hand (reserve the bank, write 8 bytes per chars)
or with the help of the Font-Editor supplied on the Accessories disk
(AMOSPro_Accessories:Font8x8_Editor.AMOS) and then can be loaded using
Dload.

<a id="ccongrey"></a>

## Command: Convert Grey

Convert Grey sourcescreen To targetscreen

Using this command you can convert any screen into a grey scale image,
even [HAM](#dham) and ExtraHalfBright screens are supported.
The only thing you have to do, is to open the screen and set the correct
palette. The parameter 'sourcescreen' defines the screen to be grey
scaled, 'targetscreen' is the number of the screen where the grey image
is to be created on. The number of colours in the target screen will be
taken in account, but it makes no sense to open a HAM screen for that
purpose.

<a id="ccrdbank"></a>

## Command: Coords Bank

Coords Bank bank,coords
Coords Bank bank

Reserves the bank numbered 'bank' to store a coordinates array. These
banks are utilitised e.g for Splinters. 'coords' holds the amount of
coordinates the bank should be able to hold. Each coordinate requires 4
bytes. If this parameter is omitted the existing bank will only be
switched to without erasing it. So you can jump between predefined banks.

Also see:

[Coords Read](#ccrdbank)
[=Count Pixel](#fcounpix)

<a id="ccrdread"></a>

## Command: Coords Read

Coords Read screen,colour,x1,y1 To x2,y2,bank,mode

This command is required to read the coordinates for Splinters into a
bank. This memory bank with the number 'bank' must have been defined
previously with a call to the Coords Bank command. The 'screen' parameter
holds the number of the screen on which the pixels are. 'colour'
represents the background colour, that will be left out when reading in
the dots. The rectangle which is described by the coordinates x1,y1 and
x2,y2 will be then read in and all dots, which don't have the colour
'colour', will be stored in the bank. 'mode' can be either 0, if you want
the coords to be read in strict order, or 1, if you want the coords
to be shuffled.

Also see:

[Coords Bank](#ccrdbank)
[=Count Pixel](#fcounpix)

<a id="cfidload"></a>

## Command: Dload

Dload file$,bank

Just like Wload, this command loads a file into memory, but this time
a [Permanent](#dpermanent) 'Datas'-Bank will be created.

Also see:

[Wload](#cfiwload)
[Bank Permanent](#cbnkperm)

<a id="cfidsave"></a>

## Command: Dsave

Dsave file$,bank

Dsave is exactly the same as Wsave in every aspect.

Also see:

[Wsave](#cfiwsave)

<a id="cexamdir"></a>

## Command: Examine Dir

Examine Dir directory$

This command loads all information about the drawer 'directory$' into the
FileInfoBlock. Additionally, the contents of the directory can be read
out by Examine Next$.

Also see:

[=Examine Next$](#fexanext)
[Examine Stop](#cexastop)
[=Object Name$](#fobjname)
[=Object Type](#fobjtype)
[=Object Size](#fobjsize)
[=Object Blocks](#fobjblks)
[=Object Protection](#fobjprot)
[=Object Time](#fobjtime)
[=Object Date](#fobjdate)
[=Object Comment$](#fobjcomm)

<a id="cexamobj"></a>

## Command: Examine Object

Examine Object file$

Examine Object supplies you with all available information about the
[Object](#dobject) named 'file$'. These datas can then be requested using the Object
functions without any parameters.

Also see:

[=Object Name$](#fobjname)
[=Object Type](#fobjtype)
[=Object Size](#fobjsize)
[=Object Blocks](#fobjblks)
[=Object Protection](#fobjprot)
[=Object Time](#fobjtime)
[=Object Date](#fobjdate)
[=Object Comment$](#fobjcomm)

<a id="cexastop"></a>

## Command: Examine Stop

Examine Stop

Aborts the reading process of a directory. After this command, you may not
make any further calls to Examine Next$.

Also see:

[Examine Dir](#cexamdir)
[=Examine Next$](#fexanext)

<a id="cexchbob"></a>

## Command: Exchange Bob

Exchange Bob i1,i2

This command simply swaps the two images i1 and i2 in the current sprite
bank. i1 and i2 must exist as a valid image, otherwise an error will be
reported.

Also see:

[Exchange Icon](#cexchico)

<a id="cexchico"></a>

## Command: Exchange Icon

Exchange Icon i1,i2

This command simply swaps the two images i1 and i2 in the current icon
bank. i1 and i2 must exist as a valid image, otherwise an error will be
reported.

Also see:

[Exchange Bob](#cexchbob)

<a id="cextdefa"></a>

## Command: Extdefault

Extdefault extnb

This command has been written especially for advanced users. With this one
you can call the routine in the AMOS extension in slot 'extnb' which is
normally executed after the start of a program or by the Default command.
Often this routine resets the interior database to the default values.

Extdefault should be called after relinking a extension with Extreinit.

If no extension is loaded in slot number 'extnb', this instruction has no
effect.

Also see:

[Extreinit](#cextrein)
[Extremove](#cextremo)
[Audio Lock](#caudlock)

<a id="cextrein"></a>

## Command: Extreinit

Extreinit extnb

This command causes a restart of the extension numbered 'extnb'. Extreinit
may only be called on a extension that has been removed using Extremove.
Otherwise, you can lose memory or even crash your computer.

Also see:

[Extremove](#cextremo)
[Extdefault](#cextdefa)
[Audio Lock](#caudlock)

<a id="cextremo"></a>

## Command: Extremove

Extremove extnb

The Extremove command removes the extension in the slot 'extnb' from
memory like when exiting AMOS. After this command no further instructions
requiring this extension may be called. As AMOS tries to unlink the
extension itself on quitting, this could cause some trouble. So don't
remove an extension too long, revoke it with Extreinit before exiting.

Also see:

[Extreinit](#cextrein)
[Extdefault](#cextdefa)
[Audio Lock](#caudlock)

<a id="cfcircle"></a>

## Command: Fcircle

Fcircle x,y,r

Fcircle is a command which has been missed in AMOS for a long time. It
draws a filled circle with the radius 'r' and center x,y.

Also see:

[Fellipse](#cfellips)

<a id="cfellips"></a>

## Command: Fellipse

Fellipse x,y,rx,ry

This command draws an ellipse, similar to the AMOS Ellipse command.
However, Fellipse draws a filled ellipse.

Also see:

[Fcircle](#cfcircle)

<a id="cfilcopy"></a>

## Command: File Copy

File Copy sourcefile$ To targetfile$

Copies the file with the name 'sourcefile$' to the file 'targetfile$'.
This command allows you to even copy a file of 3 MB in size, even if you
only got 100 KB of free memory.

<a id="cflushli"></a>

## Command: Flush Libs

Flush Libs

This command closes all libraries, fonts and devices, which are currently
not in use and tries to get as much memory as possible. During this
process the PowerPacker and the diskfont.library will be 'flushed', too.

<a id="chamfade"></a>

## Command: Ham Fade Out

Ham Fade Out screen

As [HAM screens](#dham) cannot be faded out with the normal Fade commands, AMCAF
provides you with a world sensation: The HAM fader! Although you can only
fade out pictures, it's more than nothing, isn't it?

Ham Fade Out darkens the screen 'screen' by one single step. After calling
it 16 times, the Ham screen is completely black.

Technically, it's not possible to fade in a ham screen without enormous
processor power, but for fading out, a modified Shade Bobs routine is
used.

<a id="cimpload"></a>

## Command: Imploader Load

Imploder Load file$,bank

This instruction tries to load and unpack a file-imploded file. The result
will be stored in the bank numbered 'bank'. If the specified file is not
packed using file imploder, it will be loaded into memory normally. If the
value of 'bank' is a negative number, the file will be unpacked into
[Chip ram](#dchipram).

Imploder Load does not need more memory to unpack the packed bank.
Additionally, Imploder Load is extremly fast.

The File Imploder is part of the Turbo Imploder 4.0 package.
Turbo Imploder 4.0 is a very fast packer for executables, written by
Albert-Jan Brouwer and Peter Struijk.

The File Imploder can be found on the installation disk in the C: drawer
(AMCAF_Install:C/Fimp) along with the manual AMCAF_Install:C/Fimp.man).

Also see:

[Imploder Unpack](#cimpunpk)

<a id="cimpunpk"></a>

## Command: Imploder Unpack

Imploder Unpack sbank to tbank

Unpacks the File Imploder packed file, which is stored in the memory bank
'sbank', into the target bank 'tbank'. If the source bank does not contain
a File Imploded file (which can be determinated be the first longword
'IMP!') a error message will be returned. A negative 'tbank' value will
force the bank to be unpacked into [Chip ram](#dchipram).

Also see:

[Imploder Load](#cimpload)

<a id="claunchp"></a>

## Command: Launch

Launch file$
Launch file$,stack

The Launch instruction starts a new task which is saved on disk with the
name 'file$'. The optional parameter 'stack' holds the size of the
stack memory to be allocated (default value is 4096).
Note: Many programs don't work when started from AMOS, as they are not
part of a workbench or CLI environment.

<a id="climsmou"></a>

## Command: Limit Smouse

Limit Smouse
Limit Smouse x1,y1 To x2,y2

Defines the region in which the mouse can be moved on the screen. If the
parameters are omitted, the full size of the current screen will be used
as default.

Also see:

[=X Smouse](#fxsmouse)
[=Y Smouse](#fysmouse)
[=Smouse Key](#fsmousek)
[Smouse Speed](#csmouspd)
[Smouse X](#csmousex)
[Smouse Y](#csmousey)

<a id="cmkbkfnt"></a>

## Command: Make Bank Font

Make Bank Font bank

Using this powerful command you can store any amiga font in a memory bank.
The current font on the current screen will be taken to create the font
bank numbered 'bank'. To change the current text font simply use the
Change Font instruction.

These banks don't require the 'diskfont.library' or other disk access any
more, once they have been created. To load a font from a bank use the
Change Bank Font command.

Also see:

[Change Bank Font](#cchbkfnt)
[Change Font](#cchafont)

<a id="cpixmask"></a>

## Command: Make Pix Mask

Make Pix Mask screen,x1,y1 To x2,y2,bank

Grabs a specific part of the screen and saves it into the bank with the
number bank. This command can be used to create a mask for the Pix Shift
instruction. If you use such a mask, the size must be exactly the same
like the limits you specify with the Pix Shift commands.

Also see:

[Pix Shift Up](#cpixshup)
[Pix Shift Down](#cpixshdo)
[Pix Brighten](#cpixbrig)
[Pix Darken](#cpixdark)

<a id="cmskcopy"></a>

## Command: Mask Copy

Mask Copy screen1,x1,y1,x2,y2 To screen2,x3,y3,maskaddress

Copies a part of a screen to an other, just like Screen Copy. However, a
mask bitplane can be given. 'maskaddress' represents the startaddress of
the [Bitplane](#dbitplane).

<a id="cnoopera"></a>

## Command: Nop

Nop

This 'command' has no effect et al. It's only use is for speed testing
routines. 

Also see:

[=Nfn](#fnofunct)

<a id="copenwor"></a>

## Command: Open Workbench

Open Workbench

Tries to open the workbench again, if it has been closed previously. The
Workbench screen can be closed using the AMOS command Close Workbench to
get more memory.

<a id="cpgetscr"></a>

## Command: Pal Get Screen

Pal Get Screen palnr,screen

This functions stores the complete palette of screen number 'screen' in
the interior palette memory number 'palnr'. 'palnr' must be a value
between 0 and 7.

This command is used to quickly store a specific palette of a screen in a
buffer. To restore the old palette, you can call the Pal Set Screen
command.

Also see:

[Pal Set Screen](#cpsetscr)
[Pal Set](#cpsetcol)
[=Pal Get](#fpgetcol)

<a id="cpsetcol"></a>

## Command: Pal Set

Pal Set palnr,index,colour

Changes the colour entry numbered 'index' in the palette with the number
'palnr' to the colour value 'colour'. palnr must be range from 0 to 7.

Also see:

[Pal Set Screen](#cpsetscr)
[Pal Get Screen](#cpgetscr)
[=Pal Get](#fpgetcol)

<a id="cpsetscr"></a>

## Command: Pal Set Screen

Pal Set Screen palnr,screen

Writes back the previously stored colour palette 'palnr' to the screen
number 'screen'.

Also see:

[Pal Get Screen](#cpgetscr)
[Pal Set](#cpsetcol)
[=Pal Get](#fpgetcol)

<a id="cpspread"></a>

## Command: Pal Spread

Pal Spread c1,rgb1 To c2,rgb2

Creates a smooth blend between the two colours rgb1 and rgb2. The
resulting colour set will be stored between c1 and c2.

<a id="cpasptil"></a>

## Command: Paste Ptile

Paste Ptile x,y,t

Places a Ptile block at the postion x,y. These coordinates must be given
as block positions, that means that position 1,4 corresponds to the
screen coordinates 16,64.

Also see:

[Ptile Bank](#cptilbnk)

<a id="cpixbrig"></a>

## Command: Pix Brighten

Pix Brighten screen,c1,c2,x1,y1 To x2,y2
Pix Brighten screen,c1,c2,x1,y1 To x2,y2,bank

Using this command, you can increase the colour indexes in the rectangular
area from x1,y1 to x2y2. The 'screen' parameter therefore contains the
number of the screen on which this regions is situated. 'c1' and 'c2' hold
the border colours, which should be taken into account for the colour
cycling, other colours are not affected.

If you supply the optional parameter 'bank', you can use a previously
calculated mask which can be created with the Make Pix Mask command.

In difference to Pix Shift Up, the colour indexes don't override 'c2'.

Also see:

[Pix Darken](#cpixdark)
[Pix Shift Up](#cpixshup)
[Pix Shift Down](#cpixshdo)
[Make Pix Mask](#cpixmask)

<a id="cpixdark"></a>

## Command: Pix Darken

Pix Darken screen,c1,c2,x1,y1 To x2,y2
Pix Darken screen,c1,c2,x1,y1 To x2,y2,bank

Using this command, you can decrease the colour indexes in the rectangular
area from x1,y1 to x2y2. The 'screen' parameter therefore contains the
number of the screen on which this regions is situated. 'c1' and 'c2' hold
the border colours, which should be taken into account for the colour
cycling, other colours are not affected.

If you supply the optional parameter 'bank', you can use a previously
calculated mask which can be created with the Make Pix Mask command.

In difference to Pix Shift Down, the colour indexes don't go below 'c1'.

Also see:

[Pix Brighten](#cpixbrig)
[Pix Shift Up](#cpixshup)
[Pix Shift Down](#cpixshdo)
[Make Pix Mask](#cpixmask)

<a id="cpixshdo"></a>

## Command: Pix Shift Down

Pix Shift Down screen,c1,c2,x1,y1 To x2,y2
Pix Shift Down screen,c1,c2,x1,y1 To x2,y2,bank

Using this command, you can decrease the colour indexes in the rectangular
area from x1,y1 to x2y2. The 'screen' parameter therefore contains the
number of the screen on which this regions is situated. 'c1' and 'c2' hold
the border colours, which should be taken into account for the colour
cycling, other colours are not affected.

If you supply the optional parameter 'bank', you can use a previously
calculated mask which can be created with the Make Pix Mask command.

However, if the colour indexes go below 'c1', they are set back to 'c2'
again.

Also see:

[Pix Shift Up](#cpixshup)
[Pix Brighten](#cpixbrig)
[Pix Darken](#cpixdark)
[Make Pix Mask](#cpixmask)

<a id="cpixshup"></a>

## Command: Pix Shift Up

Pix Shift Up screen,c1,c2,x1,y1 To x2,y2
Pix Shift Up screen,c1,c2,x1,y1 To x2,y2,bank

Using this command, you can increase the colour indexes in the rectangular
area from x1,y1 to x2y2. The 'screen' parameter therefore contains the
number of the screen on which this regions is situated. 'c1' and 'c2' hold
the border colours, which should be taken into account for the colour
cycling, other colours are not affected.

If you supply the optional parameter 'bank', you can use a previously
calculated mask which can be created with the Make Pix Mask command.

However, if the colour indexes override 'c2', they are set back to 'c1'
again.

Also see:

[Pix Shift Down](#cpixshdo)
[Pix Brighten](#cpixbrig)
[Pix Darken](#cpixdark)
[Make Pix Mask](#cpixmask)

<a id="cppfrdsk"></a>

## Command: Ppfromdisk

Ppfromdisk file$,bank

Loads the file named 'file$' into memory bank number 'bank' and decruches
it, if it has been packed using PowerPacker. Is 'bank' a negative value,
the file is unpacked into [Chip ram](#dchipram) instead. If the file is Imploder
packed, the Imploder Load command will be called, and if it is not packed,
it will be loaded normally using Wload.

Also see:

[Pptodisk](#cpptodsk)
[Ppunpack](#cppunpak)

<a id="cpptodsk"></a>

## Command: Pptodisk

Pptodisk file$,bank
Pptodisk file$,bank,efficiency

The Pptodisk command crunches and saves the bank numbered 'bank' into the
file 'file$' using the PowerPacker algorithm. The optional 'efficiency'
parameter determinates how good the bank is to be packed and must range
between 0 (very fast, but less efficient) and 4 (best, but slow).
The powerpacker.library is requires for this and the two more commands.

Sorry for the name 'Pptodisk' but 'Ppsave' has already been used by AMOS.

Also see:

[Ppfromdisk](#cppfrdsk)
[Ppunpack](#cppunpak)

<a id="cppunpak"></a>

## Command: Ppunpack

Ppunpack sourcebank To targetbank

Decrunches a powerpacked file in 'sourcebank' into the bank number
'targetbank'. Is 'targetbank' a negative value, so it will be decrunched
into [Chip ram](#dchipram).
BTW: Powerpacked files can be identified by the first [Longword](#dlong)
containing 'PP20'.

Also see:

[Pptodisk](#cpptodsk)
[Ppfromdisk](#cppunpak)

<a id="cprotobj"></a>

## Command: Protect Object

Protect Object pathfile$,prot

Changes the [Protection Flags](#dprotflags) of the [Object](#dobject) 'pathfile$' to the
bitmapped value 'prot'.

Also see:

[=Object Protection](#fobjprot)

<a id="cpt_bank"></a>

## Command: Pt Bank

Pt Bank bank

This command is used if you want to play back instruments from a music
module but the music bank has not yet been specified with Pt Play.

Also see:

[Pt Play](#cpt_play)
[Pt Continue](#cpt_cont)
[Pt Instr Play](#cptinspl)
[=Pt Instr Address](#fptinadr)
[=Pt Instr Length](#fptinlen)

<a id="cptspeed"></a>

## Command: Pt Cia Speed

Pt Cia Speed bpm

With the help of this command, you can set the speed for replaying the
Protracker modules. However, the music may change the speed on it's own
if it has been composed for CIA-Timing. The parameter 'bpm' set the number
of beats per minute or if you specifiy a value of zero, the timing will be
switched from CIA-Timing to Vertical Blank Timing. Then the bpm rate is
automatically set to exacty 125 and all CIA-Timing from the module are
ignored if such appear in the music.

CIA-Timing causes some problems in conjunction with AMOS sprites, which
show up as a flickering at regular intervals. If you work with sprites
you should switch back to VBL-Timing where possible using Pt Cia Speed 0.

If a music module is not replayed correctly using VBL-Timing, i.e is
running to fast or slow, you must switch to Cia-Timing. This can achieved
with a Pt Cia Speed 125 command directly in front of a Pt Play
instruction.

The default is CIA-Timing with 125 bpm.

Also see:

[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)
[Pt Voice](#cptvoice)
[=Pt Cpattern](#fptcpatt)
[=Pt Cpos](#fptcposi)

<a id="cpt_cont"></a>

## Command: Pt Continue

Pt Continue

Restarts the protracker music at that point it has previously been stopped
using Pt Stop. Do not attempt use Pt Continue without having started the
music once with Pt Play.

Also see:

[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Cia Speed](#cptspeed)
[Pt Bank](#cpt_bank)
[=Pt Cpattern](#fptcpatt)
[=Pt Cpos](#fptcposi)

<a id="cptinspl"></a>

## Command: Pt Instr Play

Pt Instr Play instnr
Pt Instr Play voice,instnr
Pt Instr Play voice,instnr,freq

The Pt Instr Play instruction replays an instrument of the current
Protracker music module.

The 'voice' parameter contains a bitmask that says on which channels the
instrument number 'instnr' should be played. If it is ommitted, the sound
effect is output on all four channels. 'instnr' must range between 1 and
31. The optional argument 'freq' holds the frequency which should be used
for the sample.

If you want to replay a sample repeatingly, just specify a negative value
for 'instnr'. The volume of the instrument can be set with the
Pt Sam Volume command.

Before you can replay an instrument of a module, you first have to specify
the bank that holds the music. This can be achieved either by a call to
Pt Bank or Pt Play.

Also see:

[Pt Bank](#cpt_bank)
[Pt Play](#cpt_play)
[Pt Sam Stop](#cptsamst)
[Pt Sam Volume](#cptsamvo)
[Pt Sam Play](#cptsampl)
[Pt Raw Play](#cptrawpl)
[=Pt Instr Address](#fptinadr)
[=Pt Instr Length](#fptinlen)

<a id="cpt_play"></a>

## Command: Pt Play

Pt Play bank
Pt Play bank,songpos

Pt Play stars a Protracker music module which has be situated in memory
bank number 'bank'. Optionally, you can specify a song position, which the
music should be played from.

Before you start the music with Pt Play you should choose either Vertical
Blank-Timing or CIA-Timing for the module using Pt Cia Speed.

With help of the Pt Instr Play instruction you can replay any instrument
of the music track. This method has the advantage that you can reuse a
sample that occures in the music for your sound effects.

If you want to use the instruments only, without replaying the music, you
can call the Pt Bank command instead.

The music will be turned off again with a call to the Pt Stop instruction.

Also see:

[Pt Cia Speed](#cptspeed)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)
[Pt Volume](#cptvolum)
[Pt Voice](#cptvoice)
[Pt Sam Play](#cptsampl)
[Pt Instr Play](#cptinspl)
[Pt Bank](#cpt_bank)
[=Pt Instr Address](#fptinadr)
[=Pt Instr Length](#fptinlen)
[=Pt Vu](#fptvumet)
[=Pt Signal](#fptsigna)
[=Pt Cpattern](#fptcpatt)
[=Pt Cpos](#fptcposi)
[=Pt Cinstr](#fptcinst)
[=Pt Cnote](#fptcnote)

<a id="cptrawpl"></a>

## Command: Pt Raw Play

Pt Raw Play voice,address,length,freq

This command corresponds to the normal AMOS command Sam Raw. Pt Raw Play
replays a piece of memory as audio sample. The 'voice' parameter sets
the channels to use, 'address' contains the starting address of the
memory block, 'length' the length of the sample in bytes and 'freq' holds
the replaying speed in Hertz.

Also see:

[Pt Sam Play](#cptsampl)
[Pt Instr Play](#cptinspl)
[Pt Sam Stop](#cptsamst)
[Pt Sam Volume](#cptsamvo)
[Pt Sam Freq](#cptsamfr)

<a id="cptsambk"></a>

## Command: Pt Sam Bank

Pt Sam Bank bank

If you want to replay standard AMOS samples with AMCAF, you have to
inform AMCAF about the Sample-Bank, which contains the sound effects. And
that's exactly what Pt Sam Bank does. 'bank' holds the bank number of the
AMOS sample bank.

Please remember, that you can replay the instruments of music modules
directly.

Also see:

[Pt Sam Play](#cptsampl)
[Pt Sam Stop](#cptsamst)
[Pt Sam Volume](#cptsamvo)
[Pt Sam Freq](#cptsamfr)
[Pt Instr Play](#cptinspl)
[Pt Raw Play](#cptrawpl)

<a id="cptsamfr"></a>

## Command: Pt Sam Freq

Pt Sam Freq chan,freq

This command changes the frequency of the sample currently being played on
channel chan to the new frequency in freq. If no sample is currently
played on this channel, it will have no effect nor will it have effect on
the protracker music.

Also see:

[Pt Sam Play](#cptsampl)
[Pt Sam Stop](#cptsamst)
[Pt Sam Volume](#cptsamvo)
[Pt Instr Play](#cptinspl)
[Pt Raw Play](#cptrawpl)

<a id="cptsampl"></a>

## Command: Pt Sam Play

Pt Sam Play samnr
Pt Sam Play voice,samnr
Pt Sam Play voice,samnr,freq

The Pt Sam Play command plays a sample out of an AMOS sample bank. The
advantage to the normal Sam Play instruction is that the sounds 'interact'
with the Protracker music. Moreover, no notes are missed out, like AMOS
does this on accelerated Amigas.

The 'voice' parameter contains a bitmask, that describes, on which
channels  the sample number 'samnr' should be replayed. If it is ommitted,
the sound effect will be played on all four sound channels. The optional
argument 'freq' holds the replaying speed, that shall be used.

If you want the sample to be looping, just give a negative value for
'samnr'. The volume of the sample can be changed using Pt Sam Volume.

Also see:

[Pt Sam Bank](#cptsambk)
[Pt Sam Stop](#cptsamst)
[Pt Sam Volume](#cptsamvo)
[Pt Sam Freq](#cptsamfr)
[Pt Instr Play](#cptinspl)
[Pt Raw Play](#cptrawpl)

<a id="cptsamst"></a>

## Command: Pt Sam Stop

Pt Sam Stop voice

Stops a sound effect on the channels, which are defined in the bitmap
'voice'. This is valid for samples started by Pt Sam Play, Pt Instr Play
and Pt Raw Play.

Also see:

[Pt Sam Play](#cptsampl)
[Pt Instr Play](#cptinspl)
[Pt Raw Play](#cptrawpl)
[Pt Sam Bank](#cptsambk)
[Pt Sam Stop](#cptsamst)
[Pt Sam Volume](#cptsamvo)
[Pt Sam Freq](#cptsamfr)

<a id="cptsamvo"></a>

## Command: Pt Sam Volume

Pt Sam Volume volume
Pt Sam Volume voice,volume

This instruction sets the volume for the following sample replays. The
'volume' paramter must range from 0 to 64. If you specify the optional
parameter 'voice', the command only has effect on the currently played
sample, but not on the following samples.

Also see:

[Pt Sam Play](#cptsampl)
[Pt Sam Bank](#cptsambk)
[Pt Sam Stop](#cptsamst)
[Pt Sam Freq](#cptsamfr)
[Pt Instr Play](#cptinspl)
[Pt Raw Play](#cptrawpl)

<a id="cpt_stop"></a>

## Command: Pt Stop

Pt Stop

Stops the current music module. You can restart the music with the
Pt Continue command from the very position you stopped it.

Also see:

[Pt Cia Speed](#cptspeed)
[Pt Play](#cpt_play)
[Pt Continue](#cpt_cont)
[Pt Volume](#cptvolum)
[Pt Voice](#cptvoice)
[=Pt Vu](#fptvumet)
[=Pt Signal](#fptsigna)
[=Pt Cpattern](#fptcpatt)
[=Pt Cpos](#fptcposi)

<a id="cptvoice"></a>

## Command: Pt Voice

Pt Voice bitmask

This command defines the channels which should be used for the music and
which should be free for e.g sound effects.

The 'bitmask' parameter contains -similar to the AMOS Voice command- four
bits, that are assigned to one channel each. If a bit is set, this channel
can be heard. Pt Voice %1111 turns on all sound channels.

Also see:

[Pt Cia Speed](#cptspeed)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)
[Pt Volume](#cptvolum)
[=Pt Vu](#fptvumet)
[=Pt Signal](#fptsigna)

<a id="cptvolum"></a>

## Command: Pt Volume

Pt Volume value

The Pt Volume instruction sets the volume of the music. The parameter
'value' may range from 0 (silent) to 64 (full volume).

Also see:

[Pt Cia Speed](#cptspeed)
[Pt Play](#cpt_play)
[Pt Stop](#cpt_stop)
[Pt Continue](#cpt_cont)
[Pt Voice](#cptvoice)
[=Pt Vu](#fptvumet)
[=Pt Signal](#fptsigna)

<a id="cptilbnk"></a>

## Command: Ptile Bank

Ptile Bank bank

Sets the bank to use for Ptiles. Actually, you should not read this
command description. The Ptile commands seem to be only of very low use
and are rather uninteresting for you.

Also see:

[Paste Ptile](#cpasptil)

<a id="crainfad"></a>

## Command: Rain Fade

Rain Fade rainbownr,$RGB
Rain Fade rainbownr To targetrainbow

Using this powerful instruction you can fade the rainbow numbered
'rainbownr' out or to other colours. With the first version of Rain Fade
you may specify the target colour '$RGB' to which all colours of the
rainbow will be faded. The other versions fades exactly to the colours
of an other rainbow with the number 'targetrainbow'.

Rain Fade works step by step only. Therefore you need a maximum of 16
calls to reach the new colour values.

<a id="craswait"></a>

## Command: Raster Wait

Raster Wait y
Raster Wait x,y

This function can be used to wait for a specific position of the raster
beam. The x and y parameters contain the hardware coordinates from which
the program should continue.

Also see:

[=X Raster](#fxraster)
[=Y Raster](#fyraster)

<a id="crescomp"></a>

## Command: Reset Computer

Reset Computer

This very dangerous instruction reboots your Amiga. Obviously, this
command never returns to the program.

<a id="csetntsc"></a>

## Command: Set Ntsc

Set Ntsc

This command switches to 60Hz NTSC screen mode.

Also see:

[Set Pal](#cset_pal)

<a id="cobjcomm"></a>

## Command: Set Object Comment

Set Object Comment pathfile$,comment$

This command sets the comment of the [Object](#dobject) 'pathfile$' to the string
'comment$'.

Also see:

[=Object Comment$](#fobjcomm)

<a id="cobjdate"></a>

## Command: Set Object Date

Set Object Date pathfile$,date,time

This command changes the date of the [Object](#dobject) 'pathfile$' to the given
date and time stamp.

This command only works on OS2.0 and higher.

Also see:

[=Object Date](#fobjdate)
[=Object Time](#fobjtime)

<a id="cset_pal"></a>

## Command: Set Pal

Set Pal

Set Pal returns to the normal 50Hz PAL mode.

Also see:

[Set Ntsc](#csetntsc)

<a id="csetrain"></a>

## Command: Set Rain Colour

Set Rain Colour rainbownr,newcolour

With the help of this command you can change the colour index of a rainbow
which has been set previously by Set Rainbow to a new value. This means
that you can remove the irretating limit to the first 16 colours and are
now able to access all 32 colours. But there are even more possibilities!
A colour index of -63 enables you to alter the hardware scrolling
register, so you can create fancy water and wobbel effects.

For more effects you need to install the SetRainPatch. Also see [Notes](#sdisks).

Just look at the example programs for more explainations.

<a id="csetspri"></a>

## Command: Set Sprite Priority

Set Sprite Priority bitmap

Sets the prioritity of the sprites in conjunctions with the playfields to
the value 'bitmap'. 'bitmap' is a bit mask in the following format:

Bits 0-2: 0=all sprites will be displayed behind playfield 1
          1=the sprites 0-1 appear in front of playfield 1
          2=the sprites 0-3 are drawn in front of the first playfield
          3=the sprites 0-5 appear in front of playfield 1
          4=all sprites will be displayed in front of playfield 1
Bits 3-5: 0=all sprites will be displayed behind playfield 2
          1=the sprites 0-1 appear in front of playfield 2
          2=the sprites 0-3 are drawn in front of the second playfield
          3=the sprites 0-5 appear in front of playfield 2
          4=all sprites will be displayed in front of playfield 2

This is a little bit confusing, I admit, but just try it out.

<a id="cshbshdo"></a>

## Command: Shade Bob Down

Shade Bob Down screen,x,y,image

This instruction draws a Shade Bob on the screen numbered 'screen' at the
coordinates x,y. This bob only decreases the colour indexes only. 'image'
holds the image number of the sprite bank which should be used to draw the
bob. Either the mask or the first bitplane of the object is used for this
process, according to the setting of Shade Bob Mask.

Remember, that this command supports the hot spot of the bob image.

Also see:

[Shade Bob Up](#cshbshup)
[Shade Bob Mask](#cshbmask)
[Shade Bob Planes](#cshbplan)

<a id="cshbplan"></a>

## Command: Shade Bob Planes

Shade Bob Planes amount

Set the amount of [Bitplanes](#dbitplane) to be cycled through. This can be used to
protect the graphics in higher bitplanes from the influences of Shade
Bobs. 'amount' sets the number of bitplanes, that should be drawn in and
must be a value between 1 and 6.

[Shade Bob Up](#cshbshup)
[Shade Bob Down](#cshbshdo)
[Shade Bob Mask](#cshbmask)

<a id="cshbshup"></a>

## Command: Shade Bob Up

Shade Bob Up screen,x,y,image

This instruction draws a Shade Bob on the screen numbered 'screen' at the
coordinates x,y. This bob only increases the colour indexes only. 'image'
holds the image number of the sprite bank which should be used to draw the
bob. Either the mask or the first bitplane of the object is used for this
process, according to the setting of Shade Bob Mask.

Remember, that this command supports the hot spot of the bob image.

Also see:

[Shade Bob Down](#cshbshdo)
[Shade Bob Mask](#cshbmask)
[Shade Bob Planes](#cshbplan)

<a id="cshadpix"></a>

## Command: Shade Pix

Shade Pix x,y
Shade Pix x,y,planes

This instructions increases the colour value at the given point x,y on the
current screen. If the highest colour is reached, the colour is resetted
to zero. The optional parameter 'planes' holds the number of [Bitplanes](#dbitplane)
to be cycled and may range from 1 to 6.

<a id="cshbmask"></a>

## Command: Shade Bob Mask

Shade Bob Mask flag

Using Shade Bob Mask you may specify, if the mask of a object or the first
bitplane is to be taken for drawing. If flag is set to zero, bitplane 0
is used for the Shade Bob Up and Shade Bob Down instructions, other values
for flag instruct the commands to use the mask of the object.

Also see:

[Shade Bob Up](#cshbshup)
[Shade Bob Down](#cshbshdo)
[Shade Bob Planes](#cshbplan)

<a id="csmouspd"></a>

## Command: Smouse Speed

Smouse Speed value

Sets the speed of the mouse. value therefore represents the factor by
which power of 2 the mouse should be slowed down. 0 is the maximum speed
whereas 1 is about the speed of the normal AMOS mouse. Higher values than
4 are not sensible.

Also see:

[=X Smouse](#fxsmouse)
[=Y Smouse](#fysmouse)
[=Smouse Key](#fsmousek)
[Limit Smouse](#climsmou)
[Smouse X](#csmousex)
[Smouse Y](#csmousey)

<a id="csmousex"></a>

## Command: Smouse X

Smouse X xpos

Sets the x coordinate of the mouse to xpos.

Also see:

[=X Smouse](#fxsmouse)
[=Y Smouse](#fysmouse)
[=Smouse Key](#fsmousek)
[Limit Smouse](#climsmou)
[Smouse Speed](#csmouspd)
[Smouse Y](#csmousey)

<a id="csmousey"></a>

## Command: Smouse Y

Smouse Y ypos

Sets the y coordinate of the mouse to ypos.

Also see:

[=X Smouse](#fxsmouse)
[=Y Smouse](#fysmouse)
[=Smouse Key](#fsmousek)
[Limit Smouse](#climsmou)
[Smouse Speed](#csmouspd)
[Smouse X](#csmousex)

<a id="csplback"></a>

## Command: Splinters Back

Splinters Back

Saves the background, on which the Splinters are to be drawn in the next
step.

Also see:

[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplbank"></a>

## Command: Splinters Bank

Splinters Bank bank,splinum

Reserves a memory bank for a maximum of 'splinum' Splinters. Each Splinter
requires 22 bytes of memory.

Also see:

[Splinters Back](#csplback)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplcolo"></a>

## Command: Splinters Colour

Splinters Colour bkcolour,planes

Determinates, which colour is to be left, after a Splinter has released
a dot from that point. The 'planes' parameter describes the number of
bitplanes to be taken for the Splinters operation. Normally, this value
should be equal to the number of available bitplanes. However, it can be
useful for some effects to reduce this value.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplidel"></a>

## Command: Splinters Single Del/Splinters Double Del

Splinters Single Del
Splinters Double Del

Clears the splinters from the screen again. As the clearing process
must either wipe the pre-last pixels from the screen (when using Double
Buffering), or the last pixels (with Single Buffered screens), you have
to take the appropriate command for the right screen type.

The background is automatically restored.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplindo"></a>

## Command: Splinters Single Do/Splinters Double Do

Splinters Single Do
Splinters Double Do

Clears, draws and moves all Splinters in one single step. For Double
Buffered screens you have to call the command Splinters Double Do, for
normal ones Splinters Single Do. If, however, you want to control the
process by hand, so you have to call the commands Splinters Single Del
or Splinters Double Del, then Splinters Move, Splinters Back and
Splinters Draw in this order.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="cspldraw"></a>

## Command: Splinters Draw

Splinters Draw

Draws the Splinters onto the screen.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplfuel"></a>

## Command: Splinters Fuel

Splinters Fuel time

This command is used to set the amount of time the Splinters move over the
screen until they disappear automatically. The 'time' parameter holds the
number of steps the splinters are moved before they vanish. If you set
'time' to 0, the Splinters only disappear at the edges of the screen.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplgrav"></a>

## Command: Splinters Gravity

Splinters Gravity sx,sy

Set the direction which the Splinters shall drift into. 'sx' contains a
value which is added each step to the horizontal speed and may be a
positive number for right drift or a negative one for left movement. Same
with 'sy', but this one has effect on the vertical speed.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplinit"></a>

## Command: Splinters Init

Splinters Init

Initialises the Splinters. They are fed with the coordinates and speeds
you have specified earlier.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="cspllimi"></a>

## Command: Splinters Limit

Splinters Limit
Splinters Limit x1,y1 To x2,y2

Sets the limits for the Splinters to a rectangluar area on the screen. If
you don't give any parameters, AMCAF uses the limits of the current
screen.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplimax"></a>

## Command: Splinters Max

Splinters Max amount

Changes the max. amount of new Splinters to appear on each step. Therefore
a pulsing effect can be avoided. If the value 'amount' is set to 0, no
more Splinters are created. When set to -1, there won't be a limit.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[Splinters Move](#csplmove)
[=Splinters Active](#fspliact)

<a id="csplmove"></a>

## Command: Splinters Move

Splinters Move

This command moves the Splinters one step.

Also see:

[Splinters Back](#csplback)
[Splinters Bank](#csplbank)
[Splinters Colour](#csplcolo)
[Splinters Del](#csplidel)
[Splinters Do](#csplindo)
[Splinters Draw](#cspldraw)
[Splinters Fuel](#csplfuel)
[Splinters Gravity](#csplgrav)
[Splinters Init](#csplinit)
[Splinters Limit](#cspllimi)
[Splinters Max](#csplimax)
[=Splinters Active](#fspliact)

<a id="ctdstacc"></a>

## Command: Td Stars Accelerate

Td Stars Accelerate On
Td Stars Accelerate Off

Determinates, if the stars are to be accelerated during the flight.

Also see:

[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstbnk"></a>

## Command: Td Stars Bank

Td Stars Bank bank,stars

This instruction reserves a bank for 3D stars. The 'bank' parameter holds
the number of the memory bank which should be used for the stars. 'stars'
contains the number of stars to be saved in this bank.

Each star consumes 12 bytes of memory.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstdel"></a>

## Command: Td Stars Single Del/Td Stars Double Del

Td Stars Single Del
Td Stars Double Del

Wipes the stars from the screen. You have to distinguish between Single
and Double Buffered screens. Use Td Stars Double Del on Double Buffered

Note: The background is not saved during the drawing process.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstado"></a>

## Command: Td Stars Single Do/Td Stars Double Do

Td Stars Single Do
Td Stars Double Do

Clears, draws and moves all the stars in one single step. For Double
Buffered screens you have to call the command Td Stars Double Do, for
normal ones Td Stars Single Do. If, however, you want to control the
process by hand, so you have to call the commands Td Stars Single Del
or Td Stars Double Del, then Td Stars Move and Td Stars Draw in this
order.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstdra"></a>

## Command: Td Stars Draw

Td Stars Draw

This command draws all the stars onto screen. To clear the stars again you
have to use either Td Stars Single Del or Td Stars Double Del according to
the screen type.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstgra"></a>

## Command: Td Stars Gravity

Td Stars Gravity sx,sy

Set the direction which the stars shall drift into. 'sx' contains a value
which is added each step to the horizontal speed and may be a positive
number for right drift or a negative one for left movement. Same with
'sy', but this one has effect on the vertical speed.

Normally, these values are set to 0, but you could use other values
in conjunction with Td Stars Accelerate to create an effect of spreading
sparks.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstini"></a>

## Command: Td Stars Init

Td Stars Init

Initialises the stars. That means, that the stars are moved by random
values to avoid that they all start in the origin. This command should
therefore be called once after all parameters have been set.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstlim"></a>

## Command: Td Stars Limit

Td Stars Limit
Td Stars Limit x1,y1 To x2,y2

Limits the stars into a specific area on the screen. If no parameters are
given, the full screen sizes are used.

x1,y1 and x2,y2 create a rectangular region, in which the stars will be
drawin in. These coordinates must lie WITHIN the screen dimensions,
otherwise the stars could corrupt your memory.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstmov"></a>

## Command: Td Stars Move

Td Stars Move
Td Stars Move [star]

The Td Stars Move instruction moves all the stars by on step. To see the
result, you have to draw the stars with a call to Td Stars Draw.

The second version of this command is not so much used. You can call it to
move a single star, the star with the number 'star'.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Origin](#ctdstorg)
[Td Stars Planes](#ctdstpla)

<a id="ctdstorg"></a>

## Command: Td Stars Origin

Td Stars Origin x,y

Sets the origin, where stars start from, as soon as they have left the
screen. The coordinates x,y must lie on the screen and within the drawing
area, you have defined using Td Stars Limit earlier.

The Td Stars Limit instruction automatically places the origin in the
middle of the specified area. Therefore, this command has to be placed
after Td Stars Limit.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Planes](#ctdstpla)

<a id="ctdstpla"></a>

## Command: Td Stars Planes

Td Stars Planes pl1,pl2

Td Stars Planes is used to specify the [Bitplanes](#dbitplane) which the stars should
be drawn on. Normally, these are the bitplanes 0 and 1, but these defaults
can be modified with this instruction.

Also see:

[Td Stars Accelerate](#ctdstacc)
[Td Stars Bank](#ctdstbnk)
[Td Stars Del](#ctdstdel)
[Td Stars Do](#ctdstado)
[Td Stars Draw](#ctdstdra)
[Td Stars Gravity](#ctdstgra)
[Td Stars Init](#ctdstini)
[Td Stars Limit](#ctdstlim)
[Td Stars Move](#ctdstmov)
[Td Stars Origin](#ctdstorg)

<a id="cturdraw"></a>

## Command: Turbo Draw

Turbo Draw x1,y1 To x2,y2,c
Turbo Draw x1,y1 To x2,y2,c,bitplanes

This instruction replaces the AMOS Draw command. The x1,y1 coordinates
represent the starting point of the line and x2,y2 the ending point. The
coordinates needn't to be on the screen, the line is clipped
automatically. The colour of the line 'c' must be given, whereas the
'bitplanes' parameter is optional. It determinates, into which [Bitplanes](#dbitplane)
the line should be drawn. So Bit 0 represents bitplane 0, bit 1 represents
bitplane 1 etc. If the corresponding bit is set, a line will be drawn in
the bitplane, otherwise not. If 'bitplanes' is ommitted, every bitplane is
drawn into. Turbo Draw supports a line pattern, which can be changed using
the AMOS Set Line command.

With Turbo Draw, you can draw even more and special lines, so-called
Blitter Lines. These lines are only drawn with one dot in each horizontal
line and are used to create polygons which can then be filled with the
blitter chip. To switch to this mode, the 'bitplane' parameter must be
given as negative number, everything else can remain as it is. Please note
that an extra line is drawn automatically if the blitter line leaves the
right boundary of the screen.

Also see:

[Blitter Fill](#cbltfill)

<a id="cturplot"></a>

## Command: Turbo Plot

Turbo Plot x,y,c

Draws a dot at the coordinates x,y using the colour 'c'. This command is
about 3-14 factors faster than the AMOS plot command, but does not care
about logical combinations which could be defined with Gr Writing.

Also see:

[=Turbo Point](#fturpoin)

<a id="cvecrang"></a>

## Command: Vec Rot Angles

Vec Rot Angles angx,angy,angz

Sets the three viewing angles, which are used for the vector rotation.
'angx' represents the angle, the coordinate is to be rotated along the
X-axis. Same with 'angy' and 'angz', which are related to the Y- and the
Z-axis. The angles are -like with Qsin and Qcos- neither values in degree
nor radians format, but a revolution (360 degrees) equals the value 1024.

After you have given the angles and the new position, you can calculate
the new vector matrix using the Vec Rot Precalc command.

Also see:

[Vec Rot Pos](#cvecrpos)
[Vec Rot Precalc](#cvecrpre)
[=Vec Rot X](#fvecrotx)
[=Vec Rot Y](#fvecroty)
[=Vec Rot Z](#fvecrotz)
[=Qsin](#fqsine)
[=Qcos](#fqcosine)

<a id="cvecrpos"></a>

## Command: Vec Rot Pos

Vec Rot Pos posx,posy,posz

Using Vec Rot Pos you can change the position of the camera. 'posx' and
'posy' hold the movement position of the camera in X and Y direction.
The value in 'posz' contains the distance to the camera.

There is no need to recalculate the matrix if you only change the position
of the camera.

Also see:

[Vec Rot Angles](#cvecrang)
[Vec Rot Precalc](#cvecrpre)
[=Vec Rot X](#fvecrotx)
[=Vec Rot Y](#fvecroty)
[=Vec Rot Z](#fvecrotz)

<a id="cvecrpre"></a>

## Command: Vec Rot Precalc

Vec Rot Precalc

This command must be called before every vector rotations, always after
you have changed the viewing angle. It calculates a internal matrix that
holds the results of often needed calculations which are required for the
rotation in three dimensions.

After you have called Vec Rot Precalc, you can use the Vec Rot X,Y and Z
functions.

Also see:

[Vec Rot Pos](#cvecrpos)
[Vec Rot Angles](#cvecrang)
[=Vec Rot X](#fvecrotx)
[=Vec Rot Y](#fvecroty)
[=Vec Rot Z](#fvecrotz)

<a id="cfiwload"></a>

## Command: Wload

Wload file$,bank

This command loads the file named 'file$' completely into memory, storing
it in bank number 'bank'. The bank is defined as ['Work'](#dtemporaer).
If 'bank' is a negative number, the file is loaded into [Chip ram](#dchipram) instead.

Wload could be replaced by the following commands:

Open In 1,FILE$ : LE=Lof(1) : Close 1
Reserve As Work BANK,LE
Bload FILE$,BANK

Also see:

[Dload](#cfidload)
[Bank Temporary](#cbnktemp)

<a id="cwritcli"></a>

## Command: Write Cli

Write Cli text$

The Write Cli instruction writes the string 'text$' into the CLI window,
AMOS or your program has been start from. If this window does not exist,
no text will be output.

<a id="cfiwsave"></a>

## Command: Wsave

Wsave file$,bank

Saves the bank with the number 'bank' as file named 'file$' onto the
current disk drive. This file contains no AMOS overhead, that means that
only the pure binary data is saved.

Also see:

[Dsave](#cfidsave)

