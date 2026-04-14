# Archive Content Bot Rules

本规则用于约束 Agent 对 `EDU-PUBLISH` 的自动内容生产行为，目标是：稳定、可追踪、可编译、低人工负担。

## 1. 工作模式

采用 archive 读取模式：

- Bot 读取 `archive/` 目录下的结构化数据作为主要输入源。
- `archive/` 是独立管理的数据目录（可以是 Git submodule，也可以是普通目录由外部程序写入）；主仓库只读取，不负责直接提交 archive 内容。
- `archive/YYYY-MM-DD/` 目录由外部程序（astrbot-QQtoLocal）持续写入 archive 独立仓库。
- 检测到新的日期目录或已有目录中 `messages.md` 文件更新后，立即触发增量处理。
- 每次增量处理控制批大小，避免上下文爆炸。
- TG 直接转发仅作为偶尔的补充输入，处理规则与 archive 输入一致。

该模式下每次增量处理都要写工作日志，且都要通过内容校验后再推送。

## 2. 分支与写入边界

### 2.1 分支纪律

- 默认工作分支为 `test`。
- 未经用户明确允许，不得在 `main` 上修改、提交、推送。
- 不只是不能推送到 `main`；连本地提交也不得先落在 `main`。
- `main` 仅用于人工审核通过后的发布。

### 2.2 主仓库允许修改

- `content/**/*.md`（包含 `content/conclusion/**/*.md`）
- `worklog/**/*.md`

### 2.3 archive 子仓库边界

- `archive/**` 由独立仓库管理。
- 主仓库内禁止直接改写 archive 内容。
- archive 更新、提交、推送必须在 `archive/` 子仓库内单独执行。
- archive 标准提交流程：`cd archive && git add . && git commit -m "chore: archive YYYY-MM-DD" && git push`

### 2.4 禁止修改

- `config/subscriptions.yaml`
- `public/generated/**`
- 脚本/前端代码
- `.gitmodules`（如存在）

## 3. 输入解析规则

### 3.1 Archive 目录结构

`archive/` 由外部程序（astrbot-QQtoLocal 插件）持续写入。如配置为 Git submodule，处理前需确认已初始化。

```
archive/
  YYYY-MM-DD/
    messages.md      # 当日所有消息（结构化 Markdown）
    photos/          # 已下载的图片文件
    files/           # 已下载的附件文件
  index/
    message_ids.json # 由 astrbot 维护的去重索引（本项目只读）
```

### 3.2 messages.md 消息格式

每条消息段格式如下：

```md
## YYYY-MM-DD HH:MM:SS
- 来源群: `群名` (`群号`)
- 发送者: `昵称` (`QQ号`)
- 消息ID: `数字ID`

正文内容 / [空消息] / [图片] 已过期 / [JSON卡片] / [回复]

附件:
- 文件: [文件名](files/hash_文件名)
- 图片: ![alt](photos/hash_name)

---
```

### 3.2.1 `[ignore]` 标记（手动忽略）

发送者在 QQ 中使用特定前缀（可配置）发送的消息，会被 astrbot 自动在标题行插入 `[ignore]` 标记：

```md
## [ignore] YYYY-MM-DD HH:MM:SS
```

**处理规则**：
- 标题行以 `## [ignore]` 开头的消息段必须**整条跳过**，不解析、不合并、不生成卡片。
- 同一 `消息ID` 下若存在 `[ignore]` 段落，该段落的附件也一并忽略。
- 在 worklog 中统计 `ignored` 数量。
- Bot 不得移除或修改 archive 中的 `[ignore]` 标记（遵守 archive 只读原则）。

### 3.3 消息合并规则

同一个 `消息ID` 的多个段落必须合并为一个通知单元：

- 同 `消息ID` 的段落代表 QQ 中同一条消息的不同部分（文本 + 附件分开发送）。
- 合并规则：第一个含正文（非 `[空消息]`）的段落为主体正文，后续段落的附件/图片归并到同一通知。
- `[空消息]` 段落仅提取附件，不产生正文。
- `[图片] 已过期` 段落标记图片不可用，在 worklog 记录 `expired_image`。
- `[回复]` 开头的段落视为对之前消息的回复/补充，根据内容判断是否为补充通知。
- `[JSON卡片]` 段落提取链接作为外链附件。
- `[ignore]` 标记的段落整条跳过（见 3.2.1）。
- 空段落和纯表情段过滤。

### 3.4 Archive 只读原则

- Bot 不修改 `archive/` 下的任何文件内容。
- `archive/index/message_ids.json` 由 astrbot 维护，Bot 只读用于参考，不作为去重主键。
- 去重以 `content/card/` 下已有卡片为准（见第 4 节）。
- 若 archive 数据需要同步，先在 `archive/` 子仓库内完成 `git pull` / `git add` / `git commit` / `git push`，再回到主仓库处理内容。

### 3.5 TG 补充输入

偶尔用户会直接提供 TG 格式的消息文本作为补充输入，格式与旧规则一致。Bot 应检测输入格式并自动路由到对应的解析逻辑。

## 4. 去重规则

- 主要方式：扫描 `content/card/` 下已有卡片，与待处理通知单元比对。
- 比对依据：`source.channel + source.sender + published 时间相近 + 正文关键内容`。
- 命中重复：跳过写入并在 `worklog` 标注 `duplicate skipped`。

## 5. Card 生成规则

目标目录：`content/card/**/*.md`。

### 5.1 两阶段要求（强制）

- 阶段一（脚本）：只做模板落盘与原文拼接。
- 阶段二（LLM）：逐条补语义字段。
- 严禁脚本批量生成：`title`、`description`、`category`、`tags`、`start_at`、`end_at`。

### 5.2 字段规则（当前项目口径）

- 必填：`id`、`school_slug`、`title`、`description`、`published`、`category`、`source`。
- `category` 必须从 `config/subscriptions.yaml` 顶层 `categories` 数组中选取；若无法判断归属则使用数组末尾的兜底值（通常为"其它分类"）。
- `description` 必须使用 YAML 折叠块标量 `>-` 语法，禁止使用双引号包裹（避免中文括号等特殊字符导致解析错误）：
  ```yaml
  description: >-
      50~70字描述内容
  ```
- `subscription_id` 由编译器自动推导：`school_slug + source.channel`。
- `school_slug` 缺失或非法：自动回退 `unknown`。
- `source.channel` 缺失：回退到 `未知来源`。
- `source.channel` 存在但匹配不到订阅：回退到 `{school_slug}-未知来源`。
- `pinned` 默认 `false`，bot 不得自动置顶。

### 5.3 时间字段

- `published`、`start_at`、`end_at` 统一 ISO8601 且显式 `+08:00`。
- 示例：`'2026-02-01T09:00:00+08:00'`。
- 时间字段按通知类型分三类处理：
  - 活动进行型：`start_at = 活动开始`，`end_at = 活动结束`
  - 报名/材料收集型：`start_at = published`，`end_at = 报名/提交/入群截止`
  - 只有日期型活动：`start_at = 当日 00:00:00+08:00`，`end_at = 当日 23:59:59+08:00`
- 若通知明确存在报名截止、提交截止、入群截止、收集截止，`end_at` 优先取该截止时间，而不是活动举办时间。
- 仅提及活动/比赛/会议开始时间但未明确结束时间，且明确属于活动进行型时：`end_at` 默认为 `start_at + 2小时`。
- 若 `end_at` 取的是报名/提交截止，`start_at` 默认使用 `published`，避免出现 `start_at > end_at`。
- 若同时存在 `start_at` 与 `end_at`，必须保证 `start_at < end_at`；不满足时优先回退到更保守且不破坏前端展示的时间窗。
- 无法可靠判断：`start_at/end_at` 置空，并在 `worklog` 标注 `time_uncertain`。

### 5.4 正文与附件

- 正文必须保留原通知语义，禁止改写事实。
- 可删除 archive 元数据行（`来源群: xxx`、`发送者: xxx`、`消息ID: xxx`）与纯空白段。
- 删除 `[空消息]` 标记，`[图片] 已过期` 在正文中标注"（图片已失效）"或省略。
- 附件优先写入 `frontmatter.attachments`。

**Archive 资产处理（主要路径）**：

- 以下 `archive/YYYY-MM-DD/...` 路径均由 archive 目录提供。
- 图片：从 `archive/YYYY-MM-DD/photos/<hash_name>` 复制到 `content/img/`，引用用 `/img/...`。
- 文件：从 `archive/YYYY-MM-DD/files/<hash_filename>` 复制到 `content/attachments/`，引用用 `/attachments/...`。
- Archive 中的文件名格式为 `hash前缀_原始文件名`，复制时去掉 hash 前缀，使用原始文件名。
- 若原始名无扩展名（如 `download`），图片默认使用 `.jpg` 扩展名，命名为 `photo_N.jpg`。
- 若文件名重复，添加序号后缀。

**TG 补充输入路径**：

- 本地附件必须落盘到 `content/attachments/...`，引用用 `/attachments/...`。
- 允许外链附件（http/https）。

**通用规则**：

- 禁止在正文中保留 archive 相对路径或本地临时路径（如 `file://`）。
- 图片既要进入 `frontmatter.attachments`，也要在正文中用 Markdown 图片语法展示（`![alt](/img/...)`）。
- 存在多张图片时，按消息出现顺序渲染；第一张图片必须写入 `cover` 作为封面图。

## 6. Conclusion 规则

目标目录：`content/conclusion/<school_slug>.md`。

- 每日写入 `daily.<YYYY-MM-DD>`。
- 每日建议 3~10 条要点。
- 当日无有效通知也必须写：`今日无有效通知/无新增`。

## 7. 学院映射规则

配置只读：`config/subscriptions.yaml`。

订阅字段口径（bot 只读，不改配置）：

- `title`: 用于人类可读订阅名与 `source.channel` 匹配。
- `number`（可选）: 用于同名群消歧——archive 输入中同时提供群名和群号，群号可与此字段比对。不参与前端展示，不参与 `subscription_id` 推导。
- `url` / `icon` / `enabled` / `order`: 按配置生效。

判定顺序：

1. `来源群` 名称精确映射 subscription title
2. 同名群歧义时，用 archive 中的群号与 subscription number 比对消歧
3. `发送者` 映射
4. 正文关键词映射
5. 未命中 -> `unknown`

补充：每个学院都存在 `未知来源` 订阅兜底（由编译器保证）。

当遇到同名群歧义时，bot 处理要求：

- 优先使用群号与 subscription number 比对消歧。
- 若群号无法匹配，记录 `school_slug + title + 群号` 三元组到 `worklog`。
- 若上下文仍无法判定，先落入该学院 `未知来源`，并在日志标注 `ambiguous_channel_number`。

## 8. 质量红线

- 标题/描述必须可读、非模板化、非机械截断。
- 避免机械使用“关于……的通知”“……通知”等模板标题。
- 标题优先自然、可读，但不得偏离原通知事实。
- `description` 建议 50~70 字，覆盖对象、动作、时间约束，必须使用 `>-` 语法。
- 标签最多 5 个，建议 2~4 个有效业务标签。
- 禁止正文代码块化污染（`````）。
- 禁止生成与正文矛盾的时间或附件信息。

## 8.1 "补充通知 / 更正通知 / 二次通知"处理规则（强制）

识别关键词（标题或正文命中任一）：`补充通知`、`补充说明`、`更正`、`修正`、`二次通知`、`后续通知`、`附件补发`。

Archive 格式中，`[回复]` 开头的消息段如果包含上述关键词，也触发此规则。

处理原则：

- 若能定位到原通知（同学院 + 同主题 + 时间窗口相近），必须并入原卡片，禁止新建重复卡片。
- 并入时保留原始时间线：在正文末尾新增"补充说明"段，注明补充时间与发送者。
- 新增附件必须并入同一卡片 `attachments`，并做去重（同 URL/同文件名只保留一份）。
- 若补充内容明确改变截止时间、地点、对象或提交方式，必须同步修订 `description`、`tags`、`start_at/end_at`。
- 并入后 `published` 更新为"该通知链最新一条消息时间"，保证列表排序与最新状态一致。

无法确定归属时：

- 不强行并入；先新建临时卡片并在 `worklog` 标注 `needs_merge_review`。
- 在日志中记录候选原卡片 id，等待人工复核后再合并。

## 9. 工作日志规则

目录：`worklog/YYYY-MM-DD.md`（中文）。

至少包含：

- 数据源（archive 日期目录列表）
- 扫描消息段数与合并后通知数
- 忽略消息数（`[ignore]` 标记跳过的消息段数）
- 新增/更新卡片数
- 重复跳过数
- unknown 映射清单
- 时间识别失败清单
- 已过期图片清单
- 校验与构建结果

## 9.1 完成后固定回报模板

每次处理结束后，除写入 `worklog` 外，还必须按固定结构向用户回报，至少包含：

- 新增卡片：`card_id | school_slug | title`
- 并入更新卡片：`card_id | 变更说明`
- 来源信息：`来源群 | 发送者 | published`
- 附件 / 图片落地：目标路径列表
- summary / worklog 更新情况：是否更新 `content/conclusion/<school_slug>.md` 与 `worklog/YYYY-MM-DD.md`
- 校验结果：`pnpm run validate` 成功 / 失败
- Git 信息：主仓库 `test` 状态、archive 子仓库是否执行 `pull` / `commit` / `push`

## 10. 校验、提交与故障策略

- 写入后必须执行：`pnpm run validate`。
- 校验通过再提交并推送 `test`。
- archive 数据提交与主仓库内容提交是两套流程，不得混在同一个仓库上下文里操作。
- 完成后必须按 `9.1` 的固定模板回报，禁止省略 Git 状态、校验结果、附件落地情况。
- 校验失败：
  - 不回滚文件。
  - 记录失败原因到 `worklog`。
  - 标注 `needs_manual_review`。

## 11. 构建与部署

本项目构建产物为纯静态站点（`dist/`），兼容任意静态托管平台。

### 11.1 支持的部署方式

| 方式 | 说明 |
|------|------|
| **Cloudflare Pages Git 直连**（推荐） | 在 CF Dashboard 关联 Git 仓库，push 自动触发构建部署，环境变量在 Dashboard 中配置 |
| **GitHub Actions + wrangler** | 仓库已包含 `deploy.yml` / `deploy-main.yml`，适合需要自定义 CI 步骤的场景 |
| **其它静态平台** | Vercel / Netlify / GitHub Pages 等，配置 build command 为 `pnpm run build`，输出目录 `dist/` |

如果 `config/site.yaml` 中的 `github_actions_enabled: false`，则内置 GitHub Actions workflow 会在触发后直接跳过部署 job。此时 bot 不应要求用户补齐 Actions secrets，也不应把 workflow skipped 视为异常。

### 11.2 S3 兼容对象存储（可选）

对象存储**不是必需的**。未配置时，所有附件和图片直接从静态产物中提供服务。

支持任何 S3 兼容服务商（AWS S3、Cloudflare R2、MinIO、Backblaze B2 等）。当内容量增长导致静态资产逼近平台文件数/大小限制时（如 CF Pages 2万文件 / 单文件25MB），可启用：
- 在 `.env`（本地）或平台环境变量中配置 `S3_BUCKET`、`S3_ENDPOINT`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_BASE_URL`。
- 构建时自动将超阈值附件上传至对象存储并替换引用地址。
- 缺少任一配置项时，相关脚本会静默跳过，不影响构建。

### 11.3 Bot 侧建议

- 增量提交频率可采用"事件触发 + 最短间隔"（例如 3~10 分钟节流）。
- 若使用 GitHub Actions，且 `github_actions_enabled` 未关闭，push 后可轮询 workflow 状态；若使用 CF Pages Git 直连，push 即部署。
- 构建失败时，拉取日志摘要并回传到控制台/日志。

## 12. 不可协商规则

- 不自动改 `config/subscriptions.yaml`。
- 不自动改代码文件。
- 不自动把 `pinned` 设为 `true`。
- 不覆盖人工编辑的高质量语义字段（除非明确修错）。
- 不修改 `archive/` 下的任何文件。
- 不在未经用户明确允许时触碰 `main`。
