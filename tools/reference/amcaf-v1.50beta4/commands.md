# AMCAF V1.50beta4 command inventory

Generated from the supplied binary. Addresses are file offsets. Example counts are token occurrences, not execution coverage.

| Slot 8 offset | Name | Signature | Routine | File address | Example uses |
|---|---|---|---|---|---|
| `$0006` | amcaf base | `0` | R012 | `$22e6` | 0 |
| `$0016` | amcaf version$ | `2` | R013 | `$22ee` | 0 |
| `$002a` | amcaf length | `0` | R014 | `$2330` | 0 |
| `$003c` | amcaf aga notation on | `I` | R050 | `$309c` | 0 |
| `$0058` | amcaf aga notation off | `I` | R051 | `$30a8` | 0 |
| `$0074` | bank permanent | `I0` | R019 | `$2420` | 0 |
| `$008a` | bank temporary | `I0` | R01a | `$2436` | 0 |
| `$00a0` | bank to chip | `I0` | R01b | `$244c` | 0 |
| `$00b4` | bank to fast | `I0` | R01c | `$24cc` | 0 |
| `$00c8` | bank code xor.b | `I0,0` | R022 | `$25c8` | 0 |
| `$00e2` | bank code xor.b | `I0,0t0` | R021 | `$25ae` | 0 |
| `$00ee` | bank code add.b | `I0,0` | R024 | `$25ea` | 0 |
| `$0108` | bank code add.b | `I0,0t0` | R023 | `$25d0` | 0 |
| `$0114` | bank code mix.b | `I0,0` | R026 | `$2614` | 0 |
| `$012e` | bank code mix.b | `I0,0t0` | R025 | `$25f2` | 0 |
| `$013a` | bank code rol.b | `I0,0` | R028 | `$263a` | 0 |
| `$0154` | bank code rol.b | `I0,0t0` | R027 | `$261c` | 0 |
| `$0160` | bank code ror.b | `I0,0` | R02a | `$2660` | 0 |
| `$017a` | bank code ror.b | `I0,0t0` | R029 | `$2642` | 0 |
| `$0186` | bank code xor.w | `I0,0` | R02c | `$2684` | 0 |
| `$01a0` | bank code xor.w | `I0,0t0` | R02b | `$2668` | 0 |
| `$01ac` | bank code add.w | `I0,0` | R02e | `$26a8` | 0 |
| `$01c6` | bank code add.w | `I0,0t0` | R02d | `$268c` | 0 |
| `$01d2` | bank code mix.w | `I0,0` | R030 | `$26d4` | 0 |
| `$01ec` | bank code mix.w | `I0,0t0` | R02f | `$26b0` | 0 |
| `$01f8` | bank code rol.w | `I0,0` | R032 | `$26fc` | 0 |
| `$0212` | bank code rol.w | `I0,0t0` | R031 | `$26dc` | 0 |
| `$021e` | bank code ror.w | `I0,0` | R034 | `$2724` | 0 |
| `$0238` | bank code ror.w | `I0,0t0` | R033 | `$2704` | 0 |
| `$0244` | bank stretch | `I0t0` | R035 | `$272c` | 0 |
| `$025a` | bank copy | `I0t0` | R039 | `$283a` | 0 |
| `$026e` | bank copy | `I0,0t0` | R038 | `$27ce` | 0 |
| `$027a` | bank name$ | `20` | R03b | `$2876` | 0 |
| `$028c` | bank name | `I0,2` | R03a | `$2846` | 0 |
| `$029e` | bank checksum | `00` | R037 | `$27c6` | 0 |
| `$02b4` | bank checksum | `00t0` | R036 | `$27a2` | 0 |
| `$02be` | disk state | `02` | R065 | `$3726` | 0 |
| `$02d0` | disk type | `02` | R064 | `$36b4` | 0 |
| `$02e0` | dos hash | `02` | R063 | `$367a` | 0 |
| `$02f0` | filename$ | `22` | R060 | `$3556` | 0 |
| `$0300` | pattern match | `02,2` | R066 | `$379a` | 0 |
| `$0316` | open workbench | `I` | R0dc | `$5132` | 0 |
| `$032a` | x raster | `0` | R0cc | `$4eba` | 0 |
| `$0338` | y raster | `0` | R0cd | `$4ec8` | 0 |
| `$0346` | raster wait | `I0` | R0ce | `$4eda` | 0 |
| `$0358` | raster wait | `I0,0` | R0cf | `$4ef8` | 0 |
| `$036c` | set ntsc | `I` | R0d0 | `$4f24` | 0 |
| `$037a` | set pal | `I` | R0d1 | `$4f38` | 0 |
| `$0388` | turbo plot | `I0,0,0` | R15c | `$7a36` | 0 |
| `$039e` | turbo point | `00,0` | R15d | `$7aae` | 0 |
| `$03b2` | red val | `00` | R057 | `$329a` | 0 |
| `$03c0` | green val | `00` | R058 | `$32ba` | 0 |
| `$03d0` | blue val | `00` | R059 | `$32e0` | 0 |
| `$03e0` | path$ | `22` | R061 | `$35ae` | 0 |
| `$03ec` | extpath$ | `22` | R062 | `$3602` | 0 |
| `$03fc` | rnc unpack | `I0t0` | R114 | `$63e0` | 0 |
| `$0410` | rnp | `0` | R115 | `$63e6` | 0 |
| `$041a` | reset computer | `I` | R0d7 | `$5010` | 0 |
| `$042e` | rrggbb to rgb | `00` | R05a | `$3302` | 0 |
| `$0442` | rgb to rrggbb | `00` | R05b | `$3324` | 0 |
| `$0456` | wload | `I2,0` | R068 | `$386a` | 0 |
| `$0464` | dload | `I2,0` | R067 | `$3810` | 0 |
| `$0472` | wsave | `I2,0` | R069 | `$38c2` | 0 |
| `$0480` | dsave | `I2,0` | R069 | `$38c2` | 0 |
| `$048e` | file copy | `I2t2` | R06c | `$397e` | 0 |
| `$04a0` | nop | `I` | R015 | `$233a` | 0 |
| `$04aa` | nfn | `0` | R016 | `$233c` | 0 |
| `$04b4` | pptodisk | `I2,0` | R0eb | `$5a04` | 0 |
| `$04c6` | pptodisk | `I2,0,0` | R0ea | `$58f2` | 0 |
| `$04d2` | ppunpack | `I0t0` | R0ec | `$5a0c` | 0 |
| `$04e4` | ppfromdisk | `I2,0` | R0ed | `$5aa0` | 0 |
| `$04f8` | binexp | `00` | R0c2 | `$4cca` | 0 |
| `$0506` | binlog | `00` | R0c3 | `$4ce2` | 0 |
| `$0514` | extbase | `00` | R085 | `$3cae` | 0 |
| `$0522` | io error$ | `20` | R0ad | `$4772` | 0 |
| `$0532` | io error | `0` | R0ac | `$4760` | 0 |
| `$0540` | scrn rastport | `0` | R117 | `$65d6` | 0 |
| `$0554` | scrn bitmap | `0` | R118 | `$65e8` | 0 |
| `$0566` | scrn layerinfo | `0` | R119 | `$65fa` | 0 |
| `$057a` | scrn layer | `0` | R11a | `$660c` | 0 |
| `$058a` | scrn region | `0` | R11b | `$661e` | 0 |
| `$059c` | change font | `I2` | R08e | `$4042` | 0 |
| `$05b0` | change font | `I2,0` | R08f | `$404a` | 0 |
| `$05ba` | change font | `I2,0,0` | R090 | `$4050` | 0 |
| `$05c6` | font style | `0` | R091 | `$411e` | 0 |
| `$05d6` | flush libs | `I` | R0db | `$50e6` | 0 |
| `$05e6` | fcircle | `I0,0,0` | R15e | `$7b1a` | 0 |
| `$05f8` | fellipse | `I0,0,0,0` | R15f | `$7b24` | 0 |
| `$060e` | cpu | `0` | R0d8 | `$5046` | 0 |
| `$0618` | fpu | `0` | R0d9 | `$508a` | 0 |
| `$0622` | launch | `I2` | R0dd | `$514e` | 0 |
| `$0630` | launch | `I2,0` | R0de | `$515a` | 0 |
| `$063a` | examine dir | `I2` | R06d | `$3a52` | 0 |
| `$064c` | examine next$ | `2` | R06e | `$3aa0` | 0 |
| `$0660` | examine stop | `I` | R06f | `$3ad6` | 0 |
| `$0672` | examine object | `I2` | R070 | `$3af6` | 0 |
| `$0688` | object type | `0` | R074 | `$3b58` | 0 |
| `$069a` | object type | `02` | R073 | `$3b50` | 0 |
| `$06a2` | object size | `0` | R076 | `$3b6c` | 0 |
| `$06b4` | object size | `02` | R075 | `$3b64` | 0 |
| `$06bc` | object blocks | `0` | R078 | `$3b80` | 0 |
| `$06d0` | object blocks | `02` | R077 | `$3b78` | 0 |
| `$06d8` | object name$ | `2` | R072 | `$3b40` | 0 |
| `$06ec` | object name$ | `22` | R071 | `$3b38` | 0 |
| `$06f4` | object date | `0` | R07a | `$3b94` | 0 |
| `$0706` | object date | `02` | R079 | `$3b8c` | 0 |
| `$070e` | object time | `0` | R07c | `$3ba8` | 0 |
| `$0720` | object time | `02` | R07b | `$3ba0` | 0 |
| `$0728` | object protection$ | `20` | R07f | `$3bd0` | 0 |
| `$0742` | object protection | `0` | R07e | `$3bc4` | 0 |
| `$075a` | object protection | `02` | R07d | `$3bbc` | 0 |
| `$0762` | object comment$ | `2` | R081 | `$3c14` | 0 |
| `$0778` | object comment$ | `22` | R080 | `$3c0c` | 0 |
| `$0780` | protect object | `I2,0` | R082 | `$3c22` | 0 |
| `$0798` | set object comment | `I2,2` | R083 | `$3c40` | 0 |
| `$07b4` | set sprite priority | `I0` | R0d2 | `$4f4c` | 0 |
| `$07ce` | current date | `0` | R140 | `$70e4` | 0 |
| `$07e0` | current time | `0` | R141 | `$7100` | 0 |
| `$07f2` | cd year | `00` | R142 | `$7124` | 0 |
| `$0800` | cd month | `00` | R143 | `$714e` | 0 |
| `$0810` | cd day | `00` | R144 | `$7156` | 0 |
| `$081e` | cd weekday | `00` | R145 | `$7160` | 0 |
| `$0830` | ct hour | `00` | R149 | `$72de` | 0 |
| `$083e` | ct minute | `00` | R14a | `$72f0` | 0 |
| `$084e` | ct second | `00` | R14b | `$7302` | 0 |
| `$085e` | ct tick | `00` | R14c | `$7314` | 0 |
| `$086c` | mask copy | `I0t0,0` | R0ae | `$4776` | 0 |
| `$0882` | mask copy | `I0,0,0,0,0t0,0,0,0` | R0af | `$47bc` | 0 |
| `$089a` | mask copy | `I0,0,0,0,0t0,0,0,0,0` | R0b0 | `$47c8` | 0 |
| `$08b4` | scanstr$ | `20` | R116 | `$63e8` | 0 |
| `$08c4` | chr.w$ | `20` | R0b3 | `$497e` | 0 |
| `$08d2` | chr.l$ | `20` | R0b4 | `$4998` | 0 |
| `$08e0` | pjoy | `00` | R00b | `$20f4` | 0 |
| `$08ec` | pjleft | `00` | R00c | `$2134` | 0 |
| `$08fa` | pjright | `00` | R00d | `$215e` | 0 |
| `$0908` | pjup | `00` | R00e | `$2188` | 0 |
| `$0914` | pjdown | `00` | R00f | `$21b0` | 0 |
| `$0922` | pfire | `00` | R010 | `$21da` | 0 |
| `$092e` | lsl | `00,0` | R0c4 | `$4d02` | 0 |
| `$093a` | lsr | `00,0` | R0c5 | `$4d0c` | 0 |
| `$0946` | wordswap | `00` | R0c6 | `$4d16` | 0 |
| `$0956` | audio lock | `I` | R017 | `$2340` | 0 |
| `$0966` | audio free | `I` | R018 | `$23e6` | 0 |
| `$0976` | convert grey | `I0t0` | R04f | `$3098` | 0 |
| `$098c` | asc.w | `02` | R0b5 | `$49b0` | 0 |
| `$0998` | asc.l | `02` | R0b6 | `$49c4` | 0 |
| `$09a4` | amos task | `0` | R153 | `$7538` | 0 |
| `$09b4` | amos cli | `0` | R155 | `$759e` | 0 |
| `$09c2` | command name$ | `2` | R154 | `$754c` | 0 |
| `$09d6` | tool types$ | `22` | R156 | `$75b6` | 0 |
| `$09e8` | ham colour | `00,0` | R0a1 | `$442a` | 0 |
| `$09fc` | ham best | `00,0` | R0a2 | `$447c` | 0 |
| `$0a0e` | glue colour | `00,0,0` | R056 | `$3280` | 0 |
| `$0a24` | ptile bank | `I0` | R10d | `$61f4` | 0 |
| `$0a36` | paste ptile | `I0,0,0` | R10e | `$6200` | 0 |
| `$0a4c` | extdefault | `I0` | R086 | `$3ccc` | 0 |
| `$0a5e` | extremove | `I0` | R087 | `$3cf8` | 0 |
| `$0a6e` | extreinit | `I0` | R088 | `$3d28` | 0 |
| `$0a7e` | td stars bank | `I0,0` | R130 | `$6da4` | 0 |
| `$0a94` | td stars limit | `I` | R131 | `$6dda` | 0 |
| `$0aaa` | td stars limit | `I0,0t0,0` | R132 | `$6e12` | 0 |
| `$0ab8` | td stars origin | `I0,0` | R133 | `$6e50` | 0 |
| `$0ad0` | td stars init | `I` | R134 | `$6e66` | 0 |
| `$0ae4` | td stars single do | `I` | R139 | `$6f06` | 0 |
| `$0afc` | td stars double do | `I` | R13a | `$6f12` | 0 |
| `$0b14` | td stars single del | `I` | R13b | `$6f1e` | 0 |
| `$0b2e` | td stars double del | `I` | R13c | `$6f88` | 0 |
| `$0b48` | td stars move | `I` | R13d | `$6ff4` | 0 |
| `$0b5c` | td stars move | `I0` | R13e | `$701c` | 0 |
| `$0b64` | td stars draw | `I` | R13f | `$7046` | 0 |
| `$0b78` | td stars gravity | `I0,0` | R135 | `$6ea0` | 0 |
| `$0b92` | td stars accelerate on | `I` | R136 | `$6eb2` | 0 |
| `$0bae` | td stars accelerate off | `I` | R137 | `$6ebc` | 0 |
| `$0bcc` | td stars planes | `I0,0` | R138 | `$6ec6` | 0 |
| `$0be4` | sdeek | `00` | R0c7 | `$4d1e` | 0 |
| `$0bf0` | speek | `00` | R0c8 | `$4d2a` | 0 |
| `$0bfc` | pix shift up | `I0,0,0,0,0t0,0` | R0e3 | `$5366` | 0 |
| `$0c1c` | pix shift up | `I0,0,0,0,0t0,0,0` | R0e2 | `$527a` | 0 |
| `$0c32` | pix shift down | `I0,0,0,0,0t0,0` | R0e5 | `$5530` | 0 |
| `$0c54` | pix shift down | `I0,0,0,0,0t0,0,0` | R0e4 | `$5444` | 0 |
| `$0c6a` | pix brighten | `I0,0,0,0,0t0,0` | R0e7 | `$56ce` | 0 |
| `$0c8a` | pix brighten | `I0,0,0,0,0t0,0,0` | R0e6 | `$560e` | 0 |
| `$0ca0` | pix darken | `I0,0,0,0,0t0,0` | R0e9 | `$5840` | 0 |
| `$0cbe` | pix darken | `I0,0,0,0,0t0,0,0` | R0e8 | `$5780` | 0 |
| `$0cd4` | make pix mask | `I0,0,0t0,0,0` | R0e1 | `$51ee` | 0 |
| `$0cf2` | count pixels | `00,0,0,0t0,0` | R05c | `$3356` | 0 |
| `$0d10` | coords bank | `I0` | R05d | `$33f4` | 0 |
| `$0d24` | coords bank | `I0,0` | R05e | `$3406` | 0 |
| `$0d2e` | coords read | `I0,0,0,0t0,0,0,0` | R05f | `$3442` | 0 |
| `$0d4e` | splinters bank | `I0,0` | R120 | `$699c` | 0 |
| `$0d66` | splinters limit | `I` | R123 | `$69ea` | 0 |
| `$0d7c` | splinters limit | `I0,0t0,0` | R124 | `$6a14` | 0 |
| `$0d8a` | splinters gravity | `I0,0` | R125 | `$6a46` | 0 |
| `$0da4` | splinters init | `I` | R127 | `$6a80` | 0 |
| `$0db8` | splinters colour | `I0,0` | R126 | `$6a58` | 0 |
| `$0dd2` | splinters single do | `I` | R128 | `$6aa4` | 0 |
| `$0dec` | splinters double do | `I` | R129 | `$6ab4` | 0 |
| `$0e06` | splinters single del | `I` | R12a | `$6ac4` | 0 |
| `$0e20` | splinters double del | `I` | R12b | `$6b86` | 0 |
| `$0e3a` | splinters move | `I` | R12c | `$6c52` | 0 |
| `$0e4e` | splinters draw | `I` | R12e | `$6d02` | 0 |
| `$0e62` | splinters max | `I0` | R121 | `$69d2` | 0 |
| `$0e76` | splinters back | `I` | R12d | `$6c94` | 0 |
| `$0e8a` | imploder unpack | `I0t0` | R089 | `$3d88` | 1 |
| `$0ea2` | imploder load | `I2,0` | R08a | `$3df0` | 0 |
| `$0eb8` | lzstr$ | `20,0` | R0b1 | `$480a` | 0 |
| `$0ec8` | lsstr$ | `20,0` | R0b2 | `$48ae` | 0 |
| `$0ed8` | write cli | `I2` | R0d6 | `$4ff4` | 0 |
| `$0ee8` | mix colour | `00,0` | R054 | `$31a0` | 0 |
| `$0efc` | mix colour | `00,0,0t0` | R055 | `$31da` | 0 |
| `$0f0a` | cd date$ | `20` | R148 | `$7218` | 0 |
| `$0f1a` | ct time$ | `20` | R14d | `$7326` | 0 |
| `$0f2a` | splinters fuel | `I0` | R122 | `$69de` | 0 |
| `$0f40` | splinters active | `0` | R12f | `$6d6a` | 0 |
| `$0f56` | shade bob mask | `I0` | R11c | `$6630` | 0 |
| `$0f6c` | shade bob planes | `I0` | R11d | `$6646` | 0 |
| `$0f84` | shade bob up | `I0,0,0,0` | R11e | `$6664` | 0 |
| `$0f9e` | shade bob down | `I0,0,0,0` | R11f | `$6802` | 0 |
| `$0fba` | ham fade out | `I0` | R0a3 | `$45ba` | 0 |
| `$0fce` | bank delta encode | `I0` | R01e | `$2578` | 0 |
| `$0fe8` | bank delta encode | `I0t0` | R01d | `$254c` | 0 |
| `$0ff2` | bank delta decode | `I0` | R020 | `$25a6` | 0 |
| `$100c` | bank delta decode | `I0t0` | R01f | `$2580` | 0 |
| `$1016` | turbo draw | `I0,0t0,0,0` | R15a | `$7780` | 0 |
| `$1030` | turbo draw | `I0,0t0,0,0,0` | R15b | `$779e` | 0 |
| `$1042` | blitter fill | `I0,0` | R04a | `$2e54` | 0 |
| `$1058` | blitter fill | `I0,0t0,0` | R049 | `$2e2c` | 0 |
| `$1066` | blitter fill | `I0,0,0,0,0,0` | R048 | `$2e1c` | 0 |
| `$1078` | blitter fill | `I0,0,0,0,0,0t0,0` | R04b | `$2e7c` | 0 |
| `$108e` | pt play | `I0` | R108 | `$614e` | 0 |
| `$109e` | pt play | `I0,0` | R109 | `$6154` | 0 |
| `$10a8` | pt stop | `I` | R10b | `$61b6` | 0 |
| `$10b6` | pt signal | `0` | R10c | `$61dc` | 0 |
| `$10c6` | pt volume | `I0` | R105 | `$60a4` | 0 |
| `$10d6` | pt voice | `I0` | R106 | `$60c2` | 0 |
| `$10e6` | pt vu | `00` | R104 | `$607e` | 0 |
| `$10f2` | pt cia speed | `I0` | R103 | `$6036` | 0 |
| `$1106` | qsin | `00,0` | R112 | `$6346` | 1 |
| `$1114` | qcos | `00,0` | R111 | `$633c` | 1 |
| `$1122` | vec rot pos | `I0,0,0` | R002 | `$1f74` | 0 |
| `$1138` | vec rot angles | `I0,0,0` | R003 | `$1f8c` | 0 |
| `$1152` | vec rot precalc | `I` | R004 | `$1fb6` | 0 |
| `$1168` | vec rot x | `0` | R006 | `$20ae` | 0 |
| `$1178` | vec rot x | `00,0,0` | R005 | `$20a2` | 0 |
| `$1184` | vec rot y | `0` | R008 | `$20ca` | 0 |
| `$1194` | vec rot y | `00,0,0` | R007 | `$20bc` | 0 |
| `$11a0` | change print font | `I0` | R08d | `$402c` | 0 |
| `$11b8` | qrnd | `00` | R110 | `$630a` | 0 |
| `$11c4` | vec rot z | `0` | R00a | `$20e6` | 0 |
| `$11d4` | vec rot z | `00,0,0` | R009 | `$20d8` | 0 |
| `$11e0` | cop pos | `0` | R0d3 | `$4f5c` | 0 |
| `$11ee` | make bank font | `I0` | R08b | `$3e98` | 0 |
| `$1204` | change bank font | `I0` | R08c | `$3f8e` | 0 |
| `$121c` | blitter clear | `I0,0` | R046 | `$2d1e` | 0 |
| `$1234` | blitter clear | `I0,0,0,0t0,0` | R047 | `$2d3e` | 0 |
| `$1246` | blitter busy | `0` | R044 | `$2cee` | 0 |
| `$1258` | blitter wait | `I` | R045 | `$2d02` | 0 |
| `$126a` | shade pix | `I0,0` | R0df | `$51a0` | 0 |
| `$127e` | shade pix | `I0,0,0` | R0e0 | `$51a8` | 0 |
| `$128a` | blitter copy limit | `I0` | R03c | `$289c` | 0 |
| `$12a4` | blitter copy limit | `I0,0t0,0` | R03d | `$28be` | 0 |
| `$12b2` | blitter copy | `I0,0t0,0` | R03e | `$28f4` | 0 |
| `$12cc` | blitter copy | `I0,0t0,0,0` | R03f | `$28fe` | 0 |
| `$12dc` | blitter copy | `I0,0,0,0t0,0` | R040 | `$2a00` | 0 |
| `$12ee` | blitter copy | `I0,0,0,0t0,0,0` | R041 | `$2a0a` | 0 |
| `$1302` | blitter copy | `I0,0,0,0,0,0t0,0` | R042 | `$2b52` | 0 |
| `$1318` | blitter copy | `I0,0,0,0,0,0t0,0,0` | R043 | `$2b60` | 0 |
| `$1330` | set rain colour | `I0,0` | R0c9 | `$4d38` | 0 |
| `$1348` | rain fade | `I0,0` | R0ca | `$4d60` | 0 |
| `$135c` | rain fade | `I0t0` | R0cb | `$4df0` | 0 |
| `$1366` | qsqr | `00` | R10f | `$62a6` | 0 |
| `$1372` | bcircle | `I0,0,0,0` | R161 | `$7df4` | 0 |
| `$1386` | pt data base | `0` | R0fd | `$5f7a` | 0 |
| `$1398` | pt instr address | `00` | R101 | `$5fd2` | 0 |
| `$13b0` | pt instr length | `00` | R102 | `$6006` | 0 |
| `$13c6` | pt bank | `I0` | R107 | `$612c` | 0 |
| `$13d4` | pt instr play | `I0` | R0fe | `$5f8c` | 0 |
| `$13ea` | pt instr play | `I0,0` | R0ff | `$5f9e` | 0 |
| `$13f4` | pt instr play | `I0,0,0` | R100 | `$5fa8` | 0 |
| `$1400` | pt sam stop | `I0` | R0f7 | `$5e70` | 0 |
| `$1412` | pt raw play | `I0,0,0,0` | R0f8 | `$5eb0` | 0 |
| `$142a` | pt sam bank | `I0` | R0f9 | `$5ec4` | 0 |
| `$143c` | pt sam play | `I0` | R0fa | `$5ed6` | 0 |
| `$1450` | pt sam play | `I0,0` | R0fb | `$5f0c` | 0 |
| `$145a` | pt sam play | `I0,0,0` | R0fc | `$5f42` | 0 |
| `$1466` | pt sam volume | `I0` | R0f4 | `$5db8` | 0 |
| `$147c` | pt sam volume | `I0,0` | R0f5 | `$5dd0` | 0 |
| `$1486` | pal get screen | `I0,0` | R14f | `$746c` | 0 |
| `$149e` | pal set screen | `I0,0` | R150 | `$749c` | 0 |
| `$14b6` | pal get | `00,0` | R151 | `$74d4` | 0 |
| `$14c6` | pal set | `I0,0,0` | R152 | `$7506` | 0 |
| `$14d8` | exchange bob | `I0,0` | R0d4 | `$4f64` | 0 |
| `$14ee` | exchange icon | `I0,0` | R0d5 | `$4fac` | 0 |
| `$1504` | best pen | `00` | R052 | `$30b4` | 0 |
| `$1514` | best pen | `00,0t0` | R053 | `$30ca` | 0 |
| `$1520` | bzoom | `I0,0,0,0,0t0,0,0,0` | R160 | `$7b76` | 0 |
| `$153c` | x smouse | `0` | R0a4 | `$4656` | 0 |
| `$154a` | y smouse | `0` | R0a5 | `$466a` | 0 |
| `$1558` | smouse x | `I0` | R0a6 | `$467e` | 0 |
| `$1568` | smouse y | `I0` | R0a7 | `$4690` | 0 |
| `$1578` | smouse speed | `I0` | R0aa | `$4702` | 0 |
| `$158c` | smouse key | `0` | R0ab | `$472a` | 0 |
| `$159c` | limit smouse | `I` | R0a8 | `$46a2` | 0 |
| `$15b0` | limit smouse | `I0,0t0,0` | R0a9 | `$46e4` | 0 |
| `$15be` | xfire | `00,0` | R011 | `$2202` | 0 |
| `$15cc` | pt continue | `I` | R10a | `$618e` | 0 |
| `$15de` | pt cpattern | `0` | R0f0 | `$5d2e` | 0 |
| `$15f0` | pt cpos | `0` | R0f1 | `$5d40` | 0 |
| `$15fe` | pt cinstr | `00` | R0f2 | `$5d54` | 0 |
| `$160e` | pt cnote | `00` | R0f3 | `$5d7e` | 0 |
| `$161e` | pt sam freq | `I0,0` | R0f6 | `$5e16` | 0 |
| `$1632` | vclip | `00,0t0` | R0b7 | `$49d6` | 4 |
| `$1642` | vin | `00,0t0` | R0b8 | `$49ec` | 0 |
| `$1650` | vmod | `00,0` | R0b9 | `$4a06` | 0 |
| `$165e` | vmod | `00,0t0` | R0ba | `$4a30` | 0 |
| `$166a` | insstr$ | `22,2,0` | R0bb | `$4a64` | 0 |
| `$167c` | cutstr$ | `22,0t0` | R0bc | `$4ace` | 0 |
| `$168e` | replacestr$ | `22,2t2` | R0bd | `$4b3e` | 0 |
| `$16a4` | itemstr$ | `22,0` | R0be | `$4c1c` | 0 |
| `$16b6` | itemstr$ | `22,0,2` | R0bf | `$4c2a` | 0 |
| `$16c2` | qarc | `00,0` | R113 | `$6370` | 0 |
| `$16d0` | even | `00` | R0c1 | `$4cba` | 0 |
| `$16dc` | odd | `00` | R0c0 | `$4cae` | 0 |
| `$16e6` | ham point | `00,0` | R0a0 | `$4332` | 0 |
| `$16f8` | set object date | `I2,0,0` | R084 | `$3c74` | 0 |
| `$1712` | aga detect | `0` | R0da | `$50c4` | 0 |
| `$1722` | pal spread | `I0,0t0,0` | R14e | `$738a` | 3 |
| `$173a` | ct string | `02` | R146 | `$7172` | 0 |
| `$174a` | cd string | `02` | R147 | `$71c8` | 0 |
| `$175a` | c2p convert | `I0,0,0t0,0,0` | R04e | `$3056` | 2 |
| `$1776` | c2p shift | `I0,0,0t0,0` | R04d | `$3012` | 2 |
| `$178e` | c2p fire | `I0,0,0t0,0` | R04c | `$2fc2` | 2 |
| `$17a6` | sload | `I0t0,0` | R06a | `$3908` | 0 |
| `$17b6` | ssave | `I0,0t0` | R06b | `$3942` | 0 |
| `$17c6` | pt free voice | `0` | R0ee | `$5ba0` | 0 |
| `$17da` | pt free voice | `00` | R0ef | `$5ba8` | 0 |
| `$17e2` | alloc trans source | `I0` | R092 | `$413a` | 0 |
| `$17fc` | set trans source | `I0` | R093 | `$4162` | 1 |
| `$1814` | alloc trans map | `I0,0,0` | R094 | `$4174` | 1 |
| `$182e` | set trans map | `I0,0,0` | R095 | `$41b0` | 0 |
| `$1846` | alloc code bank | `I0,0` | R096 | `$41d6` | 1 |
| `$185e` | trans screen runtime | `I0,0,0,0` | R098 | `$4240` | 1 |
| `$1880` | trans screen static | `I0,0,0,0` | R09a | `$431c` | 0 |
| `$18a0` | trans screen dynamic | `I0,0,0,0` | R099 | `$4292` | 0 |
| `$18c2` | turbo text | `I0,0,2` | R157 | `$764a` | 0 |
| `$18d8` | turbo text | `I0,0,2,0` | R158 | `$7650` | 0 |
| `$18e6` | turbo text | `I0,0,2,0,0` | R159 | `$7658` | 0 |
