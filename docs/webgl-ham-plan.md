# WebGL HAM implementation plan

Target: render the existing bounded CPU HAM6 contract entirely on WebGL2, using
original planar chip bytes. Include five-plane HAM, row-local palettes, cropped
history, scroll offsets, sprite priority and the existing presentation lifecycle.
Do not change the snapshot ABI or AMOS raw-command drawing semantics.

1. Represent each source-pixel command as a packed RGB12 value plus a RGB12
   write mask. Palette commands replace all channels; modify commands replace
   one channel. Combining consecutive masked writes is associative.
2. Decode HAM commands directly from chip textures into a source-coordinate
   R32UI target. Include cropped commands from the window origin; cap the source
   span at the CPU reference's 4096 pixels and preflight texture/fetch bounds.
3. Use two owned ping-pong R32UI targets for an inclusive parallel prefix scan,
   doubling the preceding span each pass. This avoids a linear history walk in
   every output fragment. Reset each row from that row's COLOR00.
4. Resolve each visible native sample through its scanned source entry, then
   compose sprites with the existing raw-index priority rules. Borders and
   disabled DMA keep COLOR00; non-HAM frames keep their two-pass path.
5. Reallocate, restore and dispose scan targets with the renderer's owned GPU
   resources. Never feed CPU-resolved colour pixels into a HAM render pass.
6. Compare native GPU readback with independent HAM ILBM/PNG goldens and CPU
   matrices: five/six planes, long carries, row resets, cropped prefixes,
   source scroll, mixed modes, sprites, malformed frames and context loss.
   Publish the checks as a repository demo and exercise the ASM limited intro's
   HAM title through the GPU. Rebuild demos, run core checks and browser tests.

HAM8, hires/dual-playfield HAM, mid-line events, unverified fetch history outside
our display-window contract and exact Amiga timing remain outside this milestone.
Performance claims are limited to logarithmic scan pass count, not device timings.

Implementation status: the GPU scan, bounded validation, lifecycle handling,
standalone parity demo and WebGL ASM intro are implemented on the feature branch.
Final repository/core/browser validation is recorded with the completed change.
