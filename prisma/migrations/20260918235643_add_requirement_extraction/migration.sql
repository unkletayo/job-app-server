-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirements_jobPostingId_idx" ON "requirements"("jobPostingId");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
