# PUBLISH — 可选的网站部署阶段

> **你是一个 AI agent，正在为已经完成本地联调的 EDU-PUBLISH 项目执行可选的网站部署。**
> 本文件只在 SETUP.md 验收通过且用户明确确认后执行。

## 触发条件

只有在 `SETUP.md` 已完成，且用户明确表示要把站点部署成可访问的网页时，才继续。

---

## 部署方式选择

本项目构建产物为纯静态站点（`dist/`），兼容任意静态托管平台。

**询问用户**：你打算用哪种方式部署？

| 方式 | 说明 | 适合场景 |
|------|------|----------|
| **A. Cloudflare Pages Git 直连**（推荐） | 在 CF Dashboard 关联 Git 仓库，push 自动触发构建部署 | 最简单，零 CI 配置 |
| **B. GitHub Actions + wrangler** | 使用仓库内置的 `deploy.yml` / `deploy-main.yml` | 需要自定义 CI 步骤、path 过滤等 |
| **C. 其它静态平台** | Vercel / Netlify / GitHub Pages 等 | 已有其它平台账号 |

---

## 方式 A：Cloudflare Pages Git 直连

### A1. 创建 Pages 项目

引导用户在 Cloudflare Dashboard 操作：

1. 登录 https://dash.cloudflare.com
2. 进入 `Workers & Pages` → `Create`
3. 选择 `Import an existing Git repository`
4. 关联用户的 GitHub fork 仓库
5. 配置构建设置：
   - **Production branch**: `main`
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist`
6. 环境变量（在 `Settings` → `Environment variables` 中设置）：
   - `NODE_VERSION` = `22`
   - `SITE_URL` = 用户的站点域名（如 `https://example.edu.cn`）

### A2. 分支预览

CF Pages 会自动为非生产分支创建预览部署。`test` 分支的 push 会生成预览 URL。

### A3. 自定义域名（可选）

在 Pages 项目的 `Custom domains` 中绑定自己的域名。

---

## 方式 B：GitHub Actions + wrangler

仓库已包含两个 workflow：

- `.github/workflows/deploy.yml` → `test` 分支 push 触发
- `.github/workflows/deploy-main.yml` → `main` 分支 push 触发

### B1. 配置 GitHub Secrets

先检查 `config/site.yaml` 中的 `github_actions_enabled`：

- 若为 `true` 或未填写，按下面步骤配置 Secrets 并使用仓库内置 workflow。
- 若为 `false`，说明当前仓库明确不使用 GitHub Actions 部署，不要继续要求用户补齐 Secrets；应改走方式 A 或方式 C。

引导用户在仓库 `Settings` → `Secrets and variables` → `Actions` 中添加：

| Secret | 说明 | 必填 |
|--------|------|:---:|
| `CLOUDFLARE_PROJECT_NAME` | Pages 项目名 | 是 |
| `CLOUDFLARE_API_TOKEN` | 具有 Pages Deploy 权限的 API Token | 是 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | 是 |
| `CLOUDFLARE_PAGES_URL` | 生产环境完整 HTTPS URL | 是 |
| `CLOUDFLARE_PAGES_TEST_URL` | 测试预览环境完整 HTTPS URL | 是 |

详细格式参见 `.github/secrets.template.md`。

如用户暂时不用 GitHub Actions，可以在 `config/site.yaml` 中设置：

```yaml
github_actions_enabled: false
```

这样 `deploy.yml` / `deploy-main.yml` 会在触发后直接跳过部署 job，避免反复收到失败通知。

### B2. 触发部署

```bash
git push origin test
```

然后在 GitHub Actions 页面查看 workflow 运行状态。

---

## 方式 C：其它静态平台

通用配置：

| 配置项 | 值 |
|--------|-----|
| Build command | `pnpm run build` |
| Output directory | `dist` |
| Node.js version | `22` |
| Install command | `pnpm install` |

环境变量：`SITE_URL` 设为站点域名。

适用于 Vercel、Netlify、GitHub Pages、Render 等任何支持 Node.js 构建的静态托管平台。

---

## S3 兼容对象存储（可选）

对象存储**不是必需的**。未配置时，所有附件和图片直接从静态产物中提供服务。

当内容量增长导致静态资产逼近平台限制（如 CF Pages 2万文件 / 单文件25MB）时，可启用任何 S3 兼容存储服务（AWS S3、Cloudflare R2、MinIO、Backblaze B2 等）。

在平台环境变量或 `.env` 中配置：

| 变量 | 说明 |
|------|------|
| `S3_BUCKET` | Bucket 名称 |
| `S3_ENDPOINT` | S3 兼容 endpoint URL |
| `S3_ACCESS_KEY_ID` | Access Key |
| `S3_SECRET_ACCESS_KEY` | Secret Key |
| `S3_PUBLIC_BASE_URL` | 对外访问基础 URL |
| `ATTACHMENT_UPLOAD_THRESHOLD_MB` | 超过此大小的附件上传到 S3（默认 20MB） |

缺少任一配置项时，构建脚本会静默跳过，不影响正常构建。

---

## 浏览量统计（可选）

站点支持可选的浏览量统计功能，需要数据库支持。

**Cloudflare D1（内置支持）**：

1. 在 CF Dashboard 创建 D1 数据库
2. 在 Pages 项目的 `Settings` → `Bindings` 中绑定 D1 数据库，Binding name 填 `DB`
3. Schema 会在首次请求时自动创建

**其它数据库**：

`functions/lib/view-store.ts` 提供了 `ViewStore` 接口，可扩展实现 PostgreSQL、MySQL 等后端。未绑定任何数据库时，浏览量统计自动降级为不计数模式，不影响站点正常使用。

---

## 本阶段不自动代办的事项

以下操作通常需要用户在网页端完成，agent 不应假设自己已经具备权限：

- 在 Cloudflare/Vercel/Netlify Dashboard 中创建项目
- 在 GitHub 仓库 Settings 中补齐 Actions secrets
- 绑定自定义域名
- 创建 D1 数据库或 S3 存储桶
