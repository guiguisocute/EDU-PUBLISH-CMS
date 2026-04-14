# Tasks Document

本任务拆分遵循两个原则：

1. 不允许“一口气生成整个项目”后再统一调试。
2. 每个里程碑进入下一阶段前，必须通过真实 CLI 验证门禁。

## Milestone 1: Establish the feedback loops first

在进入共享编译器和业务代码前，先把项目脚手架、类型检查、单测、集成测试、E2E、Worker 本地运行能力搭起来。

**Verification gate before Milestone 2**

- `pnpm install`
- `pnpm run typecheck`
- `pnpm run test:unit`
- `pnpm run build`

- [x] 1.1 Establish the root runtime and build script contract in `package.json`, `tsconfig.json`, and `vite.config.ts`
  - Files: `package.json`, `tsconfig.json`, `vite.config.ts`
  - Purpose: Create the minimum runnable frontend toolchain and the script contract promised by the design doc.
  - _Leverage: `ref/EDU-PUBLISH/package.json`, `ref/EDU-PUBLISH/tsconfig.json`, `ref/EDU-PUBLISH/vite.config.ts`_
  - _Requirements: NFR Code Architecture and Modularity, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Build and tooling engineer | Task: create the root package, TypeScript, and Vite runtime contract so the project has real CLI entrypoints from the first slice and matches the design doc's required script surface as closely as possible | Restrictions: Do not add placeholder scripts that always pass, do not hide missing tools behind no-op commands, keep the initial config minimal and runnable on Node 22 with pnpm | _Leverage: ref/EDU-PUBLISH/package.json, ref/EDU-PUBLISH/tsconfig.json, ref/EDU-PUBLISH/vite.config.ts | _Requirements: NFR Code Architecture and Modularity, NFR Testability and Developer Feedback | Success: the project has a coherent root script contract and can support immediate follow-up typecheck, test, and build work without renaming scripts later | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 1.2 Configure Worker and test runners in `wrangler.toml`, `vitest.config.ts`, and `playwright.config.ts`
  - Files: `wrangler.toml`, `vitest.config.ts`, `playwright.config.ts`
  - Purpose: Make the Worker runtime and the three test layers runnable from day one.
  - _Leverage: `ref/EDU-PUBLISH/wrangler.toml`, `ref/EDU-PUBLISH/package.json`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: Requirement 1, NFR Security, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Test infrastructure engineer | Task: add the Worker runtime config plus unit, integration, and E2E runner configs so later tasks can rely on stable CLI feedback loops instead of ad hoc setup | Restrictions: Do not over-configure test projects before they have consumers, keep unit and integration projects clearly separated, avoid any config that requires secrets just to boot locally | _Leverage: ref/EDU-PUBLISH/wrangler.toml, ref/EDU-PUBLISH/package.json, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 1, NFR Security, NFR Testability and Developer Feedback | Success: local Worker, Vitest, and Playwright configs exist and are wired to the root scripts without requiring future structural rewrites | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 1.3 Add shared test setup and a baseline smoke test in `tests/setup/unit.ts`, `tests/setup/integration.ts`, and `tests/unit/smoke/app-shell.test.tsx`
  - Files: `tests/setup/unit.ts`, `tests/setup/integration.ts`, `tests/unit/smoke/app-shell.test.tsx`
  - Purpose: Prove the test runners execute real code and establish the first green bar.
  - _Leverage: `vitest.config.ts`, `playwright.config.ts`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA infrastructure engineer | Task: add shared unit and integration test bootstrap files plus a tiny smoke test so the repository gets its first trustworthy green feedback loop before feature work starts | Restrictions: Do not write meaningless assertions that only test the framework, keep the smoke scope tiny, and make the setup files reusable for later focused watch workflows | _Leverage: vitest.config.ts, playwright.config.ts, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: NFR Testability and Developer Feedback | Success: unit and integration test setup files are in place and at least one smoke test can run green from the CLI | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

## Milestone 2: Build the shared content contract and preview compiler

这个里程碑先做纯逻辑。只有共享编译器和序列化器稳定后，前端编辑器和 Worker 校验才不会分叉。

**Verification gate before Milestone 3**

- `pnpm run test:unit -- card-document`
- `pnpm run test:unit -- preview-compiler`
- `pnpm run typecheck`

- [x] 2.1 Define shared content and GitHub data models in `types/content.ts` and `types/github.ts`
  - Files: `types/content.ts`, `types/github.ts`
  - Purpose: Lock the cross-layer data contracts before parser, preview, and Worker routes start diverging.
  - _Leverage: `ref/EDU-PUBLISH/types.ts`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: Requirement 2, Requirement 3, Requirement 5, NFR Code Architecture and Modularity_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript architect | Task: define the shared content and GitHub-facing type contracts that browser code, shared compiler logic, and Worker routes will all depend on, using the design doc as the source of truth | Restrictions: Do not invent unused abstraction layers, keep types aligned with the current single-layer card schema, and avoid leaking Worker-only details into browser-facing contracts unless required | _Leverage: ref/EDU-PUBLISH/types.ts, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 2, Requirement 3, Requirement 5, NFR Code Architecture and Modularity | Success: the type surface is precise enough to support parser, workspace, and publish tasks without immediate breaking changes | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.2 Add failing round-trip tests for card parsing and serialization in `tests/unit/content/card-document.test.ts`
  - Files: `tests/unit/content/card-document.test.ts`
  - Purpose: Force the parser/serializer behavior to be proven before implementation.
  - _Leverage: `ref/EDU-PUBLISH/content/card/demo/demo-normal.md`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: Requirement 2, Requirement 3, NFR Reliability, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TDD-focused QA engineer | Task: write failing unit tests for single-layer card parsing and serialization, covering unknown field preservation, field ordering stability, and markdown body round-trip fidelity before any parser code is written | Restrictions: Do not implement production logic in the test file, use realistic markdown fixtures, and make failures point to concrete schema behavior instead of vague snapshots | _Leverage: ref/EDU-PUBLISH/content/card/demo/demo-normal.md, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 2, Requirement 3, NFR Reliability, NFR Testability and Developer Feedback | Success: the new tests fail for the right reasons against the missing or incomplete parser implementation and can run in focused watch mode | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.3 Implement round-trip card parsing and serialization in `lib/content/card-document.ts` and `lib/content/card-serializer.ts`
  - Files: `lib/content/card-document.ts`, `lib/content/card-serializer.ts`
  - Purpose: Provide the pure document logic that both the editor and the Worker can trust.
  - _Leverage: `tests/unit/content/card-document.test.ts`, `ref/EDU-PUBLISH/scripts/compile-content.mjs`_
  - _Requirements: Requirement 2, Requirement 3, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript library engineer | Task: implement the single-layer card parser and serializer to satisfy the failing round-trip tests and the design doc's fidelity rules, with emphasis on preserving unrelated frontmatter fields | Restrictions: Do not use lossy stringify behavior that rewrites the whole document unexpectedly, keep logic pure and browser-safe, and avoid coupling parser behavior to React or Worker code | _Leverage: tests/unit/content/card-document.test.ts, ref/EDU-PUBLISH/scripts/compile-content.mjs | _Requirements: Requirement 2, Requirement 3, NFR Reliability | Success: focused parser tests turn green and the implementation can safely power both draft editing and server-side validation | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.4 Add failing tests for config normalization and attachment behavior in `tests/unit/content/config-normalizers.test.ts` and `tests/unit/content/attachments.test.ts`
  - Files: `tests/unit/content/config-normalizers.test.ts`, `tests/unit/content/attachments.test.ts`
  - Purpose: Lock down the preview configuration defaults and attachment normalization rules before implementation.
  - _Leverage: `ref/EDU-PUBLISH/scripts/compile-site-config.mjs`, `ref/EDU-PUBLISH/scripts/compile-widgets-config.mjs`, `ref/EDU-PUBLISH/scripts/compile-content.mjs`_
  - _Requirements: Requirement 3, Requirement 4, Requirement 6, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TDD-focused QA engineer | Task: write failing tests for site config defaults, widget config defaults, subscription mapping assumptions, and attachment normalization or path rejection behavior so the shared compiler rules are executable before implementation | Restrictions: Do not over-snapshot large JSON blobs, cover at least one invalid attachment path case, and keep the tests small enough for focused watch mode | _Leverage: ref/EDU-PUBLISH/scripts/compile-site-config.mjs, ref/EDU-PUBLISH/scripts/compile-widgets-config.mjs, ref/EDU-PUBLISH/scripts/compile-content.mjs | _Requirements: Requirement 3, Requirement 4, Requirement 6, NFR Reliability | Success: the config and attachment tests fail first and describe the intended normalization rules clearly | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.5 Implement site and widget normalizers in `lib/content/site-config.ts` and `lib/content/widgets-config.ts`
  - Files: `lib/content/site-config.ts`, `lib/content/widgets-config.ts`
  - Purpose: Recreate the preview-side config behavior without depending on Node `fs` scripts.
  - _Leverage: `tests/unit/content/config-normalizers.test.ts`, `ref/EDU-PUBLISH/scripts/compile-site-config.mjs`, `ref/EDU-PUBLISH/scripts/compile-widgets-config.mjs`_
  - _Requirements: Requirement 2, Requirement 4, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript utility engineer | Task: implement browser-safe site and widget config normalizers that mirror the reference project's behavior closely enough for preview fidelity and later Worker validation reuse | Restrictions: Do not pull in Node-only APIs, keep functions pure, and preserve defaulting logic that the preview shell depends on | _Leverage: tests/unit/content/config-normalizers.test.ts, ref/EDU-PUBLISH/scripts/compile-site-config.mjs, ref/EDU-PUBLISH/scripts/compile-widgets-config.mjs | _Requirements: Requirement 2, Requirement 4, NFR Reliability | Success: config normalization tests turn green and the resulting output shape is usable by the preview layer without additional ad hoc massaging | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.6 Implement subscription mapping and attachment normalization in `lib/content/subscriptions-config.ts` and `lib/content/attachments.ts`
  - Files: `lib/content/subscriptions-config.ts`, `lib/content/attachments.ts`
  - Purpose: Reproduce the current school or subscription mapping and attachment merge rules used by EDU-PUBLISH.
  - _Leverage: `tests/unit/content/config-normalizers.test.ts`, `tests/unit/content/attachments.test.ts`, `ref/EDU-PUBLISH/scripts/compile-content.mjs`_
  - _Requirements: Requirement 2, Requirement 3, Requirement 4, Requirement 6_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Content pipeline engineer | Task: implement subscription normalization and attachment normalization utilities, including path validation and body attachment extraction support, so the shared compiler can build a trustworthy preview model | Restrictions: Do not allow repository-escaping paths, do not embed React concerns into these helpers, and keep behavior aligned with the current single-layer card model | _Leverage: tests/unit/content/config-normalizers.test.ts, tests/unit/content/attachments.test.ts, ref/EDU-PUBLISH/scripts/compile-content.mjs | _Requirements: Requirement 2, Requirement 3, Requirement 4, Requirement 6 | Success: subscription and attachment tests turn green and the utilities are ready for both browser preview and Worker-side validation | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.7 Add failing preview compiler tests in `tests/unit/content/preview-compiler.test.ts`
  - Files: `tests/unit/content/preview-compiler.test.ts`
  - Purpose: Specify how draft cards and read-only configs become preview data before implementing the compiler.
  - _Leverage: `ref/EDU-PUBLISH/hooks/use-feed-data.ts`, `ref/EDU-PUBLISH/scripts/compile-content.mjs`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: Requirement 4, NFR Reliability, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TDD-focused QA engineer | Task: write failing tests for the preview compiler, covering feed grouping, pinned sorting, attachment placement data, validation issue reporting, and compatibility with the reused preview UI shape | Restrictions: Do not test incidental implementation details, cover at least one invalid draft case, and keep fixtures close to the EDU-PUBLISH card schema | _Leverage: ref/EDU-PUBLISH/hooks/use-feed-data.ts, ref/EDU-PUBLISH/scripts/compile-content.mjs, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 4, NFR Reliability, NFR Testability and Developer Feedback | Success: preview compiler tests fail first in a focused run and describe the desired model shape clearly | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 2.8 Implement the preview compiler in `lib/content/preview-compiler.ts`
  - Files: `lib/content/preview-compiler.ts`
  - Purpose: Create the shared compiler that powers browser preview and final Worker validation.
  - _Leverage: `tests/unit/content/preview-compiler.test.ts`, `lib/content/site-config.ts`, `lib/content/widgets-config.ts`, `lib/content/subscriptions-config.ts`, `lib/content/attachments.ts`_
  - _Requirements: Requirement 4, Requirement 6, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Content compiler engineer | Task: implement the shared preview compiler that turns draft cards plus read-only configs into a preview model and structured validation issues, matching the reference project's list and detail expectations as closely as possible | Restrictions: Do not fetch remote data inside the compiler, keep output deterministic, and make compile errors file-aware rather than generic | _Leverage: tests/unit/content/preview-compiler.test.ts, lib/content/site-config.ts, lib/content/widgets-config.ts, lib/content/subscriptions-config.ts, lib/content/attachments.ts | _Requirements: Requirement 4, Requirement 6, NFR Reliability | Success: focused preview compiler tests turn green and the compiler is reusable by both browser and Worker layers | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

## Milestone 3: Stand up the Worker auth and repository read path

有了共享逻辑后，再接 GitHub。这个顺序可以避免在 OAuth 和 API 代码里混入不可测的内容规则。

**Verification gate before Milestone 4**

- `pnpm run test:integration -- auth-session`
- `pnpm run test:integration -- repos-workspace`
- `pnpm run dev:worker`
- Manual smoke: complete login mock flow and load one compatible workspace

- [x] 3.1 Create the Worker app shell and route wiring in `worker/app.ts` and `worker/index.ts`
  - Files: `worker/app.ts`, `worker/index.ts`
  - Purpose: Provide the single entrypoint that later route tasks can plug into and test against.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `wrangler.toml`_
  - _Requirements: Requirement 1, Requirement 6, NFR Code Architecture and Modularity_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Worker platform engineer | Task: create the minimal Worker application shell and route registration entrypoint so future auth, workspace, and publish routes have a clean integration surface and test target | Restrictions: Do not stuff business logic into the app bootstrap, keep request wiring simple, and leave space for request logging middleware later | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, wrangler.toml | _Requirements: Requirement 1, Requirement 6, NFR Code Architecture and Modularity | Success: the Worker can boot locally with a stable route container ready for incremental route tasks | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 3.2 Add failing auth and session integration tests in `tests/integration/worker/auth-session.test.ts`
  - Files: `tests/integration/worker/auth-session.test.ts`
  - Purpose: Force the OAuth start, callback, and session behavior to be exercised before implementation.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `worker/app.ts`_
  - _Requirements: Requirement 1, NFR Security, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration test engineer | Task: write failing integration tests for the auth start, callback, logout, and session read flow, including state protection and session cookie behavior, before the auth handlers exist | Restrictions: Do not call real GitHub endpoints in test runs, make the assertions request-contract focused, and keep secrets out of fixtures or logs | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, worker/app.ts | _Requirements: Requirement 1, NFR Security, NFR Testability and Developer Feedback | Success: auth-session integration tests fail first and can be run in focused watch mode while the Worker is being implemented | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 3.3 Implement OAuth and session helpers in `worker/auth/oauth.ts` and `worker/session/cookies.ts`
  - Files: `worker/auth/oauth.ts`, `worker/session/cookies.ts`
  - Purpose: Isolate PKCE, state, and cookie concerns from route handlers.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, GitHub OAuth docs, `tests/integration/worker/auth-session.test.ts`_
  - _Requirements: Requirement 1, NFR Security_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Security-focused backend engineer | Task: implement the pure OAuth helper and secure session cookie helper modules needed for GitHub login, PKCE, state validation, and encrypted session handling | Restrictions: Do not expose tokens to browser code, do not log secrets, and avoid burying security-sensitive behavior inside route handlers | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, tests/integration/worker/auth-session.test.ts | _Requirements: Requirement 1, NFR Security | Success: helper modules satisfy the auth test expectations and keep the later route handlers thin | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 3.4 Implement auth and session routes in `worker/routes/auth.ts` and `worker/routes/session.ts`
  - Files: `worker/routes/auth.ts`, `worker/routes/session.ts`
  - Purpose: Deliver the real login and session endpoints on top of the tested helpers.
  - _Leverage: `worker/app.ts`, `worker/auth/oauth.ts`, `worker/session/cookies.ts`, `tests/integration/worker/auth-session.test.ts`_
  - _Requirements: Requirement 1, Requirement 6, NFR Security_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Worker API engineer | Task: implement the auth start, callback, logout, and session routes on top of the tested helpers so the browser gets a clean Worker-managed session surface | Restrictions: Keep route handlers thin, do not duplicate PKCE or cookie logic in multiple places, and return safe error payloads with no secret leakage | _Leverage: worker/app.ts, worker/auth/oauth.ts, worker/session/cookies.ts, tests/integration/worker/auth-session.test.ts | _Requirements: Requirement 1, Requirement 6, NFR Security | Success: auth-session integration tests turn green and the local Worker can expose a stable session API | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 3.5 Add failing repository and workspace-load integration tests in `tests/integration/worker/repos-workspace.test.ts`
  - Files: `tests/integration/worker/repos-workspace.test.ts`
  - Purpose: Lock down repository compatibility checks and workspace loading behavior before implementation.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `worker/app.ts`_
  - _Requirements: Requirement 1, Requirement 2, Requirement 6_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration test engineer | Task: write failing integration tests for repo listing, branch listing, compatibility enforcement, workspace load, and remote head capture using mocked GitHub responses | Restrictions: Do not hit live GitHub, cover at least one incompatible repository case, and make assertions focus on API contracts and safety boundaries | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, worker/app.ts | _Requirements: Requirement 1, Requirement 2, Requirement 6 | Success: repos-workspace integration tests fail first and give the Worker read-path implementation a tight feedback loop | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 3.6 Implement the GitHub read client and compatibility checker in `lib/github/client.ts` and `lib/github/compatibility.ts`
  - Files: `lib/github/client.ts`, `lib/github/compatibility.ts`
  - Purpose: Centralize GitHub read operations and repository shape validation.
  - _Leverage: `tests/integration/worker/repos-workspace.test.ts`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: Requirement 1, Requirement 2, Requirement 6, NFR Security_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: GitHub integration engineer | Task: implement a reusable GitHub read client plus repository compatibility checks for the CMS-supported EDU-PUBLISH shape, including branch head lookup and filtered file discovery | Restrictions: Do not let browser-only concerns leak into this layer, do not embed route formatting logic here, and keep path allowlists explicit | _Leverage: tests/integration/worker/repos-workspace.test.ts, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 1, Requirement 2, Requirement 6, NFR Security | Success: the GitHub read layer can support repo and workspace routes without duplicated API code and matches the integration test expectations | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 3.7 Implement repository and workspace routes in `worker/routes/repos.ts` and `worker/routes/workspace.ts`
  - Files: `worker/routes/repos.ts`, `worker/routes/workspace.ts`
  - Purpose: Deliver the Worker APIs that the browser workspace depends on for repo selection and workspace hydration.
  - _Leverage: `lib/github/client.ts`, `lib/github/compatibility.ts`, `lib/content/preview-compiler.ts`, `tests/integration/worker/repos-workspace.test.ts`_
  - _Requirements: Requirement 1, Requirement 2, Requirement 6_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Worker API engineer | Task: implement the repo listing, branch listing, and workspace load routes so the browser can hydrate a full draft workspace from a compatible repository branch through the Worker | Restrictions: Do not bypass compatibility checks, keep route payloads explicit, and preserve branch head SHA for later publish conflict detection | _Leverage: lib/github/client.ts, lib/github/compatibility.ts, lib/content/preview-compiler.ts, tests/integration/worker/repos-workspace.test.ts | _Requirements: Requirement 1, Requirement 2, Requirement 6 | Success: repos-workspace integration tests turn green and manual local Worker smoke testing can load a compatible workspace | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

## Milestone 4: Build the browser draft workspace and editor

这一阶段只关注“可加载、可编辑、可看见 dirty 状态”，先不碰完整预览复用和发布动作。

**Verification gate before Milestone 5**

- `pnpm run test:unit -- cms`
- `pnpm run dev:web`
- Manual smoke: load a workspace, edit one field, observe dirty state and validation feedback

- [x] 4.1 Add failing tests for the draft workspace hook and repo selector in `tests/unit/cms/use-draft-workspace.test.tsx` and `tests/unit/cms/repo-selector.test.tsx`
  - Files: `tests/unit/cms/use-draft-workspace.test.tsx`, `tests/unit/cms/repo-selector.test.tsx`
  - Purpose: Lock the browser-side workspace lifecycle and repo-selection behavior before implementation.
  - _Leverage: `worker/routes/repos.ts`, `worker/routes/workspace.ts`, `.spec-workflow/specs/edu-publish-cms/design.md`_
  - _Requirements: Requirement 1, Requirement 2, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend test engineer | Task: write failing tests for the browser draft workspace hook and repo selector, covering workspace hydration, selected card state, dirty state, and branch or repo switching behavior before the implementation exists | Restrictions: Do not mock away all behavior until nothing meaningful remains, keep tests focused on observable state transitions, and use the Worker API contracts already defined | _Leverage: worker/routes/repos.ts, worker/routes/workspace.ts, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 1, Requirement 2, NFR Testability and Developer Feedback | Success: the focused CMS tests fail first and give immediate watch-mode feedback for the upcoming browser workspace implementation | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 4.2 Implement the draft workspace hook and repo selector in `hooks/use-draft-workspace.ts` and `components/cms/RepoSelector.tsx`
  - Files: `hooks/use-draft-workspace.ts`, `components/cms/RepoSelector.tsx`
  - Purpose: Give the browser a real repository or branch selection flow and local draft workspace state.
  - _Leverage: `tests/unit/cms/use-draft-workspace.test.tsx`, `tests/unit/cms/repo-selector.test.tsx`, `worker/routes/repos.ts`, `worker/routes/workspace.ts`_
  - _Requirements: Requirement 1, Requirement 2, Requirement 6_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React engineer | Task: implement the draft workspace hook and repo selector component so the browser can fetch a compatible workspace, track draft state, and expose the base branch context for later editing and publishing | Restrictions: Do not embed form-field editing logic yet, keep network calls behind the hook boundary, and maintain clear dirty-state bookkeeping | _Leverage: tests/unit/cms/use-draft-workspace.test.tsx, tests/unit/cms/repo-selector.test.tsx, worker/routes/repos.ts, worker/routes/workspace.ts | _Requirements: Requirement 1, Requirement 2, Requirement 6 | Success: focused CMS state tests turn green and the dev server can load a workspace through the Worker API | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 4.3 Add failing editor-panel tests in `tests/unit/cms/card-editor-panel.test.tsx`
  - Files: `tests/unit/cms/card-editor-panel.test.tsx`
  - Purpose: Specify the single-file card editing behavior before implementing the editor UI.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/requirements.md`, `types/content.ts`_
  - _Requirements: Requirement 3, Requirement 6, NFR Usability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend test engineer | Task: write failing tests for the card editor panel, covering field edits, attachment edits, inline validation, and markdown body updates for the current single-layer card schema | Restrictions: Do not couple tests to CSS details, cover at least one invalid required-field case, and keep the assertions centered on user-visible editing behavior | _Leverage: .spec-workflow/specs/edu-publish-cms/requirements.md, types/content.ts | _Requirements: Requirement 3, Requirement 6, NFR Usability | Success: card editor tests fail first and create a focused watch loop for the editor implementation | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 4.4 Implement the card editor panel in `components/cms/CardEditorPanel.tsx`
  - Files: `components/cms/CardEditorPanel.tsx`
  - Purpose: Deliver structured editing for card frontmatter and Markdown body.
  - _Leverage: `tests/unit/cms/card-editor-panel.test.tsx`, `ref/EDU-PUBLISH/components/ui/*`, `.spec-workflow/specs/edu-publish-cms/requirements.md`_
  - _Requirements: Requirement 3, NFR Usability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend engineer | Task: implement the structured card editor panel for the single-layer card schema, including frontmatter fields, attachment editing, markdown body editing, and inline validation display | Restrictions: Do not introduce a heavyweight editor abstraction unless clearly necessary, keep the form desktop-friendly, and avoid mutating the draft model outside the provided hook API | _Leverage: tests/unit/cms/card-editor-panel.test.tsx, .spec-workflow/specs/edu-publish-cms/requirements.md | _Requirements: Requirement 3, NFR Usability | Success: card editor tests turn green and the panel can edit a live draft card in the browser workspace | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 4.5 Implement the CMS shell and app bootstrapping in `components/cms/CmsWorkspaceShell.tsx`, `App.tsx`, and `index.tsx`
  - Files: `components/cms/CmsWorkspaceShell.tsx`, `App.tsx`, `index.tsx`
  - Purpose: Assemble login, repo selection, workspace loading, and editor scaffolding into a real app shell.
  - _Leverage: `ref/EDU-PUBLISH/App.tsx`, `hooks/use-draft-workspace.ts`, `components/cms/RepoSelector.tsx`, `components/cms/CardEditorPanel.tsx`_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React application engineer | Task: assemble the main CMS shell and bootstrap files so login state, repo selection, workspace loading, and editor rendering work together in the browser | Restrictions: Do not add publish logic yet, keep preview and editor panes loosely coupled, and make app-shell failures visible rather than silent | _Leverage: ref/EDU-PUBLISH/App.tsx, hooks/use-draft-workspace.ts, components/cms/RepoSelector.tsx, components/cms/CardEditorPanel.tsx | _Requirements: Requirement 1, Requirement 2, Requirement 3 | Success: the app boots locally, loads the workspace shell, and can host the editor before preview integration lands | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 4.6 Add a dev diagnostics surface in `components/cms/DevDiagnostics.tsx` and `hooks/use-draft-workspace.ts`
  - Files: `components/cms/DevDiagnostics.tsx`, `hooks/use-draft-workspace.ts`
  - Purpose: Expose live draft and compile context during development to prevent blind debugging.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `components/cms/CmsWorkspaceShell.tsx`_
  - _Requirements: NFR Testability and Developer Feedback, Requirement 2, Requirement 4_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend platform engineer | Task: add a dev-only diagnostics panel tied to the workspace hook so developers can see selected card id, dirty file count, compile timings, base head SHA, and validation counts while coding | Restrictions: Do not expose secrets or auth tokens, keep the diagnostics removable in production builds, and avoid polluting the end-user editing UI | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, components/cms/CmsWorkspaceShell.tsx | _Requirements: NFR Testability and Developer Feedback, Requirement 2, Requirement 4 | Success: local development shows actionable diagnostics that reduce blind debugging while leaving production behavior clean | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

## Milestone 5: Reuse the EDU-PUBLISH-style preview experience

到这里才接入完整预览 UI。这样一旦预览不对，可以优先怀疑适配层，而不是整个系统都没站稳。

**Verification gate before Milestone 6**

- `pnpm run test:unit -- preview`
- `pnpm run dev:web`
- Manual smoke: open list preview, open detail modal, verify attachment-first detail rendering and list-detail motion behavior

- [x] 5.1 Add failing preview UI tests in `tests/unit/preview/preview-pane.test.tsx`
  - Files: `tests/unit/preview/preview-pane.test.tsx`
  - Purpose: Lock the preview interaction contract before implementing the adaptation layer.
  - _Leverage: `ref/EDU-PUBLISH/components/LeftSidebar.tsx`, `ref/EDU-PUBLISH/components/ArticleList.tsx`, `ref/EDU-PUBLISH/components/NoticeDetailModal.tsx`_
  - _Requirements: Requirement 4, NFR Usability, NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend test engineer | Task: write failing unit tests for the preview pane, covering sidebar grouping, list rendering, detail modal open or close behavior, ESC support, previous or next navigation, and attachment-first ordering | Restrictions: Do not overspecify visual styles, cover at least one attachment scenario and one invalid-compile scenario, and keep tests tied to user-observable behavior | _Leverage: ref/EDU-PUBLISH/components/LeftSidebar.tsx, ref/EDU-PUBLISH/components/ArticleList.tsx, ref/EDU-PUBLISH/components/NoticeDetailModal.tsx | _Requirements: Requirement 4, NFR Usability, NFR Testability and Developer Feedback | Success: preview tests fail first and provide a tight feedback loop for the preview adaptation work | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 5.2 Implement the preview adapter and pane in `lib/content/preview-adapter.ts` and `components/preview/PreviewPane.tsx`
  - Files: `lib/content/preview-adapter.ts`, `components/preview/PreviewPane.tsx`
  - Purpose: Bridge the shared compiler output to the reused EDU-PUBLISH preview components.
  - _Leverage: `tests/unit/preview/preview-pane.test.tsx`, `lib/content/preview-compiler.ts`, `ref/EDU-PUBLISH/types.ts`_
  - _Requirements: Requirement 4, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend integration engineer | Task: implement the adapter that maps shared compiler output into the preview component inputs and build the preview pane wrapper that displays compile issues or the rendered EDU-PUBLISH-style preview | Restrictions: Do not duplicate the whole compiler in the UI layer, keep the adapter deterministic, and preserve file-level compile errors for developer visibility | _Leverage: tests/unit/preview/preview-pane.test.tsx, lib/content/preview-compiler.ts, ref/EDU-PUBLISH/types.ts | _Requirements: Requirement 4, NFR Reliability | Success: preview pane tests turn green and the preview can render shared compiler output without ad hoc state translation scattered across the app | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 5.3 Integrate the reference-style preview shell in `components/preview/PreviewAppShell.tsx` and `components/cms/CmsWorkspaceShell.tsx`
  - Files: `components/preview/PreviewAppShell.tsx`, `components/cms/CmsWorkspaceShell.tsx`
  - Purpose: Put the adapted preview UI next to the editor in the real workspace shell.
  - _Leverage: `ref/EDU-PUBLISH/App.tsx`, `components/preview/PreviewPane.tsx`, `components/cms/DevDiagnostics.tsx`_
  - _Requirements: Requirement 4, NFR Usability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React application engineer | Task: integrate the reference-style preview shell into the CMS workspace so edits and preview stay side by side and detail modal interactions remain on-page without altering URLs | Restrictions: Do not collapse the editor and preview into a monolith, preserve current workspace state while opening details, and keep diagnostics available in development only | _Leverage: ref/EDU-PUBLISH/App.tsx, components/preview/PreviewPane.tsx, components/cms/DevDiagnostics.tsx | _Requirements: Requirement 4, NFR Usability | Success: manual preview smoke passes for list rendering, detail modal interactions, and attachment-first detail layout inside the live CMS shell | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

## Milestone 6: Implement publish, conflict detection, and safety gates

现在才接真正的写仓库能力。此前所有任务都在降低这一阶段出错的代价。

**Verification gate before Milestone 7**

- `pnpm run test:integration -- publish`
- `pnpm run build`
- Manual smoke: validate a publish draft, simulate a branch conflict, then complete a successful publish

- [x] 6.1 Add failing publish integration tests in `tests/integration/worker/publish.test.ts`
  - Files: `tests/integration/worker/publish.test.ts`
  - Purpose: Lock atomic publish, path allowlists, and branch conflict behavior before implementation.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `worker/app.ts`_
  - _Requirements: Requirement 5, Requirement 6, NFR Reliability, NFR Security_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration test engineer | Task: write failing integration tests for publish validation, atomic commit creation, new branch creation, branch head conflict rejection, and path allowlist enforcement before the publish path exists | Restrictions: Do not hit live GitHub, cover at least one 409-style conflict and one invalid path rejection, and make the test fixtures explicit about base and remote SHA states | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, worker/app.ts | _Requirements: Requirement 5, Requirement 6, NFR Reliability, NFR Security | Success: publish integration tests fail first and establish a precise safety contract for the write path | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 6.2 Implement the publish validator and git commit builder in `lib/github/publish-validator.ts` and `lib/github/git-commit-builder.ts`
  - Files: `lib/github/publish-validator.ts`, `lib/github/git-commit-builder.ts`
  - Purpose: Isolate path allowlist enforcement and Git database write construction from route code.
  - _Leverage: `tests/integration/worker/publish.test.ts`, `.spec-workflow/specs/edu-publish-cms/design.md`, GitHub Git database API docs_
  - _Requirements: Requirement 5, Requirement 6, NFR Reliability, NFR Security_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: GitHub write-path engineer | Task: implement the server-side publish validator and git commit builder so publish requests are path-restricted, branch-aware, and capable of producing one atomic commit update through GitHub's Git database APIs | Restrictions: Do not use a per-file contents write loop for multi-file publish, do not allow writes outside approved paths, and keep conflict handling explicit rather than implicit | _Leverage: tests/integration/worker/publish.test.ts, .spec-workflow/specs/edu-publish-cms/design.md | _Requirements: Requirement 5, Requirement 6, NFR Reliability, NFR Security | Success: publish safety logic is reusable, testable, and aligned with the integration test scenarios before the route itself is wired | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 6.3 Implement the publish route in `worker/routes/publish.ts` and `worker/app.ts`
  - Files: `worker/routes/publish.ts`, `worker/app.ts`
  - Purpose: Expose the final Worker API for validate-and-publish operations.
  - _Leverage: `lib/github/publish-validator.ts`, `lib/github/git-commit-builder.ts`, `lib/content/preview-compiler.ts`, `tests/integration/worker/publish.test.ts`_
  - _Requirements: Requirement 5, Requirement 6, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Worker API engineer | Task: implement the publish route that revalidates the workspace, checks branch head concurrency, creates a new commit or branch when allowed, and returns publish metadata for the UI | Restrictions: Do not trust browser-side validation alone, keep partial updates impossible by only updating refs at the end, and return actionable conflict or validation errors | _Leverage: lib/github/publish-validator.ts, lib/github/git-commit-builder.ts, lib/content/preview-compiler.ts, tests/integration/worker/publish.test.ts | _Requirements: Requirement 5, Requirement 6, NFR Reliability | Success: publish integration tests turn green and the Worker can complete an end-to-end publish against mocked GitHub flows | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 6.4 Add failing publish-dialog tests in `tests/unit/cms/publish-dialog.test.tsx`
  - Files: `tests/unit/cms/publish-dialog.test.tsx`
  - Purpose: Specify the UI contract for changed-file summaries, branch targets, validation blocking, and conflict feedback.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/requirements.md`, `worker/routes/publish.ts`_
  - _Requirements: Requirement 5, Requirement 6, NFR Usability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend test engineer | Task: write failing tests for the publish dialog, covering changed-file summaries, branch selection, validation blocking, successful publish metadata display, and branch conflict messaging before the component is implemented | Restrictions: Do not rely on brittle snapshots, cover at least one blocked publish case, and make the tests assert the actual review workflow the maintainer sees | _Leverage: .spec-workflow/specs/edu-publish-cms/requirements.md, worker/routes/publish.ts | _Requirements: Requirement 5, Requirement 6, NFR Usability | Success: publish dialog tests fail first and provide a focused loop for the final browser-side publish UX | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 6.5 Implement the publish dialog and conflict UX in `components/cms/PublishDialog.tsx` and `hooks/use-draft-workspace.ts`
  - Files: `components/cms/PublishDialog.tsx`, `hooks/use-draft-workspace.ts`
  - Purpose: Give the maintainer a safe review-and-publish workflow with visible conflict handling.
  - _Leverage: `tests/unit/cms/publish-dialog.test.tsx`, `worker/routes/publish.ts`, `components/cms/CmsWorkspaceShell.tsx`_
  - _Requirements: Requirement 5, Requirement 6, NFR Usability, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend engineer | Task: implement the publish dialog and wire it into the draft workspace hook so the maintainer can review changes, select or create a branch, submit publish requests, and recover cleanly from validation or conflict failures | Restrictions: Do not let publish mutate the local draft silently on failure, keep branch conflict messaging explicit, and avoid hiding changed-file details behind secondary clicks | _Leverage: tests/unit/cms/publish-dialog.test.tsx, worker/routes/publish.ts, components/cms/CmsWorkspaceShell.tsx | _Requirements: Requirement 5, Requirement 6, NFR Usability, NFR Reliability | Success: publish dialog tests turn green and the live CMS can complete a review-first publish workflow with visible failure recovery | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

## Milestone 7: Harden with E2E, logging, and developer runbooks

最后阶段不是补花活，而是把“能开发、能定位、能回归”真正闭环。

**Final verification gate**

- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:e2e`
- `pnpm run build`

- [x] 7.1 Add an E2E happy path in `tests/e2e/workspace-edit-and-publish.spec.ts`
  - Files: `tests/e2e/workspace-edit-and-publish.spec.ts`
  - Purpose: Protect the complete login, load, edit, preview, and publish journey.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `components/cms/CmsWorkspaceShell.tsx`, `worker/routes/publish.ts`_
  - _Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: E2E automation engineer | Task: add the primary happy-path browser test that covers login, workspace load, field editing, live preview confirmation, and successful publish metadata display | Restrictions: Do not mock away the entire app, keep selectors resilient, and target one representative end-to-end path instead of trying to cover every field here | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, components/cms/CmsWorkspaceShell.tsx, worker/routes/publish.ts | _Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5 | Success: one stable E2E happy path exists and can catch cross-layer regressions before release | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 7.2 Add E2E failure coverage in `tests/e2e/publish-conflict.spec.ts` and `tests/e2e/validation-errors.spec.ts`
  - Files: `tests/e2e/publish-conflict.spec.ts`, `tests/e2e/validation-errors.spec.ts`
  - Purpose: Protect the most important failure cases that tend to regress silently.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/requirements.md`, `components/cms/PublishDialog.tsx`, `components/preview/PreviewPane.tsx`_
  - _Requirements: Requirement 4, Requirement 5, Requirement 6, NFR Reliability_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: E2E automation engineer | Task: add browser-level failure scenarios for branch conflict recovery and invalid draft validation so the riskiest cross-layer regressions are caught in realistic flows | Restrictions: Do not turn these into brittle timing tests, keep each spec focused on one failure mode, and make assertions visible to maintainers rather than internal implementation details | _Leverage: .spec-workflow/specs/edu-publish-cms/requirements.md, components/cms/PublishDialog.tsx, components/preview/PreviewPane.tsx | _Requirements: Requirement 4, Requirement 5, Requirement 6, NFR Reliability | Success: the key failure paths are guarded by deterministic E2E coverage and can be re-run before merge or release | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 7.3 Add the developer workflow and debug runbook in `README.md` and `doc/development.md`
  - Files: `README.md`, `doc/development.md`
  - Purpose: Make the local dev, TDD, debug, and verification workflow discoverable outside chat history.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `.spec-workflow/specs/edu-publish-cms/requirements.md`_
  - _Requirements: NFR Testability and Developer Feedback_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Developer documentation engineer | Task: write the project-facing developer workflow and debugging runbook so local setup, TDD expectations, watch-mode loops, milestone gates, and failure triage steps are documented in the repository itself | Restrictions: Do not repeat the full spec verbatim, keep commands copy-pasteable, and make the runbook specific enough to reduce blind development for future contributors or agents | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, .spec-workflow/specs/edu-publish-cms/requirements.md | _Requirements: NFR Testability and Developer Feedback | Success: the repository has a concise but actionable developer runbook that mirrors the spec's development workflow expectations | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._

- [x] 7.4 Implement structured Worker request logging in `worker/lib/request-log.ts` and `worker/app.ts`
  - Files: `worker/lib/request-log.ts`, `worker/app.ts`
  - Purpose: Make publish, validation, and GitHub integration failures debuggable from real local CLI output.
  - _Leverage: `.spec-workflow/specs/edu-publish-cms/design.md`, `worker/routes/workspace.ts`, `worker/routes/publish.ts`_
  - _Requirements: Requirement 5, Requirement 6, NFR Testability and Developer Feedback, NFR Security_
  - _Prompt: Implement the task for spec edu-publish-cms, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Backend observability engineer | Task: add structured Worker-side request logging with requestId, repo, branch, base SHA, changed path count, GitHub status code, and latency so real CLI feedback exists for debugging without exposing secrets | Restrictions: Do not log access tokens, cookies, raw file bodies, or other sensitive data, keep the logging shape machine-readable, and integrate it centrally rather than duplicating logs in every route | _Leverage: .spec-workflow/specs/edu-publish-cms/design.md, worker/routes/workspace.ts, worker/routes/publish.ts | _Requirements: Requirement 5, Requirement 6, NFR Testability and Developer Feedback, NFR Security | Success: local Worker runs emit actionable structured logs for read, validate, and publish flows while preserving secret safety | Workflow: Before coding, edit tasks.md to mark this task as [-]. After implementation and verification, use log-implementation with detailed artifacts, then change the task to [x]._
