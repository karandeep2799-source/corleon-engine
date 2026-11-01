export interface GitHubFileDocument {
  externalId: string;
  title: string;
  canonicalUrl: string;
  content: string;
  contentMode: "FULL_TEXT";
  metadata: Record<string, unknown>;
}

export async function fetchGitHubTextFile(input: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  token: string;
  allowedRepositories: string[];
  fetchImpl?: typeof fetch;
}): Promise<GitHubFileDocument> {
  const repository = `${input.owner}/${input.repo}`;
  if (!input.allowedRepositories.includes(repository)) throw new Error("GitHub repository is not allowlisted.");
  if (!input.token.trim()) throw new Error("A GitHub token is required.");
  if (input.path.startsWith("/") || input.path.split("/").includes("..")) throw new Error("Invalid repository path.");
  const url = new URL(`https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`);
  if (input.ref) url.searchParams.set("ref", input.ref);
  const response = await (input.fetchImpl ?? fetch)(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${input.token}`,
      "x-github-api-version": "2022-11-28",
    },
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`GitHub contents API returned HTTP ${response.status}.`);
  const file = await response.json() as { type?: string; encoding?: string; content?: string; path?: string; sha?: string; html_url?: string; size?: number };
  if (file.type !== "file" || file.encoding !== "base64" || !file.content) throw new Error("GitHub path is not a supported text file.");
  if ((file.size ?? 0) > 1_000_000) throw new Error("GitHub file exceeds the 1 MB ingestion limit.");
  const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  if (content.includes("\u0000")) throw new Error("Binary GitHub files are not supported.");
  return {
    externalId: file.sha ?? `${repository}:${file.path ?? input.path}`,
    title: file.path ?? input.path,
    canonicalUrl: file.html_url ?? `https://github.com/${repository}/blob/${input.ref ?? "HEAD"}/${input.path}`,
    content,
    contentMode: "FULL_TEXT",
    metadata: { repository, path: file.path ?? input.path, ref: input.ref ?? "default", blobSha: file.sha },
  };
}
