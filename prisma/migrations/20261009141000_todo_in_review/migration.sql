-- New kanban stage between In Progress and Done.
ALTER TYPE "TodoStatus" ADD VALUE 'IN_REVIEW' AFTER 'IN_PROGRESS';
