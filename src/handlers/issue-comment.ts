import * as core from "@actions/core";
import {
  extractTagByType,
  extractTagsByType,
  isNotifiableTags,
  updateTagStoreByContent,
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

  core.info(
    `handleIssueComment: action=${action}, issue=#${issue.number}, comment=${comment.id}`,
  );

  const tagStore = getTagStore();

  let author: string | null = null;
  if (action === "created" || action === "edited") {
    const result = await updateTagStoreByContent(
      tagStore,
      issue.number,
      "",
      comment.body ?? "",
      true,
    );
    author = result.author;
    await tagStore.commit();
  }

  const tags = await tagStore.getTags(issue.number);
  if (isNotifiableTags(tags)) {
    const watchers = extractTagsByType(tags, "watcher");
    const notifier = getNotifier(tagStore);
    for (const watcher of watchers) {
      // Skip notifying the authoring user to avoid redundant notifications.
      if (watcher === author) {
        continue;
      }
      await notifier.notify(watcher, {
        event: `\`issue_${action}\``,
        issue: `\`#${issue.number}\`  ${issue.title}`,
        comment_id: comment.id,
      });
    }
  }
}
