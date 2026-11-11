# Historical 4 spirits audit input

`modland-4spirits.mod` preserves the previously used raw module fetched from
[Modland's Neurodancer directory](http://modland.com/pub/modules/Protracker/Neurodancer/4%20spirits.mod).
SHA-256: `77d3535bcbf378a2e9c06faea48bc114de2ea96bb379c98c6501c93f1a557ffd`.
The independent `spirits.json` DMA/row audit and its generator use these exact
bytes. This version lacks AMCAF synchronization cells.

The application page instead uses the restored original IMP!-packed
`examples/AMCAF/AMCAF_Examples/Data/mod.4spirits`, SHA-256
`478c5b8653c54d272237aeb7f372e9e353307041ca11e5fa60993d6a4c705685`.
Its unpacked title is `4spirits`; its 997 effect-8 cells drive the original
program's drum/text cues. The two inputs are deliberately kept distinct.
