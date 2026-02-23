export interface TagStore {
  setTags(issueNumber: number, tags: string[]): TagStore;
  addTags(issueNumber: number, tags: string[]): TagStore;
  removeTags(issueNumber: number, tags: string[]): TagStore;
  removeTypes(issueNumber: number, types: string[]): TagStore;
  getTags(issueNumber: number): Promise<string[]>;
  commit(): Promise<void>;
}
