-- DropForeignKey
ALTER TABLE "credit_wallets" DROP CONSTRAINT "credit_wallets_userId_fkey";

-- DropForeignKey
ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_userId_fkey";

-- DropIndex
DROP INDEX "word_pairs_theme_spicy_idx";

-- DropIndex
DROP INDEX "word_pairs_theme_spicy_wordA_wordB_key";

-- AlterTable
ALTER TABLE "rooms" DROP COLUMN "challenge",
DROP COLUMN "mode",
DROP COLUMN "timerSeconds",
ADD COLUMN     "difficulty" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "spicy" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "word_pairs" ADD COLUMN     "difficulty" INTEGER NOT NULL DEFAULT 3;

-- DropTable
DROP TABLE "challenges";

-- DropTable
DROP TABLE "credit_wallets";

-- DropTable
DROP TABLE "daily_usage";

-- DropTable
DROP TABLE "entitlements";

-- CreateIndex
CREATE INDEX "word_pairs_theme_spicy_difficulty_idx" ON "word_pairs"("theme", "spicy", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "word_pairs_theme_spicy_difficulty_wordA_wordB_key" ON "word_pairs"("theme", "spicy", "difficulty", "wordA", "wordB");

