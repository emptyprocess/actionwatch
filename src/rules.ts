export const minimumMajorVersions: Readonly<Record<string, number>> = {
  "actions/cache": 4,
  "actions/checkout": 4,
  "actions/download-artifact": 4,
  "actions/setup-dotnet": 4,
  "actions/setup-java": 4,
  "actions/setup-node": 4,
  "actions/setup-python": 5,
  "actions/upload-artifact": 4,
};

export const broadWritePermissions = new Set([
  "actions",
  "checks",
  "contents",
  "deployments",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "repository-projects",
  "security-events",
  "statuses",
]);
