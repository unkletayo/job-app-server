-- CreateTable
CREATE TABLE "source_postings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourcePostingId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remoteType" TEXT,
    "employmentType" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "seniority" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredQualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "educationRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicationUrl" TEXT,
    "postedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_postings_userId_idx" ON "source_postings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_sourcePostingId_key" ON "job_postings"("sourcePostingId");

-- CreateIndex
CREATE INDEX "job_postings_userId_idx" ON "job_postings"("userId");

-- AddForeignKey
ALTER TABLE "source_postings" ADD CONSTRAINT "source_postings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_sourcePostingId_fkey" FOREIGN KEY ("sourcePostingId") REFERENCES "source_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

