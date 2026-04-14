# Requirements Document

## Introduction

EDU-PUBLISH-CMS 是一个面向 EDU-PUBLISH 兼容仓库的图形化内容管理系统。它的目标不是替代 EDU-PUBLISH 本身的静态站点，而是在不改变现有内容组织方式的前提下，为维护者提供一个可视化、可预览、可直接提交到 GitHub 分支的 CMS。

本规格明确以当前参考仓库 `ref/EDU-PUBLISH` 的实际内容模型为准：通知内容存放在单层 `content/card/**/*.md` 中，`source`、`attachments`、正文 Markdown 都位于同一份卡片文件内。本项目不引入 `origin/card` 双层模型，也不把配置和前端源码编辑纳入本期范围。

## Alignment with Product Vision

当前仓库尚未提供 `product.md`，本规格以 `plan.md` 作为产品意图来源，并与参考项目 `ref/EDU-PUBLISH` 对齐。

本功能支持以下产品目标：

- 为已经 fork EDU-PUBLISH 或兼容仓库的维护者提供直观 GUI，而不是要求他们直接在 GitHub 网页端手改 Markdown。
- 保持与 EDU-PUBLISH 现有前端体验高度一致，让编辑者能在 CMS 中看到接近最终部署效果的列表页和详情预览。
- 继续以 GitHub 仓库和分支作为唯一事实来源，让 EDU-PUBLISH 现有的 Git 驱动部署链路保持不变。
- 将写入权限严格限制在内容目录内，避免 CMS 越权修改仓库中的配置、代码和部署文件。

## Requirements

### Requirement 1

**User Story:** As a content maintainer, I want to sign in with GitHub and bind my EDU-PUBLISH-compatible repository, so that the CMS can operate on my existing content repository safely.

#### Acceptance Criteria

1. WHEN a maintainer visits the CMS without a valid session THEN the system SHALL start the GitHub OAuth web flow with CSRF `state` protection and PKCE.
2. WHEN GitHub OAuth succeeds THEN the system SHALL revalidate the GitHub identity, establish a Worker-managed session, and return the current user's basic GitHub profile.
3. WHEN the maintainer selects a repository THEN the system SHALL verify that the repository contains the minimum compatible structure: `content/card/`, `config/site.yaml`, `config/widgets.yaml`, and `config/subscriptions.yaml`.
4. IF the selected repository or branch is incompatible THEN the system SHALL block entry into the editing workspace and show actionable compatibility errors.
5. WHEN a repository is accepted THEN the system SHALL expose the editable branches and the current branch head SHA to the workspace.

### Requirement 2

**User Story:** As a content maintainer, I want the CMS to load repository content into a browser draft workspace, so that I can edit safely before any GitHub write occurs.

#### Acceptance Criteria

1. WHEN the maintainer selects a repository and branch THEN the system SHALL load editable files from `content/card/**/*.md` and read-only preview dependencies from `config/site.yaml`, `config/widgets.yaml`, and `config/subscriptions.yaml`.
2. WHEN the workspace is created THEN the system SHALL preserve, for each card file, its canonical path, blob SHA, raw source text, parsed frontmatter fields, Markdown body, and dirty state.
3. WHEN the selected branch contains repository-hosted attachments referenced by the current cards THEN the system SHALL expose their metadata and repository paths to the workspace.
4. IF the remote branch head changes after the workspace was loaded THEN the system SHALL detect remote drift and require resynchronization before publish.
5. WHEN the maintainer edits files locally THEN the system SHALL keep those changes in the browser draft workspace until the maintainer publishes or explicitly discards them.

### Requirement 3

**User Story:** As a content maintainer, I want a structured editor for the current single-layer card Markdown schema, so that I can modify notices without manually editing YAML frontmatter for routine tasks.

#### Acceptance Criteria

1. WHEN a card is opened for editing THEN the system SHALL provide GUI controls for the current schema fields, including `id`, `school_slug`, `title`, `description`, `published`, `category`, `tags`, `pinned`, `cover`, `badge`, `extra_url`, `start_at`, `end_at`, `source.channel`, `source.sender`, `attachments`, and the Markdown body.
2. WHEN the maintainer edits card data THEN the system SHALL preserve the single-file card model and SHALL NOT transform the document into any other schema.
3. WHEN the maintainer edits attachments THEN the system SHALL support both repository attachment paths under `content/attachments/**` and external URLs.
4. WHEN the maintainer edits Markdown body content THEN the system SHALL allow inline links and images that are compatible with the current EDU-PUBLISH compile rules.
5. IF required fields, date fields, or attachment definitions are invalid THEN the system SHALL show inline validation errors before publish.
6. WHEN a card is saved back into draft form THEN the system SHALL keep round-trip fidelity for field values and SHALL NOT unexpectedly rewrite unrelated frontmatter fields.

### Requirement 4

**User Story:** As a content maintainer, I want live preview that matches EDU-PUBLISH closely, so that I can trust what the published site will look like before pushing changes.

#### Acceptance Criteria

1. WHEN draft content changes THEN the system SHALL recompile preview data inside the browser without writing to GitHub.
2. WHEN preview is rendered THEN the system SHALL reuse or faithfully reproduce EDU-PUBLISH's existing list page, sidebar grouping, card list behavior, and notice detail modal behavior.
3. WHEN a preview card is opened THEN the system SHALL keep the list-detail interaction on the same page, preserve current list state, and support overlay close, ESC close, and previous/next navigation.
4. WHEN a previewed notice has attachments THEN the system SHALL render the attachment section before the notice body and SHALL support both repository-relative and external attachment URLs.
5. IF draft content cannot be compiled into a valid preview THEN the system SHALL show file-level or field-level compile errors with enough detail for the maintainer to fix them.

### Requirement 5

**User Story:** As a content maintainer, I want to publish all approved content changes to a selected GitHub branch in one operation, so that EDU-PUBLISH can continue to deploy from Git.

#### Acceptance Criteria

1. WHEN the maintainer opens the publish flow THEN the system SHALL show the changed files, target repository, target branch, branch head SHA, and proposed commit message.
2. WHEN the maintainer selects an existing branch or requests a new branch THEN the system SHALL validate the branch target before publish.
3. WHEN publish is confirmed AND server-side validation passes THEN the system SHALL commit all modified `content/card/**` and `content/attachments/**` files as one atomic branch update.
4. IF the target branch head SHA no longer matches the workspace base SHA THEN the system SHALL reject the publish, preserve the local draft, and require the maintainer to resync.
5. WHEN publish succeeds THEN the system SHALL return the resulting commit SHA, target branch, and a compare or commit link that the maintainer can inspect on GitHub.

### Requirement 6

**User Story:** As a content maintainer, I want the CMS to enforce repository safety boundaries, so that it cannot accidentally modify unrelated project areas.

#### Acceptance Criteria

1. WHEN the CMS writes to GitHub THEN it SHALL only modify files under `content/card/**` and `content/attachments/**` in this phase.
2. IF a publish request contains unsupported paths, unsupported deletions, or unauthorized branch targets THEN the system SHALL reject the request server-side.
3. WHEN the browser communicates with GitHub-backed features THEN the system SHALL call the Worker backend instead of calling GitHub APIs with a browser-exposed token.
4. WHEN a publish finishes THEN the system SHALL display the actor, repository, branch, publish time, and commit SHA for the successful operation.

## Non-Functional Requirements

### Code Architecture and Modularity

- The solution SHALL separate browser editing UI, shared content parsing and validation logic, and Worker-side GitHub integration into distinct modules.
- The single-layer card parsing rules SHALL be implemented once in shared pure logic and reused by both browser preview and Worker validation.
- Reference code under `ref/EDU-PUBLISH` SHALL be treated as a blueprint to copy or adapt from, not as a runtime dependency.
- GitHub write logic SHALL remain isolated from preview rendering logic so that UI changes do not alter publish behavior.

### Performance

- The system SHOULD load a branch workspace of up to 300 card files within 5 seconds on a typical broadband connection after authentication has completed.
- Typical field edits SHOULD update preview-visible state within 300 ms, and a full workspace recompilation SHOULD complete within 1.5 seconds for normal content sizes.
- Server-side validation plus publish SHOULD complete within 10 seconds for text-only changes, excluding time spent uploading large attachments.

### Security

- GitHub OAuth SHALL use the web application flow with PKCE and `state` protection.
- GitHub access tokens SHALL remain in Worker-managed secure session storage and SHALL NOT be exposed to browser JavaScript.
- The Worker SHALL enforce an allowlist of writable repository paths and SHALL use branch-head concurrency checks before updating refs.
- The system SHALL validate attachment paths and SHALL reject path traversal or repository-escaping references.

### Reliability

- Browser preview validation and Worker publish validation SHALL follow the same schema and normalization rules.
- A failed publish SHALL NOT partially update the target branch.
- Local draft data SHALL remain recoverable after validation failure, remote conflict, or temporary GitHub API failure until the maintainer explicitly discards it.
- Error responses SHALL identify the affected file and reason whenever possible.

### Usability

- The CMS SHALL provide structured form editing for frontmatter fields and a Markdown editor for body content.
- Validation feedback SHALL appear inline near the affected field and again in a publish summary when relevant.
- The preview UI SHALL stay visually close to EDU-PUBLISH on both desktop and mobile layouts, while the editing workflow is optimized for desktop use.
- The publish dialog SHALL summarize exactly what will be written before the maintainer confirms the operation.

### Testability and Developer Feedback

- The implementation SHALL provide runnable CLI commands for local web development, Worker development, type checking, unit tests, integration tests, end-to-end tests, and production build verification.
- Non-trivial feature work SHALL be implementable with a continuous feedback loop from at least one real CLI process such as a watch-mode test runner, type checker, or local dev server.
- Bug fixes SHALL be reproducible with a failing automated test or a documented CLI reproduction path before the fix is considered complete.
- The system SHALL emit actionable local debug output for compile failures, validation failures, publish failures, and branch conflict detection without exposing secrets.
