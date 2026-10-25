# Brand browser checks

Run from the Shotcraft product root with the existing Node/Chrome test setup.
The QR decoder is a local test tool, not a production dependency:

```powershell
npm install --prefix ../../output/devsnapkit/whole-card-free-brand/tools --no-save --package-lock=false jsqr
node tests/run-brand-free-browser.mjs
node tests/run-brand-permissions-browser.mjs
node tests/run-brand-legacy-browser.mjs
```

The free-brand runner checks actual downloaded PNGs in ordinary single, old Duo,
and independent Honey layouts. It decodes QR pixels, checks a transparent SVG
logo at 100%/50% opacity, and exercises file recovery and mobile layouts. Its
clipboard test intercepts the `clipboard.write` sink and inspects the real PNG
prepared by the product; it does not claim native OS clipboard permissions passed.

The permissions runner uses the actual startup license verification entrance with
local simulated valid/invalid server replies. No real license or payment is used.
It checks paid gradient/export gates, the current paid high-resolution preset,
and four actual batch downloads with QR pixels intact. Existing legacy “4K”
dimensions are not a uniform 4× multiplier; this test preserves that behavior
and does not certify a future 4× marketing claim.

The history runner uses native keyboard and pointer input to test clearing an
existing saved text badge, Undo/Redo, and leaving focused Brand URL/number drafts
for a canvas drag. These must not leave a transaction open or discard the draft.

Results and dated failure diagnostics are written under
`../../output/devsnapkit/whole-card-free-brand/m1/`.
