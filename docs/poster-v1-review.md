# DevSnapKit Poster v1 审核记录

日期：2026-10-20（Asia/Shanghai）。本次只交付测试站，正式发布等待用户审核。

## 代码与范围

- 产品仓库：`D:/workspace/MarkMoney/apps/shotcraft`，独立于外层 MarkMoney 仓库。
- 开工前分支：`main`；已审查并选择性保存 29 个已有开发文件。
- 基线：`87fb43fe342d3a3bfd292aecd29fe90b36f5a9a0`，没有推送该提交。
- 开发分支：`codex/poster-v1`。
- 功能提交：`1f42846b8682a3affddacb83eec19505d1db7475`；CSP 修复与最终部署提交：`07aa772`。
- 唯一执行依据：外层 `docs/superpowers/plans/2026-10-20-poster-v1-acceptance-plan.md`。
- 一个 Editorial Honey 模板；React DOM、CanvasStage、MockupUnit；相同作品渲染器用于预览和下载。公开演示图是原创 Bloomboard 界面，HoneyWeRank 只作为本地测试素材。
- 保留 Mockup 会话。加入两个素材槽位、Logo、纯文本和受支持字体样式、拖动／等比缩放／位置输入、contain／cover、50 步事务历史。没有扩大到图库、草稿持久化或通用图层工具。
- 沿用旧导出规则：2x 免费、4K 才需要 Pro；没有新加硬编码解锁，也没有新加强制水印。海报两档均属于现有免费 1x／2x 能力。

## 证据目录

全部证据位于 `D:/workspace/MarkMoney/output/devsnapkit/poster-v1/`；此目录在产品仓库外，未混入生产部署。

| 目录／文件 | 内容 |
| --- | --- |
| `mockup-baseline/verification.md` | 旧单图、双图、浏览器、手机 PNG 与透明 alpha 修复记录 |
| `mockup-baseline/transparent-before-fix.png` | 修复前实际下载文件 |
| `m1/results.json` | Manrope／Gelasio 检查及两档冷／热导出耗时 |
| `export/honey-1600x1200.png` | 站内上传原图、编辑字段后下载的目标海报 |
| `export/honey-3200x2400.png` | 同作品 2x PNG |
| `export/{landscape,square,phone,ultrawide}-1600x1200.png` | 异比例主图完整适配 |
| `export/results.json` | 实际下载尺寸、耗时、区域比对和标题溢出测量 |
| `ui/desktop-main-flow.mp4` | 桌面实际操作录屏 |
| `ui/mobile-main-flow.mp4` | 手机 390 px 实际操作录屏 |
| `ui/mobile-{360,390,430}.png` | 手机流程实际下载文件 |
| `ui/mobile-{360,390,430}-preview.png` | 三种宽度的界面截图 |
| `ui/csp/uploaded-production-csp.png` | 原生产 CSP 下含真实画面的 PNG，非空白文件 |
| `preview/results.json` | Cloudflare 线上换图／下载、耗时与正式站未变化记录 |
| `preview/live-1280-1x.png` | Astro 主截图与 GitHub 细节截图的独立真实网页素材回归 |
| `verification/results.json` 与 `*.log` | 四条必需命令的退出码、耗时与完整输出 |

## 关键验证方法

1. 浏览器通过真实输入控件上传、编辑、拖动并触发下载；CDP 接收浏览器下载流，Sharp 解码读取尺寸和像素，不使用外部 HTML 排版脚本生成产品输出。
2. 透明网点先复现后修复。最初 120×120 区域包含真实阴影，不能用作透明背景判据；最终隔离顶部 120×24 背景，修复前 45 个非零 alpha 像素，修复后 0。实际样机与阴影保留。
3. 字体随产品同源加载并通过 `getFontEmbedCSS` 嵌入、缓存；海报不使用 `skipFonts: true`。Manrope 与 Gelasio 的 OFL 随字体收录。
4. 比较同一浏览器内的产品预览和实际 PNG，检查 headline、main、detail、footer 区域；不是与参考字体逐像素比较。当前区域对齐位移 0–1 逻辑像素。
5. 文字溢出通过未缩放的 `scrollHeight/clientHeight` 和 `scrollWidth/clientWidth` 判断；字号 160 的短浏览器标题也受检。浏览器顶栏固定 49 逻辑像素，避免改变素材几何框。
6. 导出期间冻结文档控件、尺寸与模式切换；图片替换未完成时阻止导出。裁切确认随文档改变失效。
7. 自动化使用 `qa_poster_v1_` 会话前缀，避免将演示测试混作外部试用。新增遥测不包含文案、图片、文件名、网址或 Pro Key。
8. 首次线上冒烟发现 `connect-src` 禁止 `fetch(blob:)`；已保留生产 CSP，通过资产仓库的原始 Blob 与 FileReader 在离屏副本中嵌入图片。预览 DOM 不被临时改写。最终全部浏览器测试使用原生产 CSP，检查实际画面像素，防止仅解码空白 PNG 被算通过。

## 测试站与命令结果

- 测试地址：https://poster-v1-review.devsnapkit.pages.dev/?editor=1 。进入后点击 **Poster**。
- 固定部署地址：https://b0a1e621.devsnapkit.pages.dev/?editor=1 。部署环境为 `poster-v1-review`，不是生产 `main`。
- 预览响应为 `noindex, nofollow`，复制了现有安全头，未放宽 CSP；本地 `.env.local`、`wrangler.toml` 与凭据均未复制进部署包。
- 没有执行 Git push。正式站 HTML 部署前后 SHA-256 均为 `0a17d06bf762b1de11bf2ffcdb07b282d7d120b529308b77a86e01eaa0f445be`，静态入口保持原版本。

| 命令 | 退出码 | 结果／耗时 |
| --- | --- | --- |
| `npm run build` | 0 | TypeScript 与 Vite 成功，4.52 秒 |
| `npm run test:security` | 0 | 28 项通过；需浏览器的 1 项在下一套实际执行，不虚报为此命令已执行 |
| `npm run test:poster:v1` | 0 | 6 项通过，0.60 秒 |
| `npm run test:poster:v1:browser` | 0 | 18 项通过，无跳过，144.59 秒；包含管理员 UI 安全测试 |
| `PREVIEW_URL=… node tests/poster-preview-smoke.mjs` | 0 | 线上两个桌面素材组、两档尺寸、390 px 下载通过；正式站保持不变 |
| `git diff --check`／提交前缓存区检查 | 0 | 已规范字体许可原文的一处行尾空白 |

浏览器测试 runner 自行启动严格端口 5197 的 Vite、加载生产 CSP、串行运行所有必需套件并结束自己的服务。开发期间创建的临时 5179 服务也已关闭。

M1 同源字体与原创示例的页面首次／同页再次导出：1x 为 2873／216 ms，2x 为 855／341 ms；“首次”指页面内导出缓存，浏览器 HTTP 缓存可能命中。线上实际上传图导出：1440 px 桌面首个 1x 4124 ms、随后 2x 423 ms；1280 px 第二组实际网页素材 1x 1469 ms；390 px 响应式视口 1x 1166 ms。没有隐藏降清晰度。全部数据见 JSON，不把窄视口耗时当作真机性能结论。

Task 0–1／M1、Task 2–4／M2、Task 5–6／M3 的开发与自动化验证已完成；最终视觉与发布审核待用户确认。

## AC01–AC16

下表“自测通过”指已有真实操作、下载或检查证据；最终放行仍由用户决定。

| 编号 | 技术验证内容／证据 | 状态 |
| --- | --- | --- |
| AC01 | `export/honey-1600x1200.png`；奶油白、蜂蜜黄、左文右图、斜体高亮、真实浏览器与细节卡；已人工打开检查 | 自测通过，待视觉审核 |
| AC02 | 独立 main／detail／logo 上传、清除 Logo；UI 自动化与桌面录屏 | 自测通过 |
| AC03 | 目标图所有字段通过控件编辑；中文／emoji／script 字符只作文本；实际 PNG | 自测通过 |
| AC04 | 共享字体样式、原位 mark/em、多行排版、长短文案和字体溢出 | 自测通过 |
| AC05 | 四种比例完整主图下载；固定 chrome 与整体比例适配；另有 Astro 实际网页组 | 自测通过 |
| AC06 | contain／cover／对齐切换；替换后位置与模式保持；隐藏卡片 | 自测通过 |
| AC07 | 实际 50% 预览位移、等比角点、数值调整、pointercancel 与丢失捕获取消 | 自测通过 |
| AC08 | 非法数字、缺图、文本溢出、真实坏图、20 MB／24 MP、裁切确认及确认失效 | 自测通过 |
| AC09 | 一次拖动／缩放／替换／文字提交一步撤销；Redo／Cancel／新编辑清 Redo；100 次更新只记一次 | 自测通过 |
| AC10 | 产品内排版与浏览器下载；桌面／手机录屏；Cloudflare 线上复测 | 自测通过 |
| AC11 | 1600×1200／3200×2400 解码与内容像素、字体／图片准备、无控制点和网点、旧权限规则；原生产 CSP | 自测通过 |
| AC12 | 1x 与归一化 2x 的自身预览／导出四区域位移均 0–1 px；`export/results.json` | 自测通过 |
| AC13 | 360／390／430 px 完整流程与下载，无横向溢出；390 px 线上复测 | 自测通过，真机项见限制 |
| AC14 | 模式往返保留文案与素材；明确“Current session only”，不显示虚假的已保存 | 自测通过 |
| AC15 | 旧模式四类下载、透明 alpha、安全测试与构建；未改支付或旧编辑状态 | 自测通过 |
| AC16 | 预览地址、真实 PNG、录屏、命令记录和限制清单齐备；正式站未发布 | 已交付，待用户审核 |

## 实测环境与尚未完成的人工项

- Windows，Intel Core i9-13900H，32 GiB RAM；Chrome 155.0.8059.84；浏览器版本随本机安装更新，最终 JSON 记录实际版本。
- 手机结果来自桌面 Chromium 的窄视口操作，不等同于 iOS Safari／Android 真机内存测试。
- 3 位非开发者约 10 分钟完成海报的可用性试用尚未进行；没有把此目标写成已验证事实，也没有发送任何邀请或宣传消息。
- 当前会话保留，刷新后不恢复；浏览器关闭提醒由浏览器策略决定。
- 只支持 PNG 导出、一个模板及计划内字体组合，不含用户 SVG、任意 URL 截图或自由图层。
- 正式站尚未部署；验收后再按用户批准范围发布。
