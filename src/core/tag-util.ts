import { TagStore } from "./tag-store";

export async function updateTagStoreByContent(
  tagStore: TagStore,
  issueNumber: number,
  title: string,
  body: string,
  isComment = false,
): Promise<{ author: string | null }> {
  // Process Headers
  let author: string | null = null;
  const headerRegex = /^(?:\s*\n)?######\s+authored\s+by\s+@#([\w-]+)/i;
  const headerMatch = body.match(headerRegex);
  if (headerMatch) {
    author = headerMatch[1];
    if (!isComment) {
      // For issue bodies, set the author tag based on the header.
      tagStore.removeTypes(issueNumber, ["author"]);
      tagStore.addTags(issueNumber, [
        `author:${author}`,
        `participant:${author}`,
      ]);
    }
  }

  // Process Commands
  const commandRegex = /^\/(\w+)(?:\s.*)?$/gm;
  let commandMatch;
  while ((commandMatch = commandRegex.exec(body)) !== null) {
    const command = commandMatch[1];
    const args = commandMatch[0].split(" ").slice(1);
    await processCommand(tagStore, issueNumber, command, args, author);
  }

  // Process Mentions
  const mentionRegex = /@#([\w-]+)/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(body)) !== null) {
    const mentionedName = mentionMatch[1];
    tagStore.addTags(issueNumber, [
      `watcher:${mentionedName}`,
      `participant:${mentionedName}`,
    ]);
  }

  return { author };
}

async function processCommand(
  tagStore: TagStore,
  issueNumber: number,
  command: string,
  args: string[],
  author: string | null,
): Promise<void> {
  if (command === "assign") {
    if (args.length === 1) {
      const mentionRegex = /^@#([\w-]+)$/;
      const assigneeMatch = args[0].match(mentionRegex);
      if (assigneeMatch) {
        const assignee = assigneeMatch[1];
        tagStore.removeTypes(issueNumber, ["assignee"]);
        tagStore.addTags(issueNumber, [
          `assignee:${assignee}`,
          `participant:${assignee}`,
        ]);
      }
    }
  } else if (command === "unassign") {
    tagStore.removeTypes(issueNumber, ["assignee"]);
  } else if (command === "watch") {
    if (author) {
      tagStore.addTags(issueNumber, [
        `watcher:${author}`,
        `participant:${author}`,
      ]);
    }
  } else if (command === "unwatch") {
    if (author) {
      tagStore.removeTags(issueNumber, [`watcher:${author}`]);
    }
  }
}

export function isNotifiableTags(tags: string[]): boolean {
  return !tags.includes("system:quiet");
}

export function extractTagsByType(tags: string[], type: string): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    if (tag.startsWith(`${type}:`)) {
      result.push(tag.substring(`${type}:`.length));
    }
  }
  return result;
}

export function extractTagByType(tags: string[], type: string): string | null {
  const result = extractTagsByType(tags, type);
  return result.length > 0 ? result[0] : null;
}
