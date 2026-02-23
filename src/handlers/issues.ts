import * as core from "@actions/core";
import {
  extractWatchers,
  isNotifiableTags,
  updateTagStoreByIssue,
} from "../core/tag-util";
import { getContext } from "../context";
import { getTagStore, getNotifier } from "./shared";

export async function handleIssues(): Promise<void> {
  const ctx = getContext();

  const { action, issue } = ctx.payload;
  if (!action) {
    core.warning("issues: missing action");
    return;
  }
  if (!issue) {
    core.warning("issues: missing issue");
    return;
  }

  core.info(`handleIssues: action=${action}, issue=#${issue.number}`);

  const tagStore = getTagStore();

  if (action === "opened" || action === "edited") {
    await updateTagStoreByIssue(
      tagStore,
      issue.number,
      issue.title,
      issue.body || "",
    );
    await tagStore.commit();
  }

  const tags = await tagStore.getTags(issue.number);
  if (isNotifiableTags(tags)) {
    const watchers = extractWatchers(tags);
    const notifier = getNotifier(tagStore);
    for (const watcher of watchers) {
      await notifier.notify(watcher, {
        event: `issue_${action}`,
        issue: `${issue.title}  (#${issue.number})`,
      });
    }
  }
}
