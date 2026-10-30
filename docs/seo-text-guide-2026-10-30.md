# Screenshot text landing-page optimization

## Scope and evidence

The user approved implementing the next SEO optimization after supplying GSC screenshots. In the displayed baseline, `/add-text-to-image/` has 6 of the site's 10 impressions and its only click. Visible queries include `add text to image` and `how to write on screenshot`. These are early signals; they do not establish stable search volume, ranking, conversion, or an improvement caused by this release.

Improve the existing canonical URL rather than add another tool page. Keep the original authentic comparison, app behavior, `/?editor=1&tool=text` preset and analytics runtime. The updated page has an illustrated, crawlable “How to write on a screenshot” walkthrough, task-specific title/description, contextual CTA and relevant links, a clarification about existing screenshot text, and accurate editable-versus-flattened export guidance. Only this page loads the new stylesheet. Its sitemap lastmod is 2026-10-30.

## Image provenance

Source: the previously published `public/seo/examples/text-original.png`, a screenshot of [MDN grid-template-columns documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-template-columns). SHA-256: `c3af1405db76f79638b17dc01e2c5b934141027c2fd48e437d0d72515dc822f2`.

New illustrations are actual browser captures and a genuine downloaded PNG from the current studio. The workflow uses the existing upload button, Add text, native keyboard typing, Elements → Text, real size/colour/position fields, and the Export tab. The caption is “Understand CSS grid.”; Manrope 38 px, weight 700, colour #182638, text box width 900, centre Y 44. These settings illustrate the current 1200 × 816 canvas; they are not universal defaults.

| Published asset | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| text-guide-upload.webp | 1440 × 1000 | 220936 | d86e39364e2959d5b0625df78ec2d16a1171043dadf9f0ef26b753756224a476 |
| text-guide-edit.webp | 1440 × 1000 | 236150 | 82dfe8b1f31cb4bb769d97ac532866fc43ebae4864272cce9e241ee8c7cace22 |
| text-guide-export.webp | 2400 × 1632 | 652472 | 1b71203c627d15cc6ef579b8c2cab825e4e2b8f17ef10174128decfd21b4fa11 |

All three assets were decoded to raw pixels and re-encoded as lossless WebP. Pixel equality after decoding was asserted. Each file contains only a VP8L image chunk; no EXIF, XMP, ICC, C2PA or private ancillary chunks were retained. This verification concerns embedded metadata only. The page includes intrinsic dimensions, lazy loading, descriptive alt text, and links to full-size captures.

## Reproduction and verification

After `npm run build`:

```sh
# Regenerate illustration assets using the local build and actual editor UI.
node scripts/capture-seo-text-guide.mjs --capture

# Check the built landing page and complete two real upload/text/export flows.
node scripts/capture-seo-text-guide.mjs

# Check production without sending synthetic telemetry to production.
node scripts/capture-seo-text-guide.mjs --origin=https://devsnapkit.com

npm run test:seo
git diff --check
```

Local checks passed: 25 existing SEO tests; production build; 8 browser cases (1440 and 390 complete upload/text/PNG export, layouts at 320/768/1024, dark at 390/1440, JavaScript disabled at 390). The complete local flows verify landing → guide CTA → upload → generated export attribution. Comparison range keyboard interaction, image loading, canonical, single H1, readable guide copy, and no horizontal overflow are checked. Independent read-only review found no actionable issue.

Evidence defaults to `D:/workspace/MarkMoney/output/devsnapkit/seo-text-guide-2026-10-30/`: `capture.json`, `acceptance.json`, guide/page screenshots and actual downloaded PNGs. Set `SEO_GUIDE_OUTPUT` to another directory as needed. Production tests intercept telemetry requests rather than write synthetic events. The test fixtures do not verify production database access, real conversions or payment processing.

The existing bundle-size warning remains. The site still needs post-publication GSC observation; this release makes no guarantee about indexing time, rankings or traffic.
