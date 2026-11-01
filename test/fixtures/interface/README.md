# Interface system-resource reference

`default-resource.abk` is the unmodified
`AMOS/APSystem/AMOSPro_Default_Resource.Abk` from the
[official AMOS Professional source](https://github.com/AOZ-Studio/AMOS-Professional-Official/tree/533b4b1f5acd604814513f78e02c7b4796cb0531),
commit `533b4b1f5acd604814513f78e02c7b4796cb0531` (MIT license, included here).
Download verification checked its Git blob ID against the pinned tree.

Size: 9,946 bytes. SHA-256:
`8044d44b249b1a7aa4474cbcaaf55c88145b787f2debfdf3986f1463a5bea056`.

After the 20-byte ABK header, the Resource payload has graphics at offset26,
93 puzzle pointers, and screen metadata at offset400. It specifies eight
colours and control word `$b200`; Resource Screen Open masks that to hires
`$8000`. The following 32 palette words start at file offset424. Tests compare
the embedded screen-only defaults against these independent bytes. The runtime
does not yet embed or unpack the default graphics, messages or dialogue programs.
