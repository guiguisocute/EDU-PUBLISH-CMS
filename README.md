# EDU-PUBLISH-CMS

EDU-PUBLISH-CMS 是一个纯浏览器端的无状态前台内容编辑管理系统 (CMS)，专为 `content/card/**/*.md` 的单层目录内容模型设计。

为了保证安全性和解耦，浏览器从不直接与 GitHub 通信，而是通过后端的 Cloudflare Worker 处理所有与 GitHub 之间的会话、仓库读取、工作区同步以及发布（发布提交）操作。这确保了用户权限验证都在底层安全流转。

## 🚀 部署到 Cloudflare Worker

EDU-PUBLISH-CMS 设计为完全的 Serverless 架构，可以一键将静态前端 (SPA) 和后台 API 同时部署到 Cloudflare Workers上。

### 第一步：申请 GitHub OAuth App

为了允许用户登录并管理他们的 GitHub 仓库，你需要配置一个 GitHub OAuth 应用。

1. 登录 GitHub，前往 **Settings** -> **Developer settings** -> **OAuth Apps**。
2. 点击 **New OAuth App**。
3. 填入如下信息：
   - **Application name**: `EDU PUBLISH CMS` (或其他自定义名称)
   - **Homepage URL**: 填入你预期的 Worker 可访问地址，例如：`https://edu-publish-cms.YOUR-ACCOUNT.workers.dev` （如果不确定可以先随便填一个网址，部署完获得确切地址后再回来修改）。
   - **Authorization callback URL**: 填入你的回调地址，格式严格为 `<Homepage URL>/api/auth/github/callback`。
4. 创建成功后，获取 **Client ID**。
5. 点击 **Generate a new client secret** 并妥善保存生成的 **Client Secret**。

### 第二步：选择部署方式

你有两种方式将系统发布到线上，任选其一：

#### 方案 A：完全使用网页仪表盘部署 (Cloudflare Dashboard GUI)
不需要在本地环境敲任何代码或安装依赖，直接在云端全自动构建部署！

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 在左侧菜单选择 **Workers & Pages**。
3. 点击顶部的 **Create application** (创建应用程序)，然后选择 **Workers** 选项卡。
4. 点击 **Connect to GitHub** (连接到 GitHub)。如果在弹窗中要求授权，请授权你的 GitHub 账号。
5. 在仓库选择列表中选中你的 `EDU-PUBLISH-CMS` 仓库代码库。
6. 进入项目配置界面：Cloudflare 会自动读取仓库里的 `wrangler.toml` 文件并为你安装依赖 (pnpm)。为了确保完全打包成功，请你在 **Build command** 处直接填入：
   `pnpm run build`
7. 向下滚动打开 **Environment variables (环境变量)** 区域，点击 **Add variable**，将下面的 4 个核心环境变量全部以 **Secret (Encrypted)** 形式填入：
   - `GITHUB_CLIENT_ID`：(填你在第一步获取的内容)
   - `GITHUB_CLIENT_SECRET`：(填你在第一步获取的内容)
   - `SESSION_SECRET`：(随便在键盘上手敲一段无规律的长字符作为加密秘钥，大于32位即可)
   - `APP_URL`：(你在第一步填写的首页域名，不带末尾斜杠，例 `https://edu-publish-cms.YOUR-ACCOUNT.workers.dev`)
8. 检查无误后，点击右侧的 **Save and Deploy**。系统会为你自动在一分钟内分配机器、打包依赖、同时完成前后端部署！

#### 方案 B：使用本地命令行部署 (Wrangler CLI)

1. **安装依赖并构建：**
   ```bash
   pnpm install
   pnpm run build
   ```
2. **执行发布命令：**
   此命令会通过浏览器提示你登录 Cloudflare 账号，并将打包好的项目上传。
   ```bash
   pnpm dlx wrangler deploy
   ```
   *部署完成后，控制台会输出你的应用最新网址 (APP_URL)。记得去 GitHub 更新 `Homepage URL`。*
3. **安全注入环境变量：**
   在控制台依次执行以下命令，向云端安全保险箱中存入这4个必备变量（`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`SESSION_SECRET`、`APP_URL`）：
   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put APP_URL
   ```

一切配置就绪后，在浏览器中访问你的 `APP_URL` 即可进入系统。只需登录你的 GitHub，系统便会自动鉴权，帮你安全、快速地管理拥有权限的仓库内容。

---

## 💻 本地开发指南

### 本地填入环境变量
在项目根目录创建一个名为 `.dev.vars` 的文本文件，在里面写上上面的 4 个变量：

```text
GITHUB_CLIENT_ID=your_id
GITHUB_CLIENT_SECRET=your_secret
SESSION_SECRET=a_very_long_random_string_here_32_chars
APP_URL=http://localhost:8788
```
*注意：本地开发时，GitHub OAuth 的 `callback URL` 也一定要临时配置或新增一个指向 `http://localhost:8788/api/auth/github/callback`。*

### 启动本地开发服务
```bash
pnpm run dev
```
此命令会同时启动两端：
- Vite 静态前端运行在 `http://localhost:3000`
- Wrangler 模拟后端 API 运行在 `http://localhost:8788` （前端会自动代理 `api/` 请求给它）

---

## 🧪 测试与校验 (TDD)

系统包含完整的测试矩阵来确保架构健壮：

运行 TypeScript 类型检查：
```bash
pnpm run typecheck
```

运行内部逻辑单元测试：
```bash
pnpm run test:unit
```

运行 Worker 路由与 GitHub 接口集成测试：
```bash
pnpm run test:integration
```

运行 Playwright E2E 前台界面端到端测试：
```bash
pnpm run test:e2e
```

**局部迭代时的指令速查：**
保持修改反馈回路短平快，指哪测哪：
```bash
pnpm run test:unit -- cms
pnpm run test:unit -- preview
pnpm run test:integration -- auth-session
pnpm run test:integration -- repos-workspace
pnpm run test:integration -- publish
```

## 📂 核心代码层级结构解读

- `worker/`: 位于 Worker 的所有路由与 API 逻辑验证（身份验证、仓库请求等）。
- `lib/content/`: 卡片解析器、序列化工具、预览编译器，以及预览端适配逻辑。
- `lib/github/`: 所有的 GitHub API 封装（树查询、多级拉取、写入、提交）。
- `hooks/`: 提供给前端界面的包含工作区、实时编辑的共享状态 Hook。
- `components/cms/`: 主应用编辑器（含选库、草稿发布面板、诊断侧边栏支持）。
- `components/preview/`: 在主应用边上的独立预览画板模式及弹窗实现。

如果你需要深入研究整体逻辑或扩展新功能，请务必阅读运行维护及功能测试清单 [`doc/development.md`](doc/development.md)。
