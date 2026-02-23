import * as core from "@actions/core";
import {
  isNotifiableTags,
  updateTagStoreByContent,
  getWatchingVCNames,
  extractValueByType,
} from "../core/tag-util";
import { getContext } from "../context";
import { getTagStore, getNotifier } from "./shared";
import { NotificationPayload } from "../core/notification-provider";

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

  let author: string | null = null;
  let mentions: string[] = [];
  if (action === "opened" || action === "edited") {
    const result = await updateTagStoreByContent(
      tagStore,
      issue.number,
      issue.title,
      issue.body ?? "",
    );
    author = result.author;
    mentions = result.mentions;
    await tagStore.commit();
  }

  const tags = await tagStore.getTags(issue.number);
  if (isNotifiableTags(tags)) {
    const assignee = extractValueByType(tags, "assignee");
    const watchers = getWatchingVCNames(tags);
    const notifier = getNotifier(tagStore);
    for (const watcher of watchers) {
      // Skip notifying the authoring user to avoid redundant notifications.
      if (watcher === author) {
        continue;
      }

      const payload: NotificationPayload = {};
      payload["event"] = `\`issue_${action}\``;
      payload["issue"] = `\`#${issue.number}\`  ${issue.title}`;
      if (mentions.includes(watcher)) payload["mention"] = true;
      if (watcher === assignee) payload["assignee"] = true;
      await notifier.notify(watcher, payload);
    }
  }
}
