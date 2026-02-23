import * as core from "@actions/core";
import { getContext } from "./context";
import { handleIssues } from "./handlers/issues";
import { handleIssueComment } from "./handlers/issue-comment";
import { handlePullRequest } from "./handlers/pull-request";

async function run(): Promise<void> {
  const ctx = getContext();
  switch (ctx.eventName) {
    case "issues":
      await handleIssues();
      break;

    case "issue_comment":
      await handleIssueComment();
      break;

    case "pull_request":
      await handlePullRequest();
      break;

    default:
      core.warning(`Unsupported event: ${ctx.eventName}`);
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
