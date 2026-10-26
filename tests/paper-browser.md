# Paper Launch A1 browser checks

Run from the product root. These tests use the existing workspace Node dependencies and the browser configured by `tests/helpers/browser.mjs` (Edge on this Windows workspace). They run local test-only Vite state drivers and do not change production or make real payments.

## QR decoder prerequisite

The existing Brand test workflow installs `jsqr` into a shared QA tools directory instead of shipping it to the product. If it is not already installed, use:

```powershell
npm install --prefix ../../output/devsnapkit/whole-card-free-brand/tools --no-save --package-lock=false jsqr
```

See `tests/brand-browser.md` for the existing Brand workflow. The Paper runner checks this prerequisite before starting browsers.

## Commands

```powershell
node tests/run-paper-launch-browser.mjs
node tests/run-paper-history-browser.mjs
```

Each run creates a timestamped output directory under `../../output/devsnapkit/template-collection-2026-10-26/a1/`. No previous evidence is overwritten. To choose explicit output directories, set `PAPER_OUTPUT` or `PAPER_HISTORY_OUTPUT` respectively. `PAPER_ORIGIN` / `PAPER_HISTORY_ORIGIN` can select an already running **test-driver** server; an ordinary production build has no state driver and is not suitable for these integration tests.

The launch runner validates real template application, editable text, independent image sources, native drag/numeric Undo, optional single geometry, actual PNG downloads at 1200×630 and 2400×1260, native Logo opacity pixels, QR decoding, two self-authored upload-fixture pairs and simulated 360/390/430 layouts. Upload fixtures are QA content, not actual customer examples. The history runner validates application Undo/Redo, version-correct Restore/Reset, resource failure/retry and a delayed decode racing a newer Brand command.

Neither runner proves physical-phone/IME behavior, OS clipboard round trips, successful online checkout or user visual approval. A1 does not publish Night/Pocket or change Pro entitlements.
