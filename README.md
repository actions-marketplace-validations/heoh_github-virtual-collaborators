# GitHub Virtual Collaborators

GitHub Action that helps virtual collaborators (VCs) communicate across Issues and Pull Requests using `@#name` mentions and lightweight slash commands.

It parses issue/PR/comment content, updates VC metadata in GitHub Projects v2 (as tags), and sends notifications to each VC’s dedicated notification inbox issue.

---

## Features

- Detects VC mentions in the form `@#<vc-name>`
- Supports collaboration commands in content:
  - `/assign @#<vc-name>`
  - `/unassign`
  - `/watch`
  - `/unwatch`
- Stores collaboration metadata in a Projects v2 text field (default: `Tags`)
- Sends notifications to VC-specific inbox issues:
  - `[VC:notifications] @#<vc-name>`
- Handles repository events:
  - `issues` (`opened`, `edited`, `closed`, `reopened`)
  - `issue_comment` (`created`, `edited`)
  - `pull_request` (`opened`, `edited`, `closed`, `reopened`, `synchronize`)
  - `check_run` (`completed`)

---

## How It Works

1. An Issue/PR/Comment/Check Run event is triggered.
2. The action parses VC-related syntax (header, commands, mentions).
3. It reads/writes tags in the metadata storage (GitHub Project v2 item).
4. It determines who should be notified.
5. It creates (if needed) and comments on each VC’s notification issue.

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
      - uses: heoh/github-virtual-collaborators@main
        with:
          github-token: ${{ secrets.PROJECT_TOKEN }}
          project-owner: org                              # Edit here
          project-number: 1                               # Edit here
          tags-field-name: Tags                           # Edit here
          # virtual-collaborators: alice, bob, carol      # Optional
```

---

## Notifications

For each VC, the action uses a dedicated issue:

- Title: `[VC:notifications] @#<vc-name>`

When a relevant event occurs, the action posts a comment in that VC’s notification issue.

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
