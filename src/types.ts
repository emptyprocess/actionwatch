import { z } from "zod";

export const findingTypes = [
  "mutable-action-ref",
  "overly-broad-permissions",
  "outdated-action-version",
] as const;

export const FindingSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-f0-9]{64}$/),
  repository: z.string().regex(/^[^/]+\/[^/]+$/),
  repositoryUrl: z.string().url(),
  workflow: z.string().min(1),
  workflowUrl: z.string().url(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  finding: z.enum(findingTypes),
  severity: z.enum(["low", "medium", "high"]),
  evidence: z.object({
    line: z.number().int().positive().optional(),
    snippet: z.string().min(1),
    action: z.string().optional(),
    detectedVersion: z.string().optional(),
    recommendedMinimum: z.string().optional(),
    permission: z.string().optional(),
  }),
  detectedAt: z.string().datetime(),
});

export type Finding = z.infer<typeof FindingSchema>;
export type FindingType = (typeof findingTypes)[number];

export interface WorkflowInput {
  repository: string;
  defaultBranch: string;
  commitSha: string;
  workflow: string;
  content: string;
}
