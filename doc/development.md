# Development workflow

Use this runbook when you need to develop, debug, or verify the CMS locally.

## Start with the normal loop

Install once:

```bash
pnpm install
```

Run the full local app:

```bash
pnpm run dev
```

Use the split commands when you only need one side:

```bash
pnpm run dev:web
pnpm run dev:worker
```

## Pick the smallest useful test loop

Use focused commands while you work:

```bash
pnpm run test:unit -- cms
pnpm run test:unit -- preview
pnpm run test:integration -- auth-session
pnpm run test:integration -- repos-workspace
pnpm run test:integration -- publish
```

Use these when you need broader confidence:

```bash
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run typecheck
pnpm run build
```

## Follow the edit flow

1. Load a repository and branch through the Worker-backed repo selector.
2. Load the draft workspace.
3. Edit card fields or markdown body.
4. Check inline validation and the live preview.
5. Open **Review Publish** only after the draft is clean enough to publish.

## Use diagnostics while developing

In development mode, the CMS shell shows a diagnostics panel with:

- selected card id
- dirty file count
- base head SHA
- compile duration
- validation issue count

Use that panel when the preview looks stale or when you want to confirm the workspace state changed the way you expected.

## Debug Worker flows from CLI output

The Worker now logs structured request start and end events.

Look for:

- `requestId`
- request `path`
- repo and branch context
- `baseHeadSha`
- changed path count
- response status
- latency

This is the fastest way to confirm whether a failure happened in session bootstrap, workspace hydration, or publish.

## Debug common failures

### If repo loading fails

Run:

```bash
pnpm run test:integration -- repos-workspace
```

Then check the Worker log output for the repo, branch, and response status.

### If preview looks wrong

Run:

```bash
pnpm run test:unit -- preview
```

Then check:

- preview compiler issues
- diagnostics compile timing
- whether the edited card is marked dirty

### If publish fails

Run:

```bash
pnpm run test:integration -- publish
```

Then confirm:

- target branch
- base head SHA
- changed path count
- returned error message

If the error is a branch conflict, reload the workspace before trying again.

## Use the milestone gates

Before wrapping up a larger slice, run the matching focused gate and then the broader safety net.

The practical final gate is:

```bash
pnpm run typecheck
pnpm run test
pnpm run test:e2e
pnpm run build
```

That gives you type safety, unit and integration coverage, browser-path coverage, and a production build check in one pass.
