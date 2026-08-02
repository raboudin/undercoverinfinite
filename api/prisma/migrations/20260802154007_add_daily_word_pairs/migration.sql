-- CreateTable
CREATE TABLE "DailyWordPair" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "position" INTEGER NOT NULL,
    "wordA" TEXT NOT NULL,
    "wordB" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWordPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyWordPair_day_position_key" ON "DailyWordPair"("day", "position");
