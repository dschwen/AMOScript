# Additional AMCAF example assets

`AMCAF_Examples/Data/mod.4spirits` was recovered from [Modland’s Neurodancer collection](https://modland.com/pub/modules/Protracker/Neurodancer/4%20spirits.mod) on 2026-11-10, using the location supplied by the user. The download is stored unchanged under the filename requested by `Protracker.AMOS`.

- Title: `4 spirits`; composer attribution: Neurodancer (Modland directory).
- Size: 233,292 bytes; four-channel `M.K.` Protracker module, 52 orders and 43 patterns.
- SHA-256: `77d3535bcbf378a2e9c06faea48bc114de2ea96bb379c98c6501c93f1a557ffd`.

This is an additional recovered asset, not a change to the original AMOS source or the four originally supplied data files. The builder preloads it as both `Data/mod.4spirits` and `AMCAF_Examples:Data/mod.4spirits` (case-insensitive adapter keys). Protracker now compiles and runs with this module, including its 9xx/E9x playback effects. No additional license grant is asserted here.

The recovered module uses sample-offset (9xx) and retrigger (E9x) effects. It has
no AMCAF synchronization (effect-8) cells, so it cannot supply the text/drum cues
expected by the original example. The music bytes are retained as downloaded;
no synchronization events are invented. See [Anim and current playback limits](../../docs/anim.md).
