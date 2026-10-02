import { createHash } from "node:crypto";
import YAML from "yaml";
import { broadWritePermissions, minimumMajorVersions } from "./rules.js";
import type { Finding, FindingType, WorkflowInput } from "./types.js";

type Evidence = Finding["evidence"];

function idFor(
  input: WorkflowInput,
  type: FindingType,
  evidence: Evidence,
): string {
  const key = [
    input.repository,
    input.workflow,
    type,
    evidence.action ?? "",
    evidence.permission ?? "",
  ].join("\0");
  return createHash("sha256").update(key).digest("hex");
}

function lineFor(content: string, needle: string): number | undefined {
  const index = content.split("\n").findIndex((line) => line.includes(needle));
  return index < 0 ? undefined : index + 1;
}

function makeFinding(
  input: WorkflowInput,
  type: FindingType,
  severity: Finding["severity"],
  evidence: Evidence,
  detectedAt: string,
): Finding {
  const encodedPath = input.workflow
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return {
    schemaVersion: 1,
    id: idFor(input, type, evidence),
    repository: input.repository,
    repositoryUrl: `https://github.com/${input.repository}`,
    workflow: input.workflow,
    workflowUrl: `https://github.com/${input.repository}/blob/${input.commitSha}/${encodedPath}`,
    commitSha: input.commitSha,
    finding: type,
    severity,
    evidence,
    detectedAt,
  };
}

function actionFindings(input: WorkflowInput, detectedAt: string): Finding[] {
  const findings: Finding[] = [];
  const regex = /^\s*-?\s*uses:\s*["']?([^\s"']+)["']?\s*(?:#.*)?$/gm;
  for (const match of input.content.matchAll(regex)) {
    const uses = match[1];
    if (!uses || uses.startsWith("./") || uses.startsWith("docker://"))
      continue;
    const at = uses.lastIndexOf("@");
    if (at < 1) continue;
    const action = uses.slice(0, at);
    const ref = uses.slice(at + 1);
    const line = lineFor(input.content, match[0].trim());
    if (!/^[a-f0-9]{40}$/i.test(ref)) {
      findings.push(
        makeFinding(
          input,
          "mutable-action-ref",
          "high",
          { line, snippet: match[0].trim(), action: uses },
          detectedAt,
        ),
      );
    }
    const minimum = minimumMajorVersions[action.toLowerCase()];
    const majorMatch = /^v(\d+)(?:\.|$)/i.exec(ref);
    const major = majorMatch?.[1] ? Number(majorMatch[1]) : undefined;
    if (minimum !== undefined && major !== undefined && major < minimum) {
      findings.push(
        makeFinding(
          input,
          "outdated-action-version",
          "medium",
          {
            line,
            snippet: match[0].trim(),
            action,
            detectedVersion: `v${major}`,
            recommendedMinimum: `v${minimum}`,
          },
          detectedAt,
        ),
      );
    }
  }
  return findings;
}

function permissionFindings(
  input: WorkflowInput,
  detectedAt: string,
): Finding[] {
  let parsed: unknown;
  try {
    parsed = YAML.parse(input.content);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const findings: Finding[] = [];
  const inspect = (permissions: unknown, scope: string): void => {
    if (permissions === "write-all") {
      findings.push(
        makeFinding(
          input,
          "overly-broad-permissions",
          "high",
          {
            line: lineFor(input.content, "permissions: write-all"),
            snippet: `${scope} permissions: write-all`,
            permission: `${scope}:write-all`,
          },
          detectedAt,
        ),
      );
      return;
    }
    if (!permissions || typeof permissions !== "object") return;
    for (const [name, access] of Object.entries(permissions)) {
      if (access === "write" && broadWritePermissions.has(name)) {
        findings.push(
          makeFinding(
            input,
            "overly-broad-permissions",
            "medium",
            {
              line: lineFor(input.content, `${name}: write`),
              snippet: `${scope} permission ${name}: write`,
              permission: `${scope}:${name}:write`,
            },
            detectedAt,
          ),
        );
      }
    }
  };
  const workflow = parsed as Record<string, unknown>;
  inspect(workflow.permissions, "workflow");
  const jobs = workflow.jobs;
  if (jobs && typeof jobs === "object") {
    for (const [jobName, job] of Object.entries(jobs)) {
      if (job && typeof job === "object")
        inspect((job as Record<string, unknown>).permissions, `job:${jobName}`);
    }
  }
  return findings;
}

export function analyzeWorkflow(
  input: WorkflowInput,
  detectedAt = new Date().toISOString(),
): Finding[] {
  return [
    ...actionFindings(input, detectedAt),
    ...permissionFindings(input, detectedAt),
  ];
}
