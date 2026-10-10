-- Per-lab AI planning configuration, owned by the lab's incharge:
-- their own provider + API key (server-only, never sent to clients).
ALTER TABLE "Lab" ADD COLUMN "aiProvider" TEXT;
ALTER TABLE "Lab" ADD COLUMN "aiApiKey" TEXT;
ALTER TABLE "Lab" ADD COLUMN "aiModel" TEXT;
