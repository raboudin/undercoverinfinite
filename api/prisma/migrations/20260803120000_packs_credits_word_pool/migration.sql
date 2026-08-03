-- DropTable
DROP TABLE "DailyWordPair";

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pack" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'free',
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "daily_usage" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_pairs" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "spicy" BOOLEAN NOT NULL DEFAULT false,
    "wordA" TEXT NOT NULL,
    "wordB" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_draws" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entitlements_userId_idx" ON "entitlements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_userId_pack_key" ON "entitlements"("userId", "pack");

-- CreateIndex
CREATE UNIQUE INDEX "daily_usage_subject_day_key" ON "daily_usage"("subject", "day");

-- CreateIndex
CREATE INDEX "word_pairs_theme_spicy_idx" ON "word_pairs"("theme", "spicy");

-- CreateIndex
CREATE UNIQUE INDEX "word_pairs_theme_spicy_wordA_wordB_key" ON "word_pairs"("theme", "spicy", "wordA", "wordB");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_text_key" ON "challenges"("text");

-- CreateIndex
CREATE INDEX "content_draws_subject_kind_idx" ON "content_draws"("subject", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "content_draws_subject_kind_refId_key" ON "content_draws"("subject", "kind", "refId");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
