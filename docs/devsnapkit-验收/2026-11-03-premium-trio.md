# DevSnapKit 三款原生模板验收

日期：2026-11-03。状态：本地实现、验证和独立复核完成；未部署、未合并 main。

## 交付

| 模板 | 原生画布 | 主要构图 | 当前档位 |
| --- | --- | --- | --- |
| Violet Launch／紫幕发布 | 1920 × 1080 | 紫黑底、洋红徽标、大字、明暗双手机 | Pro（暂按现有权益） |
| Electric Pair／蓝域双屏 | 1920 × 1080 | 深蓝／钴蓝、浏览器与前景手机 | Pro（暂按现有权益） |
| Peach Editorial／蜜桃刊物 | 1080 × 1350 | 桃杏／珊瑚色、Gelasio 衬线标题、双刊物卡 | Pro（暂按现有权益） |

用户已批准三款视觉方向及同批制作。开放范围询问尚无新回复，因此新增三款暂沿用现有 Pro 规则；原有 12 款定义、次序和档位保持，图库现为 15 款（4 Free＋11 Pro）。未新增付费能力 ID、价格、SKU 或授权协议。

实现使用原生文字层、main／secondary 两个独立媒体槽、现有手机／浏览器／plain 外框、平面旋转、装饰色块和椭圆。没有将整张概念稿设为背景。三款均有 singlePlacement；隐藏副图保留源内容，独立替换不覆盖另一张图。

六张示例 SVG 由 scripts/build-premium-trio-samples.mjs 自制，源、字体许可、尺寸和 SHA256 记录于 premium-trio-samples.json。蜜桃款山景为原创矢量插画，不是照片；设备壳和阴影采用现有原生实现，与 AI 概念稿的材质细节不同。

## 本地查看

- 三款对照页：http://127.0.0.1:5379
- 普通编辑器：http://127.0.0.1:5378/?editor=1 → Templates → 对应名称 → Preview
- 三款支持免费大图预览；Pro 应用仍遵循现有授权检查。本地浏览器验收使用模拟有效许可证回复，不代表真实付款或生产授权后端验收。

对照页左侧是实际 PNG 导出，右侧为原概念参考；可切换真实单图／双图。服务仅绑定 127.0.0.1。

重启对照页：
```powershell
node 'D:/workspace/MarkMoney/output/devsnapkit/premium-template-implementation-2026-11-03/review-server.mjs'
```

在实现工作区重启普通编辑器：
```powershell
node 'D:/workspace/MarkMoney/node_modules/vite/bin/vite.js' --host 127.0.0.1 --port 5378 --strictPort
```

## 验证结果

- 修改前基线：catalog／access／groups／remaining-template 30 项通过。
- 新增契约先观察失败：10 项全部因新 ID 不存在／catalog 缺新项而失败，再实现。
- 最终 20 个集合／模板／素材单元文件：93 项通过、0 失败、0 跳过。
- 新三款完整浏览器验收：21 项检查通过、0 pageerror；覆盖免费预览不写历史、Pro 应用前门禁、真实图库应用、完整 Undo／Redo、可编辑标题、单图隐藏／恢复、独立主副图替换与跨模板保留、390px 预览。
- 每款实际下载默认 PNG 1x／2x、单图 PNG、用户双图 PNG、WebP、JPEG；尺寸均符合蓝图。
- 预览／导出几何最大差异：Violet 0.004850、Electric 0.007353、Peach 0.005452 逻辑像素。
- 原 Pocket 完整浏览器回归：19／19 场景通过。
- 原编辑器 UI／图库浏览器回归：通过。
- npm run build：通过。Vite 有 studio chunk 大于 500KB 的非阻断提示。
- TypeScript、更新后的 8 个浏览器脚本语法和 git diff --check：通过。
- 独立规格复核：通过；独立代码质量复核：通过。复核发现的旧脚本 12 项硬编码与 VM 数组原型问题已修正并复核。

Windows 换行处理：旧 Pro Impact 哈希失败已在原 main 复现，使用未改动的原生成脚本恢复 LF 字节，旧素材及其 manifest 无 Git 差异。新六张 SVG 与 manifest 通过窄范围 .gitattributes 固定 LF，避免今后 checkout 改变哈希；没有弱化哈希断言。

## 证据位置

D:/workspace/MarkMoney/output/devsnapkit/premium-template-implementation-2026-11-03/

- final/results.json：完整 21 项检查与实际导出尺寸。
- final/<template-id>/default-duo-1x.png：最终原生双图。
- final/<template-id>/default-duo-2x.png：最终 2x 原生双图。
- final/<template-id>/single-1x.png：原生单图布局。
- final/<template-id>/user-duo-1x.png：用户素材替换。
- final/<template-id>/*.geometry.json：预览与导出几何比较。
- final/<template-id>/gallery-mobile-390.png：窄屏预览。
- pocket-review-1793677777252/results.json：旧 Pocket 19 场景回归。
- unit-tests.log：93 项单元检查记录。
- index.html／review-server.mjs：对照页与重启入口。

图库 thumbnail 与 preview WebP 均从最终实际下载 PNG 生成，provenance JSON 记录源 PNG、代码与输出哈希；不是 AI 概念稿。生成脚本：scripts/build-premium-trio-previews.mjs。

最终证据目录全部 18 张 PNG 已程序检查：只含 IHDR／IDAT／IEND，无文件尾部附加字节，无 EXIF／XMP／C2PA 文件元数据，无需再次重编码。不涉及像素级水印、外部来源记录或平台标签。

## 工作区

- 路径：D:/workspace/MarkMoney/apps/shotcraft-worktrees/premium-trio
- 分支：codex/premium-template-trio
- 基础提交：06fdb359c48e41bd816ba2d4e74fb675c11d0c57
- 原主工作区 D:/workspace/MarkMoney/apps/shotcraft 保持干净。
- 未推送、未合并、未生产部署；本地服务与分支保留供检查和继续修改。
