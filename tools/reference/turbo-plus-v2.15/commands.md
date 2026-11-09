# Turbo Plus V2.15 command inventory

Generated from the supplied binary. Addresses are file offsets. Example counts are token occurrences, not execution coverage.

| Slot 12 offset | Name | Signature | Routine | File address | Example uses |
|---|---|---|---|---|---|
| `$0006` | multi yes | `I` | R002 | `$0f72` | 21 |
| `$0016` | multi no | `I` | R003 | `$0f8a` | 20 |
| `$0024` | lsl.b | `00,0` | R004 | `$0fa2` | 0 |
| `$0032` | lsl.w | `00,0` | R005 | `$0fac` | 0 |
| `$0040` | lsl.l | `00,0` | R006 | `$0fb6` | 0 |
| `$004e` | lsr.b | `00,0` | R007 | `$0fc0` | 0 |
| `$005c` | lsr.w | `00,0` | R008 | `$0fca` | 0 |
| `$006a` | lsr.l | `00,0` | R009 | `$0fd4` | 0 |
| `$0078` | l swap | `00` | R00a | `$0fde` | 0 |
| `$0086` | test.b | `00,0` | R00b | `$0fe6` | 0 |
| `$0096` | test.w | `00,0` | R00c | `$0ff6` | 0 |
| `$00a6` | vbl wait | `I0` | R00d | `$1006` | 9 |
| `$00b6` | reserve check | `I0` | R00e | `$1014` | 1 |
| `$00ca` | check erase | `I` | R00f | `$101a` | 1 |
| `$00dc` | check | `00t0,0,0` | R010 | `$1020` | 0 |
| `$00ee` | set check | `I0,0,0t0,0` | R011 | `$1088` | 1 |
| `$0106` | reset check | `I0` | R012 | `$108e` | 0 |
| `$0118` | hit spr zone | `00,0,0` | R013 | `$1094` | 2 |
| `$0130` | hit bob zone | `00,0,0` | R014 | `$10ce` | 2 |
| `$0148` | hit spr check | `00t0,0,0,0` | R015 | `$10ee` | 1 |
| `$0164` | raw key | `00` | R016 | `$1170` | 1 |
| `$0172` | r move | `I0,0` | R017 | `$11b2` | 12 |
| `$0182` | r draw | `I0,0` | R018 | `$11c4` | 14 |
| `$0192` | r box | `I0,0` | R019 | `$11e6` | 2 |
| `$01a0` | r home | `I0,0` | R01a | `$1230` | 3 |
| `$01b0` | r bar | `I0,0` | R01b | `$1242` | 2 |
| `$01be` | reserve object | `I0,0` | R01c | `$126c` | 3 |
| `$01d6` | define draw | `I0,0t0,0` | R01e | `$1272` | 8 |
| `$01ee` | define move | `I0,0t0,0` | R01f | `$1278` | 3 |
| `$0206` | define stop | `I0,0` | R020 | `$127e` | 2 |
| `$021a` | define attr | `I0,0t0,0` | R021 | `$1284` | 3 |
| `$0232` | object draw | `I0` | R022 | `$128a` | 4 |
| `$0244` | r object draw | `I0,0,0` | R023 | `$130a` | 3 |
| `$025c` | object mag draw | `I0,0` | R024 | `$139c` | 0 |
| `$0274` | r object mag draw | `I0,0,0,0` | R025 | `$147a` | 10 |
| `$0292` | object erase | `I0` | R026 | `$156c` | 5 |
| `$02a6` | line 3d | `I0,0,0t0,0,0` | R029 | `$157e` | 1 |
| `$02be` | eye 3d | `I0,0` | R02a | `$15d4` | 1 |
| `$02ce` | object save | `I2,0t0` | R027 | `$1572` | 1 |
| `$02e4` | object load | `I2,0` | R028 | `$1578` | 3 |
| `$02f8` | blit store left | `I0,0,0,0t0,0,0` | R02b | `$15e6` | 10 |
| `$031a` | multi blit | `I0t0` | R02c | `$15ec` | 2 |
| `$032e` | blit erase | `I0` | R02d | `$16d2` | 6 |
| `$0340` | blit speed | `I0,0` | R02e | `$16d8` | 1 |
| `$0354` | blit left | `I0,0,0t0,0,0` | R02f | `$173a` | 1 |
| `$036e` | f plot | `I0,0,0` | R031 | `$1980` | 4 |
| `$0380` | blit clear | `I0` | R030 | `$18d0` | 26 |
| `$0392` | left click | `0` | R03c | `$1c36` | 32 |
| `$03a2` | reserve stars | `I0` | R034 | `$1a84` | 4 |
| `$03b6` | define star | `I0,0,0,0,0` | R035 | `$1a8a` | 4 |
| `$03d0` | display stars | `I` | R036 | `$1a90` | 2 |
| `$03e4` | stars erase | `I` | R037 | `$1b1c` | 4 |
| `$03f6` | stars compute | `I0t0` | R038 | `$1b22` | 0 |
| `$040c` | stars draw | `I` | R039 | `$1bb8` | 0 |
| `$041c` | stars speed | `I0t0,0,0` | R03a | `$1bf6` | 5 |
| `$0434` | stars clip | `I0,0,0,0` | R03b | `$1c30` | 1 |
| `$044c` | f point | `00,0` | R033 | `$1a32` | 3 |
| `$045c` | f circle | `I0,0,0,0` | R03d | `$1c4c` | 6 |
| `$0472` | f sqr | `00` | R041 | `$1f38` | 0 |
| `$047e` | stars int on | `I0` | R042 | `$1f62` | 2 |
| `$0492` | stars int off | `I` | R043 | `$1f68` | 2 |
| `$04a6` | blit int on | `I0t0` | R044 | `$1f6e` | 2 |
| `$04ba` | blit int off | `I` | R045 | `$1f74` | 2 |
| `$04cc` | f draw | `I0,0t0,0` | R046 | `$1f7a` | 0 |
| `$04e0` | f draw | `I0,0` | R04a | `$1fd6` | 0 |
| `$04ea` | object limit | `I0` | R049 | `$1fd0` | 8 |
| `$04fe` | set planes | `I0` | R04c | `$2214` | 0 |
| `$0510` | plane offset | `I0,0,0,0` | R04d | `$222e` | 16 |
| `$052a` | plane swap | `I0,0,0` | R04e | `$2292` | 0 |
| `$0540` | plane shift up | `I0,0t0` | R04f | `$230a` | 1 |
| `$055a` | plane shift down | `I0,0t0` | R050 | `$237e` | 0 |
| `$0576` | plane update | `I0` | R051 | `$23f2` | 7 |
| `$058a` | f paste icon | `I0,0,0` | R052 | `$246a` | 10 |
| `$05a2` | f 32 icon | `I0,0,0` | R053 | `$25aa` | 1 |
| `$05b6` | f 16 icon | `I0,0,0` | R054 | `$2cb4` | 1 |
| `$05ca` | f 16proc icon | `I0,0,0` | R055 | `$3176` | 0 |
| `$05e2` | f 32proc icon | `I0,0,0` | R056 | `$322e` | 0 |
| `$05fa` | x icon | `00` | R057 | `$332e` | 0 |
| `$0608` | y icon | `00` | R058 | `$336e` | 0 |
| `$0616` | planes icon | `00` | R059 | `$33b0` | 0 |
| `$0628` | cpu info | `0` | R05a | `$33f2` | 0 |
| `$0636` | math info | `0` | R05b | `$342c` | 0 |
| `$0646` | f put block | `I0,0,0` | R05c | `$345a` | 1 |
| `$065c` | reserve static block | `I0` | R05d | `$3598` | 2 |
| `$0678` | static block erase | `I` | R05e | `$35dc` | 2 |
| `$0690` | build static block | `I` | R05f | `$3608` | 2 |
| `$06a8` | f put static block | `I0,0,0` | R060 | `$3636` | 2 |
| `$06c6` | scene bank | `I0` | R061 | `$3754` | 2 |
| `$06d8` | scene check | `00,0` | R062 | `$379e` | 0 |
| `$06ec` | scene 16 check | `00,0` | R063 | `$37d0` | 0 |
| `$0704` | scene change | `I0,0,0` | R064 | `$3806` | 0 |
| `$071c` | scene 16 change | `I0,0,0` | R065 | `$3836` | 0 |
| `$0736` | scene 16 draw | `I0,0,0,0,0,0` | R066 | `$386a` | 3 |
| `$0754` | scene 16 def | `I0,0,0,0,0,0,0,0` | R067 | `$3a62` | 0 |
| `$0776` | scene 16 restore | `I0` | R068 | `$3b78` | 0 |
| `$078e` | scene 16 limit | `I0` | R069 | `$3cfa` | 0 |
| `$07a4` | scene 32 check | `00,0` | R06a | `$3d82` | 0 |
| `$07bc` | scene 32 change | `I0,0,0` | R06b | `$3db8` | 0 |
| `$07d6` | scene 32 draw | `I0,0,0,0,0,0` | R06c | `$3dec` | 0 |
| `$07f4` | scene 16 view | `I0,0,0t0,0` | R06d | `$3ff6` | 1 |
| `$0810` | scene 32 view | `I0,0,0t0,0` | R06e | `$40a8` | 0 |
| `$082c` | scene 16 do | `I0,0` | R06f | `$415a` | 3 |
| `$0840` | scene 32 do | `I0,0` | R070 | `$4170` | 0 |
| `$0854` | scene 16 top | `I0,0` | R071 | `$4186` | 0 |
| `$086a` | scene 32 top | `I0,0` | R072 | `$419e` | 0 |
| `$0880` | scene 16 bottom | `I0,0` | R073 | `$41b6` | 0 |
| `$0898` | scene 32 bottom | `I0,0` | R074 | `$41de` | 0 |
| `$08b0` | scene 16 left | `I0,0` | R075 | `$4206` | 0 |
| `$08c6` | scene 32 left | `I0,0` | R076 | `$421e` | 0 |
| `$08dc` | scene 16 right | `I0,0` | R077 | `$4236` | 0 |
| `$08f4` | scene 32 right | `I0,0` | R078 | `$425e` | 0 |
| `$090c` | scene x | `0` | R07b | `$45fe` | 0 |
| `$091a` | scene y | `0` | R07c | `$460e` | 2 |
| `$0928` | amos pri | `I0` | R07d | `$4620` | 0 |
| `$0938` | bit field ins | `00,0,0,0` | R086 | `$46b8` | 0 |
| `$0952` | bit field ext | `00,0,0` | R087 | `$470c` | 0 |
| `$096a` | hit bob check | `00t0,0,0,0` | R088 | `$474a` | 0 |
| `$0986` | byte hunt | `00t0,0,0t0` | R089 | `$47c2` | 0 |
| `$099e` | workbench open | `I` | R08a | `$481c` | 0 |
| `$09b2` | scene load | `I2,0` | R08b | `$482a` | 2 |
| `$09c6` | memory fill | `I0t0,2` | R08c | `$4830` | 0 |
| `$09dc` | blit int change | `I0t0` | R08d | `$4866` | 0 |
| `$09f4` | blit int wait | `I0` | R08e | `$48a0` | 2 |
| `$0a08` | range | `00,0t0` | R08f | `$48b6` | 0 |
| `$0a18` | texp | `00,0,0` | R090 | `$48d2` | 0 |
| `$0a28` | blit up | `I0,0,0t0,0,0` | R091 | `$48e2` | 0 |
| `$0a40` | blit store up | `I0,0,0,0t0,0,0` | R092 | `$4ab2` | 0 |
| `$0a60` | icon check | `00` | R093 | `$4ab8` | 0 |
| `$0a72` | scene icon bank | `I0` | R094 | `$4af2` | 0 |
| `$0a88` | t clip | `00,0` | R095 | `$4b2c` | 1 |
| `$0a98` | between | `00,0,0` | R096 | `$4b3c` | 0 |
| `$0aaa` | scene palette | `I0` | R097 | `$4b5a` | 0 |
| `$0abe` | scene mask palette | `I0` | R098 | `$4bc6` | 0 |
| `$0ad8` | bank end | `00` | R099 | `$4bd2` | 0 |
| `$0ae8` | scene scan x | `00,0,0,0` | R09a | `$4bd8` | 0 |
| `$0b02` | scene scan y | `00,0,0,0` | R09b | `$4c58` | 0 |
| `$0b1c` | scene copy | `I0,0,0,0,0t0,0,0` | R09c | `$4cda` | 0 |
| `$0b3c` | scene fill | `I0,0,0,0,0,0` | R09d | `$4d94` | 0 |
| `$0b58` | scene convert | `I0t0` | R0a0 | `$4eb8` | 1 |
| `$0b6e` | reserve scene | `I0,0,0` | R09e | `$4e04` | 0 |
| `$0b86` | word hunt | `00t0,0,0t0` | R09f | `$4e56` | 0 |
| `$0b9e` | scene replace | `I0,0,0,0,0,0,0` | R0a1 | `$4ef8` | 0 |
| `$0bbe` | chip largest | `0` | R0a7 | `$4f74` | 0 |
| `$0bd0` | fast largest | `0` | R0a8 | `$4f8c` | 0 |
| `$0be2` | string hunt | `00t0,0,0,2` | R0a9 | `$4fa4` | 0 |
| `$0bfc` | right click | `0` | R0aa | `$507c` | 0 |
| `$0c0e` | is raw key | `0` | R0ab | `$5092` | 0 |
| `$0c1e` | multi bload | `I2,2,0` | R0ac | `$50a2` | 0 |
| `$0c34` | multi bl error | `I` | R0ad | `$540a` | 0 |
| `$0c48` | multi bl ended | `0` | R0ae | `$543a` | 0 |
| `$0c5c` | parse$ | `02,0,2,0` | R0b4 | `$5450` | 0 |
| `$0c70` | move mem | `I0,0t0` | R0b5 | `$5512` | 0 |
| `$0c84` | debug | `I` | R084 | `$467a` | 0 |
