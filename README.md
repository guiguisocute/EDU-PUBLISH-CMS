# EDU-PUBLISH-CMS

EDU-PUBLISH-CMS is a browser-first editor for the current single-layer `content/card/**/*.md` EDU-PUBLISH content model.

The browser never talks to GitHub directly. It goes through the local Worker for session, repository, workspace, and publish operations.

## Start local development

Install dependencies:

```bash
pnpm install
```

Run the web app and Worker together:

```bash
pnpm run dev
```

This starts:

- Vite on `http://localhost:3000`
- Wrangler Worker on `http://localhost:8788`

## Use local GitHub OAuth

Create `.dev.vars` for local Worker secrets.

Use this callback URL in your GitHub OAuth app:

```text
http://localhost:8788/api/auth/github/callback
```

Keep the host consistent. If the browser starts on `localhost`, the callback should also use `localhost`, not `127.0.0.1`.

## Use the main verification commands

Run type checks:

```bash
pnpm run typecheck
```

Run unit tests:

```bash
pnpm run test:unit
```

Run integration tests:

```bash
pnpm run test:integration
```

Run Playwright E2E tests:

```bash
pnpm run test:e2e
```

Run the full local regression set:

```bash
pnpm run test
pnpm run build
```

## Use focused TDD loops

When you change one area, keep the feedback loop small.

Examples:

```bash
pnpm run test:unit -- cms
pnpm run test:unit -- preview
pnpm run test:integration -- auth-session
pnpm run test:integration -- repos-workspace
pnpm run test:integration -- publish
```

## Understand the main layers

- `worker/`: Worker routes and request handling.
- `lib/content/`: shared card parsing, serialization, preview compilation, and preview adaptation.
- `lib/github/`: GitHub read and write helpers.
- `hooks/`: browser draft workspace state.
- `components/cms/`: editor shell, repo selector, publish dialog, and diagnostics.
- `components/preview/`: preview pane and modal interactions.

## Read the development runbook

For the step-by-step workflow, debug checklist, and milestone gates, check out [`doc/development.md`](doc/development.md).
