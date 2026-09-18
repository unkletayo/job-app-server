-- AlterTable
ALTER TABLE "users" ADD COLUMN "singleton" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "users_singleton_key" ON "users"("singleton");
