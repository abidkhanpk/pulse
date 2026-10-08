-- Grant the new projects.view_all permission to the system roles that should
-- have it (ADMIN, LAB_INCHARGE). Role permissions are stored per-row, so
-- existing deployments would otherwise miss the new default. Idempotent and
-- does not touch custom roles.
UPDATE "Role"
SET "permissions" = array_append("permissions", 'projects.view_all'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('ADMIN', 'LAB_INCHARGE')
  AND NOT ('projects.view_all' = ANY ("permissions"));
