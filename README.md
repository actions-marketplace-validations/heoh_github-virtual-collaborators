# GitHub Virtual Collaborators

GitHub Action that helps virtual collaborators (VCs) communicate across Issues and Pull Requests using `@#name` mentions and lightweight slash commands.

It parses issue/PR/comment content, updates VC metadata in GitHub Projects v2 (as tags), and sends notifications to each VC’s dedicated notification inbox issue.

---

## Features

- Parses VC syntax in Issues/PRs/comments (`@#name`, `/assign`, `/unassign`, `/watch`, `/unwatch`).
- Persists collaboration metadata to Project v2 text field (`author`, `participant`, `assignee` in `Tags`).
- Emits VC-scoped notifications to dedicated inbox issues (`[VC:notifications] @#<name>`).
- Handles `issues`, `issue_comment`, `pull_request`, and `check_run` events with one workflow.

---

## Quick Start

Create `.github/workflows/virtual-collaborators.yml`:

```yaml
name: Virtual Collaborators

on:
  issues:
    types: [opened, edited, closed, reopened]
  issue_comment:
    types: [created, edited]
  pull_request:
    types: [opened, edited, closed, reopened, synchronize]
  check_run:
    types: [completed]

permissions:
  issues: write
  contents: read

jobs:
  virtual-collaborators:
    runs-on: ubuntu-latest
    steps:
      - uses: heoh/github-virtual-collaborators@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          project-owner: org-or-user    # Replace with your Project owner
          project-number: 1             # Replace with your Project number
          tags-field-name: Tags         # Replace with your text field name
```

Requirements:

- Create a **Project v2** with a text field named `Tags`.
- Add a PAT to repository secret `PROJECT_TOKEN` (scopes: `repo`, `project`).

Then test in an Issue/PR body:

```md
###### authored by @#alice
/assign @#bob
Please review this @#carol
```

### Verify It Works (VC quick checks)

- Check assignee items in Project view:
  - `Tags:"* assignee:bob *"`
- Find a VC notification inbox issue by title (include closed issues in search):
  - `is:issue is:closed in:title "[VC:notifications] @#carol"`

---

## Inputs

Defined in `action.yml`:

- **`github-token`** (required)
  - PAT with `repo` and `project` scopes
  - `GITHUB_TOKEN` is not enough for Projects v2 write operations
- **`project-owner`** (required)
  - Org/user that owns the target Project
- **`project-number`** (required)
  - Project v2 number
- **`tags-field-name`** (required, default: `Tags`)
  - Name of the Project custom text field used to store tags
- **`virtual-collaborators`** (optional, default: empty)
  - Comma-separated allow-list (without `@#`)
  - Example: `agent-alice, reviewer-bot, qa-carol`

---

## Required Setup

1. Create a **Project v2** with **custom text field** (e.g., `Tags`).
2. Create a repository secret named **`PROJECT_TOKEN`**.
3. Use a PAT for `PROJECT_TOKEN` with scopes:
   - `repo`
   - `project`

---

## Usage

For advanced configuration and behavior details:

- Inputs reference: [Inputs](#inputs)
- Collaboration syntax: [VC Syntax](#vc-syntax)
- Metadata model and filtering: [Tag Model](#tag-model)
- Notification behavior: [Notifications](#notifications)

Optional allow-list example:

```yaml
      - uses: heoh/github-virtual-collaborators@v1
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          project-owner: org-or-user
          project-number: 1
          tags-field-name: Tags
          virtual-collaborators: alice, bob, carol
```

---

## Security & Permissions

- Store tokens only in GitHub Secrets (never hardcode tokens in workflow YAML).
- Prefer a dedicated bot/service account token for operational stability.
- Follow least-privilege: grant only the minimum scopes required.

This action updates Projects v2 metadata. In many environments, `GITHUB_TOKEN` is not sufficient for Projects v2 write operations, so a PAT may be required.

### Why not only `GITHUB_TOKEN`?

`GITHUB_TOKEN` often lacks Projects v2 write permission depending on repository and organization policies. If metadata updates fail, switch to a PAT-based secret.

### Permission Troubleshooting

If tag updates or notifications fail, check the following:

1. `PROJECT_TOKEN` exists and is valid (not expired/revoked).
2. Token scopes include required access (`repo`, `project`).
3. `project-owner` and `project-number` point to the intended Project v2.
4. `tags-field-name` exactly matches an existing text field in the target project.

---

## VC Syntax

### Header

Use at the top of content:

```md
###### authored by @#alice
```

### Commands

Use at the beginning of a line:

```md
/assign @#bob
/unassign
/watch
/unwatch
```

### Mentions

Mention a VC anywhere in text:

```md
Please review this, @#carol
```

---

## Tag Model

Tags are stored as `key:value` pairs in your Project’s text field.

- `author:<vc-name>`
- `participant:<vc-name>`
- `assignee:<vc-name>`

> Note: the runtime may also use internal helper tags for watch-state handling.

### Filtering in GitHub Project Views

You can filter items by tag values in the Project view search bar.

- Example filter (items authored by `alice`):
  - `Tags:"* author:alice *"`

You can apply the same pattern for other tag types, for example:

- `Tags:"* participant:carol *"`
- `Tags:"* assignee:bob *"`

---

## Notifications

For each VC, the action uses a dedicated issue:

- Title: `[VC:notifications] @#<vc-name>`
- The inbox issue can be managed as **closed** state. If you cannot find it, search including closed issues.
  - Example: `is:issue is:closed in:title "[VC:notifications] @#carol"`

When a relevant event occurs, the action posts a comment in that VC’s notification issue.

---

## How It Works

1. An Issue/PR/Comment/Check Run event is triggered.
2. The action parses VC-related syntax (header, commands, mentions).
3. It reads/writes tags in the metadata storage (GitHub Project v2 item).
4. It determines who should be notified.
5. It creates (if needed) and comments on each VC’s notification issue.

---

## Release (Maintainers)

This repository includes a manual release workflow:

- Workflow: `.github/workflows/release.yml`
- Trigger: **Actions → Release → Run workflow**
- Input: `version` (SemVer without `v`, e.g., `1.2.3`)

What it does:

1. Validates input and ensures the run is on `main`.
2. Updates `package.json`/`package-lock.json` version.
3. Runs lint, test, and build.
4. Commits release artifacts (`dist`, `package.json`, `package-lock.json`) to `main`.
5. Creates `vX.Y.Z` tag and force-updates matching major tag (`vX`) to the same release commit.

---

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

---

## Notes

- This action is designed for repositories that use GitHub Projects v2 for metadata tracking.
- Behavior is implementation-driven; when in doubt, check `src/core/tag-util.ts` and handlers under `src/handlers/`.

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
