-- One shared priority scale for todos and projects:
-- LOW / NORMAL / MEDIUM / HIGH (user decision 2026-10-10).
ALTER TYPE "TodoPriority" RENAME TO "Priority";
ALTER TYPE "Priority" ADD VALUE 'NORMAL' AFTER 'LOW';
