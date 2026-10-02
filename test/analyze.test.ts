import { describe, expect, it } from "vitest";
import { analyzeWorkflow } from "../src/analyze.js";

const base = {
  repository: "owner/repo",
  defaultBranch: "main",
  commitSha: "a".repeat(40),
  workflow: ".github/workflows/ci.yml",
};

describe("analyzeWorkflow", () => {
  it("finds mutable, outdated, and broad permission usage", () => {
    const content = `permissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v3\n`;
    const findings = analyzeWorkflow(
      { ...base, content },
      "2026-10-02T00:00:00.000Z",
    );
    expect(findings.map((f) => f.finding)).toEqual([
      "mutable-action-ref",
      "outdated-action-version",
      "overly-broad-permissions",
    ]);
  });

  it("does not flag a pinned current action", () => {
    const content = `permissions: read-all\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@${"b".repeat(40)}\n`;
    expect(analyzeWorkflow({ ...base, content })).toEqual([]);
  });

  it("produces stable ids independent of detection time and commit", () => {
    const content = "steps:\n  - uses: actions/setup-node@main\n";
    const one = analyzeWorkflow(
      { ...base, content },
      "2026-10-01T00:00:00.000Z",
    )[0];
    const two = analyzeWorkflow(
      { ...base, commitSha: "c".repeat(40), content },
      "2026-10-02T00:00:00.000Z",
    )[0];
    expect(one?.id).toBe(two?.id);
  });
});
