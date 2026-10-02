import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FindingSchema, type Finding } from "./types.js";

export async function knownIds(root: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let files: string[] = [];
  try {
    files = await readdir(root);
  } catch {
    return ids;
  }
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const finding = FindingSchema.parse(
      JSON.parse(await readFile(path.join(root, file), "utf8")),
    );
    ids.add(finding.id);
  }
  return ids;
}

export async function saveFindings(
  root: string,
  findings: Finding[],
): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const finding of findings) {
    await writeFile(
      path.join(root, `${finding.id}.json`),
      `${JSON.stringify(finding, null, 2)}\n`,
      { flag: "wx" },
    );
  }
}

export async function validateStore(root: string): Promise<number> {
  let files: string[] = [];
  try {
    files = await readdir(root);
  } catch {
    return 0;
  }
  const seen = new Set<string>();
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const finding = FindingSchema.parse(
      JSON.parse(await readFile(path.join(root, file), "utf8")),
    );
    if (`${finding.id}.json` !== file)
      throw new Error(`${file}: filename does not match finding id`);
    if (seen.has(finding.id)) throw new Error(`${file}: duplicate finding id`);
    seen.add(finding.id);
  }
  return seen.size;
}
