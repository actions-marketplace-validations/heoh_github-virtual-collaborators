import { getOctokit } from "@actions/github";

export type Octokit = ReturnType<typeof getOctokit>;

//=============================================================================
// Projects v2
//=============================================================================

export interface ProjectInfo {
  projectId: string;
  fieldId: string;
}

/**
 * Looks up a Project v2 by owner (org or user) and returns its ID and the target text field ID.
 */
export async function getProjectInfo(
  octokit: Octokit,
  owner: string,
  projectNumber: number,
  tagsFieldName: string,
): Promise<ProjectInfo> {
  // Try org first; fall back to user if it fails
  let projectId: string | undefined;
  let fieldId: string | undefined;

  interface FieldNode {
    id: string;
    name: string;
  }
  interface ProjectV2Node {
    id: string;
    fields: { nodes: FieldNode[] };
  }

  const findField = (project: ProjectV2Node): string | undefined =>
    project.fields.nodes.find((n) => n.name === tagsFieldName)?.id;

  try {
    const result = await octokit.graphql<{
      organization?: { projectV2?: ProjectV2Node };
    }>(
      `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 50) {
              nodes { ... on ProjectV2FieldCommon { id name } }
            }
          }
        }
      }
    `,
      { owner, number: projectNumber },
    );

    const project = result.organization?.projectV2;
    if (project) {
      projectId = project.id;
      fieldId = findField(project);
    }
  } catch {
    // org lookup failed — retry as user
  }

  if (!projectId) {
    const result = await octokit.graphql<{
      user?: { projectV2?: ProjectV2Node };
    }>(
      `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 50) {
              nodes { ... on ProjectV2FieldCommon { id name } }
            }
          }
        }
      }
    `,
      { owner, number: projectNumber },
    );

    const project = result.user?.projectV2;
    if (!project)
      throw new Error(
        `Project #${projectNumber} not found for owner '${owner}'`,
      );

    projectId = project.id;
    fieldId = findField(project);
  }

  if (!fieldId) {
    throw new Error(
      `Tags field '${tagsFieldName}' not found in project #${projectNumber}`,
    );
  }

  return { projectId, fieldId: fieldId as string };
}

export interface ProjectItemInfo {
  itemId: string;
  tagsRaw: string;
}

/**
 * Looks up a Project item by content node ID (Issue or PR) and returns its item ID and raw tags field value.
 * Creates a new item if not found.
 */
export async function getOrCreateProjectItem(
  octokit: Octokit,
  projectId: string,
  contentNodeId: string,
): Promise<string> {
  const res = await octokit.graphql<{
    addProjectV2ItemById: { item: { id: string } };
  }>(
    `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
    `,
    { projectId, contentId: contentNodeId },
  );

  return res.addProjectV2ItemById.item.id;
}

/**
 * Retrieves the raw text value of a text field on a Project item.
 * Returns an empty string if the field is not set.
 */
export async function getProjectItemTextFieldByName(
  octokit: Octokit,
  itemId: string,
  fieldName: string,
): Promise<string> {
  const res = await octokit.graphql<{
    node: {
      fieldValueByName?: { text?: string } | null;
    } | null;
  }>(
    `
    query($itemId: ID!, $fieldName: String!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          fieldValueByName(name: $fieldName) {
            ... on ProjectV2ItemFieldTextValue { text }
          }
        }
      }
    }
    `,
    { itemId, fieldName },
  );

  return res.node?.fieldValueByName?.text ?? "";
}

/**
 * Updates a text field value on a Project item.
 */
export async function updateTextField(
  octokit: Octokit,
  projectId: string,
  itemId: string,
  fieldId: string,
  value: string,
): Promise<void> {
  await octokit.graphql<{
    updateProjectV2ItemFieldValue: { projectV2Item: { id: string } };
  }>(
    `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { text: $value }
      }) { projectV2Item { id } }
    }
  `,
    { projectId, itemId, fieldId, value },
  );
}

/**
 * Resolves the node ID for an Issue by its number.
 */
export async function getIssueNodeId(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string> {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return data.node_id;
}

/**
 * Resolves the node ID for a PR by its number.
 */
export async function getPRNodeId(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data.node_id;
}

//=============================================================================
// Notification Issues
//=============================================================================

/**
 * Searches for a `[VC:notifications] @#name` Issue by title.
 * Returns null if not found.
 */
export async function findNotificationIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
): Promise<number | null> {
  // Use the search API for exact title matching
  // order by created date asc to find the oldest matching issue (in case of duplicates)
  const query = `repo:${owner}/${repo} in:title "${title}" is:issue`;
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: query,
    per_page: 5,
    sort: "created",
    order: "asc",
  });
  const found = data.items.find((i) => i.title === title);
  return found ? found.number : null;
}

/**
 * Creates the VC-dedicated Notification Issue and returns its number.
 */
export async function createNotificationIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  vcName: string,
): Promise<number> {
  const body =
    `This Issue is the dedicated notification inbox for **\`@#${vcName}\`**.\n\n` +
    `It was created automatically by the GitHub Virtual Collaborators Action.\n` +
    `Delete confirmed notification comments to keep the inbox tidy.`;

  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    state: "closed",
  } as Parameters<typeof octokit.rest.issues.create>[0]);

  // Close the issue after creation
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: data.number,
    state: "closed",
  });

  return data.number;
}

/**
 * Adds a comment to the specified Issue.
 */
export async function createIssueComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

/**
 * Deletes the specified comment.
 */
export async function deleteIssueComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
): Promise<void> {
  await octokit.rest.issues.deleteComment({
    owner,
    repo,
    comment_id: commentId,
  });
}

//=============================================================================
// Check Runs
//=============================================================================

/**
 * Finds the PR number associated with the given head SHA.
 * Returns null if no PR is found.
 */
export async function getPRNumberForCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
): Promise<number | null> {
  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:${headSha}`,
    per_page: 1,
  });

  if (data.length > 0) return data[0].number;

  // Also check closed PRs
  const { data: closed } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "closed",
    head: `${owner}:${headSha}`,
    per_page: 1,
  });

  return closed.length > 0 ? closed[0].number : null;
}
