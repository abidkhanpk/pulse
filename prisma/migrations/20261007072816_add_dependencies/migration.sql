-- CreateTable
CREATE TABLE "TodoDependency" (
    "todoId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,

    CONSTRAINT "TodoDependency_pkey" PRIMARY KEY ("todoId","dependsOnId")
);

-- CreateTable
CREATE TABLE "MilestoneDependency" (
    "milestoneId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,

    CONSTRAINT "MilestoneDependency_pkey" PRIMARY KEY ("milestoneId","dependsOnId")
);

-- CreateIndex
CREATE INDEX "TodoDependency_dependsOnId_idx" ON "TodoDependency"("dependsOnId");

-- CreateIndex
CREATE INDEX "MilestoneDependency_dependsOnId_idx" ON "MilestoneDependency"("dependsOnId");

-- AddForeignKey
ALTER TABLE "TodoDependency" ADD CONSTRAINT "TodoDependency_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoDependency" ADD CONSTRAINT "TodoDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
