-- Todo priority (Low/Medium/High), surfaced only in labs that enable it.
CREATE TYPE "TodoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Todo" ADD COLUMN "priority" "TodoPriority" NOT NULL DEFAULT 'MEDIUM';

-- Per-lab feature toggle, OFF by default; the lab incharge/admin enables it.
ALTER TABLE "Lab" ADD COLUMN "todoPriorityEnabled" BOOLEAN NOT NULL DEFAULT false;
