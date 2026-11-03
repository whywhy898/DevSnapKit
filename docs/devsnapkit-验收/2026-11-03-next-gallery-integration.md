# NEXT Stage 正式图库接入验收

用户确认原生校样后，要求将模板加入程序。本次接入 NEXT Stage，1080×1920、9:16、Pro。图库共16款，保留5款 Free，Pro增至11款。

- 使用已确认的原生布局、可编辑文字、独立截图和单图回退；不改动渲染器、导出校验或能力策略。
- 缩略图480px宽，完整预览1080px宽，均由实际编辑器下载的PNG生成。来源及哈希记录于 `public/designed/collection/next-stage-provenance.json`。
- 回归测试59项通过，生产构建通过。
- 浏览器9组验证通过：390px免费预览及Pro拦截、正式图库预览、真实Use template应用及Undo/Redo、文字与图层顺序、1x/2x下载、编辑文字、单图、独立上传、Restore/Reset内容保留。
- 产生5份实际下载，包含1080×1920及2160×3840 PNG。模拟有效授权用于本地验收，无真实付款。
- 预览WebP已验证无EXIF/XMP/C2PA块，尺寸和清单哈希匹配。

验收产物：`D:/workspace/MarkMoney/output/devsnapkit/next-gallery-integration-2026-11-03`。

本次将已验证改动接入本地主程序；不包含远程部署或另外两款概念的实现。此前原生校样文档描述的是图库接入前状态，以本次验收为当前状态。
