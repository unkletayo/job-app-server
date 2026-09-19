-- CreateTable
CREATE TABLE "watched_companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "boardToken" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watched_companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watched_companies_userId_idx" ON "watched_companies"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "watched_companies_userId_source_boardToken_key" ON "watched_companies"("userId", "source", "boardToken");

-- AddForeignKey
ALTER TABLE "watched_companies" ADD CONSTRAINT "watched_companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
