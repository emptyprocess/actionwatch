import type { WorkflowInput } from "./types.js";

interface SearchItem {
  full_name: string;
  default_branch: string;
}
interface TreeItem {
  path?: string;
  type?: string;
}

export class GitHubClient {
  constructor(private readonly token: string) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "actionwatch/0.1",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok)
      throw new Error(
        `GitHub API ${response.status}: ${await response.text()}`,
      );
    return (await response.json()) as T;
  }

  async discoverRepositories(
    since: string,
    maxRepositories: number,
  ): Promise<SearchItem[]> {
    const query = encodeURIComponent(
      `is:public archived:false fork:false pushed:>=${since}`,
    );
    const data = await this.request<{ items: SearchItem[] }>(
      `/search/repositories?q=${query}&sort=updated&order=desc&per_page=${Math.min(maxRepositories, 100)}`,
    );
    return data.items.slice(0, maxRepositories);
  }

  async workflows(repo: SearchItem): Promise<WorkflowInput[]> {
    const ref = encodeURIComponent(repo.default_branch);
    const branch = await this.request<{ commit: { sha: string } }>(
      `/repos/${repo.full_name}/branches/${ref}`,
    );
    const tree = await this.request<{ tree: TreeItem[] }>(
      `/repos/${repo.full_name}/git/trees/${branch.commit.sha}?recursive=1`,
    );
    const paths = tree.tree
      .filter(
        (item) =>
          item.type === "blob" &&
          /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(item.path ?? ""),
      )
      .map((item) => item.path as string)
      .slice(0, 20);
    const results: WorkflowInput[] = [];
    for (const path of paths) {
      const file = await this.request<{ content: string; encoding: string }>(
        `/repos/${repo.full_name}/contents/${encodeURIComponent(path)}?ref=${branch.commit.sha}`,
      );
      if (file.encoding !== "base64") continue;
      results.push({
        repository: repo.full_name,
        defaultBranch: repo.default_branch,
        commitSha: branch.commit.sha,
        workflow: path,
        content: Buffer.from(
          file.content.replace(/\n/g, ""),
          "base64",
        ).toString("utf8"),
      });
    }
    return results;
  }
}
