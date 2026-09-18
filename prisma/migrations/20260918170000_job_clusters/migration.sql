-- DropForeignKey
ALTER TABLE "job_postings" DROP CONSTRAINT "job_postings_sourcePostingId_fkey";

-- DropIndex
DROP INDEX "job_postings_sourcePostingId_key";

-- AlterTable
ALTER TABLE "job_postings" DROP COLUMN "source",
DROP COLUMN "sourceJobId",
DROP COLUMN "sourcePostingId",
ADD COLUMN     "jobClusterId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "source_postings" ADD COLUMN     "jobClusterId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "job_clusters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_clusters_userId_idx" ON "job_clusters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_jobClusterId_key" ON "job_postings"("jobClusterId");

-- CreateIndex
CREATE INDEX "source_postings_jobClusterId_idx" ON "source_postings"("jobClusterId");

-- AddForeignKey
ALTER TABLE "job_clusters" ADD CONSTRAINT "job_clusters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_postings" ADD CONSTRAINT "source_postings_jobClusterId_fkey" FOREIGN KEY ("jobClusterId") REFERENCES "job_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_jobClusterId_fkey" FOREIGN KEY ("jobClusterId") REFERENCES "job_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

