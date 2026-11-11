# Editor onboarding v1

Stay on `feat/editor-onboarding-v1`; do not push or deploy. Do not inspect secrets or environment files.

1. Add regression coverage for screenshot-aware text placement, direct editor entry, free/Pro export controls, and keyboard modal dismissal.
2. Measure rendered screenshot bounds in logical canvas coordinates. Prefer the top margin, otherwise the largest usable outer margin. Reserve padding when needed, retaining text editing, selection, and history behavior.
3. Remove the obsolete welcome component and its runtime storage flags. Preserve existing payment, URL API, legal, and admin entry routing.
4. Label the existing free 1x/2x and Pro 4x presets truthfully. Keep free batch controls unchecked and locked; route their activation to Pro. Preserve Pro selections.
5. Share Escape, initial focus, focus containment, and focus restoration across upgrade, license, success, shortcuts, and legal dialogs.
6. Run focused browser regressions, existing text tests, the six requested test scripts, and the production build. Restore generated legal files only if differences are line endings. Review and commit logical changes; verify a clean worktree.

License/export finding: single mockup export gates the scale-4 preset behind Pro; batch export is Pro. `getCanonicalDimensions` makes this a 4K preset, usually a 3840-pixel longest edge (4:3 is 3200×2400; YouTube is 3840×2160). Free 2x is twice the base dimensions except 16:9/YouTube, which use 2560×1440. Keep the actual dimensions visible.

Implementation and requested validation are finished. See [the review and verification report](../editor-onboarding-v1-review.md) for tester steps, exact export presets, results, changed files, and the remaining Git permission / existing 8px browser-assertion issues. Commit and clean-worktree steps are blocked because the managed sandbox cannot create `.git/index.lock`.
