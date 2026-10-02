# actionwatch

`actionwatch` scans recently changed public GitHub repositories for evidence-backed GitHub Actions workflow risks. It records only genuinely new findings; a run that finds nothing new makes no commit, branch, or pull request.

The initial rules detect:

- third-party actions referenced by a mutable tag or branch instead of a full 40-character commit SHA;
- `write-all` and explicit write permissions that deserve least-privilege review;
- known official actions whose major version is below a small, auditable minimum-version table.

This is a discovery dataset, not a vulnerability verdict. A recorded permission may be intentional, and a mutable reference is a supply-chain risk even when the referenced publisher is trusted. Every result links to the exact scanned commit so it can be reviewed in context.

## How it works

The daily workflow searches public, non-archived, non-fork repositories changed in the previous day, examines workflow files on their default branches, and stops after at most 50 new findings. Stable finding IDs deduplicate results across runs. IDs are derived from repository, workflow, finding type, action, and permission—not the scan date or commit—so the same issue is not repeatedly added.

When there are new files, the workflow validates the entire dataset, creates a temporary branch, commits as `emptyprocess <320864519+emptyprocess@users.noreply.github.com>`, opens a PR, and requests squash auto-merge with branch deletion. The separate CI workflow validates the PR. GitHub merges only after required checks and branch protection rules pass. With no new finding, the workflow exits before any Git operation.

## Finding format

Each finding is stored as `findings/<id>.json`:

```json
{
  "schemaVersion": 1,
  "id": "64-character-sha256-id",
  "repository": "owner/repository",
  "repositoryUrl": "https://github.com/owner/repository",
  "workflow": ".github/workflows/ci.yml",
  "workflowUrl": "https://github.com/owner/repository/blob/<commit>/.github/workflows/ci.yml",
  "commitSha": "40-character-git-sha",
  "finding": "mutable-action-ref",
  "severity": "high",
  "evidence": {
    "line": 12,
    "snippet": "uses: example/setup@main",
    "action": "example/setup@main"
  },
  "detectedAt": "2026-10-02T00:00:00.000Z"
}
```

## Local use

Requires Node.js 20 or newer.

```sh
npm install
GITHUB_TOKEN=github_token npm run scan
npm run check
```

Optional environment variables are `FINDINGS_DIR`, `MAX_NEW_FINDINGS` (hard-capped at 50), `MAX_REPOSITORIES` (hard-capped at 100), and `PUSHED_SINCE` (`YYYY-MM-DD`).

## Repository setup

1. Create a fine-grained token for the `emptyprocess` account with access to this repository and permission to read/write contents and pull requests.
2. Store it as the Actions secret `ACTIONWATCH_TOKEN`. A separate token is necessary because events created by the default `GITHUB_TOKEN` do not start new workflow runs, while the PR must run CI.
3. Enable “Allow auto-merge” in repository settings.
4. Protect `main`, require the `validate` check, and require pull requests before merging.
5. Keep “Automatically delete head branches” enabled as a fallback; the merge command also requests branch deletion.

GitHub API limits bound how many repositories can be inspected per run. Individual repository failures are logged and skipped so one inaccessible or unusually large repository does not discard other results.

## Rule maintenance

Reliable minimum major versions live in `src/rules.ts`. Update this table only after verifying the publisher's release and support policy. The tool deliberately does not guess that an arbitrary action version is outdated.

## Responsible use

The scanner uses only public repository data. Findings should be treated as leads for maintainers, not as proof of exploitation. Avoid contacting maintainers automatically or publishing sensitive claims without human review.

## License

MIT
