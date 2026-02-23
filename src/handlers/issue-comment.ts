import * as core from "@actions/core";
import {
  extractTagByType,
  extractTagsByType,
  isNotifiableTags,
  updateTagStoreByIssue,
} from "../core/tag-util";
import { getContext } from "../context";
import { getTagStore, getNotifier } from "./shared";

export async function handleIssueComment(): Promise<void> {
  const ctx = getContext();

  const { action, issue, comment } = ctx.payload;
  if (!action) {
    core.warning("issue_comment: missing action");
    return;
  }
  if (!issue) {
    core.warning("issue_comment: missing issue");
    return;
  }
  if (!comment) {
    core.warning("issue_comment: missing comment");
    return;
  }

  core.info(`handleIssueComment: action=${action}, issue=#${issue.number}, comment=${comment.id}`);

  const tagStore = getTagStore();

  let isAuthoringAction = false;
  if (action === "created" || action === "edited") {
    isAuthoringAction = true;
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
    const watchers = extractTagsByType(tags, "watcher");
    const notifier = getNotifier(tagStore);
    const author = extractTagByType(tags, "author");
    for (const watcher of watchers) {
      // Skip notifying the authoring user to avoid redundant notifications.
      if (isAuthoringAction && watcher === author) {
        continue;
      }
      await notifier.notify(watcher, {
        event: `comment_${action}`,
        issue: `${issue.title}  (#${issue.number})`,
        comment_id: comment.id,
      });
    }
  }
}
