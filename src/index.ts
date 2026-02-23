import * as core from "@actions/core";
import { getContext } from "./context";
import { handleIssues } from "./handlers/issues";

async function run(): Promise<void> {
  const ctx = getContext();
  switch (ctx.eventName) {
    case "issues":
      await handleIssues();
      break;

    default:
      core.warning(`Unsupported event: ${ctx.eventName}`);
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
