# Agent Deploy Docs

这一组文档构成 EDU-PUBLISH 的 agent 部署与运行规范。

任意支持终端执行的 AI agent 只需读取入口文件即可完成整条部署链路。

## 文件说明

| 文件 | 说明 |
|------|------|
| `SETUP.md` | **主入口**。Docker 部署全流程：环境检测 → NapCat + AstrBot 编排 → QQ 登录 → WebSocket 通信 → 插件安装配置 → 端到端验收 |
| `PUBLISH.md` | 可选的网站部署阶段。仅在本地链路跑通且用户确认后，继续静态站点发布 |
| `SKILLS.md` | 项目级 skill 安装约定。规定从 `EDU-PUBLISH-skills` 安装哪些 skills 到 `./skills/` |

## 使用方式

推荐使用方式：

```text
阅读 .agent/SETUP.md 并按步骤执行。
```

在进入这一步之前，用户应先：

```text
1. 在 GitHub 网页端 fork guiguisocute/EDU-PUBLISH
2. 把自己的 fork clone 到本地
3. 让 agent 在本地仓库根目录读取 .agent/SETUP.md
```

## 链路概览

```
SETUP.md
  → 环境检查、Docker 安装、compose 启动
  → QQ 登录、WebSocket 对接
  → 插件安装、参数配置、归档挂载验证
  → 端到端消息测试、故障定位、验收结论
  → PUBLISH.md（可选）
    → 询问是否继续网页部署
    → CF Pages Git 直连 / GitHub Actions / 其它平台
```

## 目录结构依赖

部署过程会创建/使用以下目录：

```
EDU-PUBLISH/
├── skills/           # 项目级 skills（本地依赖，gitignore）
├── archive/          # AstrBot 归档落盘（已 gitignore 内容）
├── data/             # AstrBot 运行数据（已 gitignore）
├── napcat/config/    # NapCat 配置（已 gitignore）
├── ntqq/             # QQ 数据目录（已 gitignore）
└── docker-compose.yml  # 由 SETUP.md 创建
```
