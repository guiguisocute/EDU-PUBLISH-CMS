# Use Worker-Mediated GitHub OAuth and Repo Loading

This note explains how the CMS will handle the step after GitHub OAuth: selecting a repository, reading its branch content, and creating a browser draft workspace.

## Use the Worker as the only GitHub client

The browser should never call GitHub directly with an access token.

The flow is:

1. The browser starts GitHub OAuth through the Worker.
2. The Worker completes the OAuth callback and exchanges the code for a GitHub access token.
3. The Worker stores the token in a Worker-managed secure session.
4. The browser only talks to CMS endpoints such as `/api/session`, `/api/repos`, and `/api/workspace/load`.

This keeps the token out of browser JavaScript and gives the Worker full control over path allowlists, branch checks, and audit logging.

## OAuth flow

### 1. Start login

The browser hits:

```text
GET /api/auth/github/start
```

The Worker will:

- generate `state`
- generate PKCE `code_verifier` and `code_challenge`
- store the temporary auth state in a short-lived secure cookie
- redirect the browser to GitHub's OAuth authorize URL

### 2. Complete callback

GitHub redirects back to:

```text
GET /api/auth/github/callback?code=...&state=...
```

The Worker will:

- validate `state`
- exchange `code` plus `code_verifier` for an access token
- fetch the current GitHub user
- create an encrypted HttpOnly session cookie
- redirect back to the CMS app

### 3. Read session state

The browser uses:

```text
GET /api/session
```

The Worker returns only safe session data, for example:

```json
{
  "authenticated": true,
  "viewer": {
    "login": "octocat",
    "name": "The Maintainer",
    "avatarUrl": "https://..."
  }
}
```

It does not return the GitHub token.

## Repository selection

After login, the browser asks the Worker for available repositories.

### Endpoint

```text
GET /api/repos
```

### Worker behavior

The Worker calls GitHub on behalf of the user, typically starting with:

```text
GET /user/repos
```

The Worker should:

- page through results
- sort by recent activity
- return only fields the UI needs for selection
- keep the full raw GitHub payload out of the browser

Suggested browser payload:

```json
{
  "repos": [
    {
      "owner": "octocat",
      "name": "edu-publish-campus-a",
      "fullName": "octocat/edu-publish-campus-a",
      "defaultBranch": "main",
      "private": false,
      "permissions": {
        "admin": false,
        "maintain": false,
        "push": true,
        "triage": false,
        "pull": true
      },
      "updatedAt": "2026-04-14T12:00:00Z"
    }
  ]
}
```

## Branch selection

After the maintainer picks a repository, the browser asks for branches.

### Endpoint

```text
GET /api/repos/:owner/:repo/branches
```

### Worker behavior

The Worker calls GitHub to list branches and returns a reduced payload such as:

```json
{
  "branches": [
    {
      "name": "main",
      "headSha": "abc123..."
    },
    {
      "name": "cms/draft-notices",
      "headSha": "def456..."
    }
  ]
}
```

The browser should not guess the branch head by itself. The Worker is the source of truth for `headSha`.

## Load a repository workspace

After repo and branch are selected, the browser asks the Worker to hydrate the draft workspace.

### Endpoint

```text
POST /api/workspace/load
```

Suggested request body:

```json
{
  "repo": {
    "owner": "octocat",
    "name": "edu-publish-campus-a"
  },
  "branch": "main"
}
```

### Worker read path

The Worker should load the workspace in this order:

1. Read the branch ref and record `baseHeadSha`.
2. Read the branch tree recursively.
3. Verify repository compatibility.
4. Filter only the files the CMS is allowed to read for this phase.
5. Fetch blob contents for the selected Markdown and YAML files.
6. Return the draft workspace payload to the browser.

### GitHub calls

The Worker should use Git database APIs, not ad hoc browser-side file fetching.

Recommended sequence:

1. Get branch ref

```text
GET /repos/{owner}/{repo}/git/ref/heads/{branch}
```

2. Get the repository tree for that commit or tree SHA

```text
GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1
```

3. Filter paths to the CMS-safe read set:

- `content/card/**/*.md`
- `content/attachments/**`
- `config/site.yaml`
- `config/widgets.yaml`
- `config/subscriptions.yaml`

4. Fetch each needed blob

```text
GET /repos/{owner}/{repo}/git/blobs/{sha}
```

GitHub returns blob content as base64, so the Worker should decode it before sending text files to the browser.

## Repository compatibility check

The Worker should block unsupported repositories before the browser enters the editor.

The minimum check for this project phase is:

- `content/card/` exists
- `config/site.yaml` exists
- `config/widgets.yaml` exists
- `config/subscriptions.yaml` exists

If the repo is incompatible, return a structured error like:

```json
{
  "compatible": false,
  "issues": [
    {
      "path": "config/widgets.yaml",
      "message": "Missing required file"
    }
  ]
}
```

## Browser workspace payload

The Worker should return enough data for the browser to edit locally without re-reading GitHub on every keystroke.

Suggested response shape:

```json
{
  "repo": {
    "owner": "octocat",
    "name": "edu-publish-campus-a"
  },
  "branch": "main",
  "baseHeadSha": "abc123...",
  "cards": [
    {
      "path": "content/card/campus/demo.md",
      "sha": "blobsha123",
      "raw": "---\nid: demo\n..."
    }
  ],
  "readonlyConfig": {
    "siteYaml": "site_name: ...",
    "widgetsYaml": "modules: ...",
    "subscriptionsYaml": "schools: ..."
  },
  "attachments": [
    {
      "path": "content/attachments/example.pdf",
      "sha": "blobsha456",
      "size": 102400
    }
  ]
}
```

The browser can then:

- parse cards into editable draft state
- compile local preview data on every edit
- keep `baseHeadSha` for later publish conflict detection

## Why this shape works well

This approach keeps the system simple and safe:

- GitHub OAuth and GitHub token handling stay in the Worker.
- The browser only receives reduced repo metadata and workspace content.
- The browser can edit and preview locally without extra network calls on every change.
- The Worker remains the only place that can enforce compatibility checks, path allowlists, branch-head checks, and publish safety.

## Later publish tie-in

This read path is also what makes publish safe later.

Because the Worker captured `baseHeadSha` during `workspace/load`, publish can later reject stale workspaces if the branch has moved since the editor loaded.

That means the read path is not just data loading. It is also the start of the optimistic concurrency model for safe GitHub writes.
