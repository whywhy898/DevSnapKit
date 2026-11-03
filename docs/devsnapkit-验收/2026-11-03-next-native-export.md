# NEXT：真实原生导出验收

日期：2026-11-03。状态：NEXT 原生校样、真实 PNG 下载和独立复核已完成，待用户视觉评审。

## 交付与范围

- 原生画布：1080 × 1920，9:16。
- 实际下载 1x：corrected/default-duo-1x.png，1080 × 1920。
- 实际下载 2x：corrected/default-duo-2x.png，2160 × 3840。
- 单图校样：corrected/single-1x.png。
- 原生文字编辑校样：corrected/edited-headline-1x.png（NEXT 改为 BOLD）。
- 独立用户图替换：corrected/user-duo-1x.png。
- 对照页面：http://127.0.0.1:5392。

这是用户认可 NEXT 概念后要求的真实原生校样。仅制作 NEXT，尚未制作 LOUD LAUNCH 或 REDLINE。当前公开图库保持 15 款，NEXT 尚未进入普通 Templates 列表，未确定公开免费／Pro 档位，未改权限协议或价格。

原生文档由 existing buildCuratedSnapshot 工厂构建，经 tests/vite-mockup-baseline.config.mjs 的现有测试入口装载；使用正式 CompositionRenderer、MediaShell、文字渲染器、Export／Download 控件和实际浏览器下载流。测试入口使用模拟 Pro 状态，不涉及真实支付。不能将此次结果描述为“用户已从公开图库应用 NEXT”。

## 原生内容

- NEXT 四行字为 Manrope 512px 原生文字层，在两部手机下方绘制；仍可通过 Inspector 修改。
- 主手机为暗色播放页，副手机为浅色收藏页，两张独立 SVG 截图可分别替换。
- 背景为原生深色，细椭圆线为原生装饰；无整张概念海报背景。
- 独立专辑封面由内置 image_gen 制作，像素重编码去除文件元数据后嵌入两个自制界面。封面可复用同一专辑内容，两张 UI 内容不同。
- 界面示例为虚构 Sample tone，无真实客户／艺人数据。字体与素材来源清单：public/designed/examples/next-stage/samples.json。
- 当前采用原生手机边框与状态栏；金属边缘、反射细节、字形和色调与 AI 概念稿存在差异，视觉还原效果由用户评审。

## 实际发现与修正

首轮真实下载被原有边界保护拦住，未形成有效 PNG：
1. 巨字 CSS 高度约 1782，但实际 scrollHeight 为 1908；初始 top38 使实际范围越过 1920 底边。
2. 主手机旋转后的右边为 1084.284，超出画布约 4.284px。

先在浏览器加入真实 textBoxIssue 和媒体 DOM 旋转边界断言，观察失败；随后只修正原生模板坐标：标题 top4、主手机 x450、单图 x420。保留字号、行高、所有导出边界检查；没有启用裁切绕过或修改渲染器。

首轮证据保留于 first/，边界诊断在 bounds-diagnostic/；最终交付来自 corrected/。

## 验证

- 原有 catalog／access／trio／geometry 基线：29 项通过。
- 新工厂契约先观察 6 项 missing-ID 失败，另 1 项公开图库不变检查通过。
- 新素材检查先观察缺失素材失败，再生成实际示例。
- 最终聚焦单元／兼容检查：45 项通过，0 失败、0 跳过。
- 实际浏览器：8 组检查全部通过，0 pageerror。
- 下载 5 张真实 PNG：默认 1x／2x、编辑文字、单图、替换用户图。
- 预览／导出最大几何差异：0.0060649671 个逻辑像素；单图 0.0031025718。
- 原生文字编辑和 Undo；整份文档装载 Undo／Redo；隐藏副图保持源内容；独立替图保留另一来源；Restore layout／Reset 保留用户图片及文字，均通过。
- TypeScript 和 npm run build 通过。Vite 提示 studio chunk 大于 500KB，构建退出码为 0。
- 独立规格复核通过；独立代码质量复核通过，包含素材哈希及干净目录重建。
- PNG 元数据核验：5 个真实下载文件仅含 IHDR／IDAT／IEND，无尾部附加字节，无 EXIF／XMP／C2PA 文件元数据，不需要重编码实际导出。详见 delivery-verification.json。

Windows 可复现处理：两张 SVG、samples.json、album-cover-provenance.json 固定 LF。来源 JSON 已实际归一化为 LF 并刷新清单哈希；封面 PNG 与两张 SVG 字节未改变。独立干净目录重建得到完全相同的 SVG 和清单。

## 文件与重启

输出根目录：D:/workspace/MarkMoney/output/devsnapkit/next-native-export-2026-11-03

- corrected/results.json：实际浏览器结果。
- corrected/*.geometry.json：预览／导出层级、几何、原生阴影及圆角。
- corrected/*.snapshot.json：原生默认、单图和用户图文档。
- corrected/native-layers.json：真实 DOM 文字层、媒体 z-index、边界与实际文字校验。
- delivery-verification.json：下载文件尺寸、像素／文件哈希和 PNG 结构。
- index.html／review-server.mjs：本地对照页面。
- reencode_artwork.py：独立封面元数据去除及像素一致验证。
- public/designed/examples/next-stage/album-cover-provenance.json：内置生成工具、完整提示词、封面来源和像素哈希（位于实现工作区）。

重启对照页面：
```powershell
node 'D:/workspace/MarkMoney/output/devsnapkit/next-native-export-2026-11-03/review-server.mjs'
```

从实现工作区复跑真实导出：
```powershell
node tests/run-next-native-browser.mjs
```

默认使用新的时间戳证据目录，不覆盖已交付校样；可用 NEXT_OUTPUT 指定新的独立目录。默认测试服务5391随浏览器检查启动和关闭。

## 工作区

- 路径：D:/workspace/MarkMoney/apps/shotcraft-worktrees/next-native。
- 分支：codex/next-native-export。
- 基础提交：95b7e83a1af905f59de6790f8eeb4b1d2679ad38。
- 源 checkout D:/workspace/MarkMoney/apps/shotcraft 保持其原分支和文件，本次没有在那里写入或合并。
- 未合入主程序、未推送、未部署。公开图库及共享权限未变。

文件元数据检查不涉及像素级水印、外部来源记录或平台标签。
