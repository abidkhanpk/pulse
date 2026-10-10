-- Projects gain a priority (used by resource planning); NORMAL is the
-- default for projects and becomes the default for new todos too.
-- Separate migration: a new enum value cannot be used in the same
-- transaction that adds it.
ALTER TABLE "Project" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Todo" ALTER COLUMN "priority" SET DEFAULT 'NORMAL';
