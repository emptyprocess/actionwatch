import path from "node:path";
import { analyzeWorkflow } from "./analyze.js";
import { GitHubClient } from "./github.js";
import { knownIds, saveFindings, validateStore } from "./store.js";

const command = process.argv[2];
const findingsDir = path.resolve(process.env.FINDINGS_DIR ?? "findings");

async function scan(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const limit = Math.min(Number(process.env.MAX_NEW_FINDINGS ?? 50), 50);
  const maxRepositories = Math.min(
    Number(process.env.MAX_REPOSITORIES ?? 100),
    100,
  );
  const since =
    process.env.PUSHED_SINCE ??
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const client = new GitHubClient(token);
  const known = await knownIds(findingsDir);
  const fresh = [];
  for (const repository of await client.discoverRepositories(
    since,
    maxRepositories,
  )) {
    try {
      for (const workflow of await client.workflows(repository)) {
        for (const finding of analyzeWorkflow(workflow)) {
          if (!known.has(finding.id)) {
            known.add(finding.id);
            fresh.push(finding);
            if (fresh.length >= limit) break;
          }
        }
        if (fresh.length >= limit) break;
      }
    } catch (error) {
      console.warn(
        `Skipping ${repository.full_name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (fresh.length >= limit) break;
  }
  await saveFindings(findingsDir, fresh);
  console.log(
    JSON.stringify({
      repositoriesConsidered: maxRepositories,
      newFindings: fresh.length,
      limit,
    }),
  );
}

if (command === "scan") await scan();
else if (command === "validate")
  console.log(`Validated ${await validateStore(findingsDir)} findings.`);
else throw new Error("Usage: actionwatch <scan|validate>");
