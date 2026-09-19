-- CreateTable
CREATE TABLE "discovery_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 30,
    "lastSuccessfulRunAt" TIMESTAMP(3),
    "lastCursor" TEXT,
    "lastSeenJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "jobsFetched" INTEGER NOT NULL DEFAULT 0,
    "jobsMerged" INTEGER NOT NULL DEFAULT 0,
    "jobsCreated" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discovery_sources_userId_idx" ON "discovery_sources"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_sources_userId_sourceKey_key" ON "discovery_sources"("userId", "sourceKey");

-- CreateIndex
CREATE INDEX "discovery_runs_userId_idx" ON "discovery_runs"("userId");

-- CreateIndex
CREATE INDEX "discovery_runs_sourceId_idx" ON "discovery_runs"("sourceId");

-- AddForeignKey
ALTER TABLE "discovery_sources" ADD CONSTRAINT "discovery_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "discovery_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
