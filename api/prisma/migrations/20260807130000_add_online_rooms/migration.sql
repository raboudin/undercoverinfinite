-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostPlayerId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'lobby',
    "mode" TEXT NOT NULL DEFAULT 'classique',
    "theme" TEXT NOT NULL DEFAULT 'general',
    "undercoverCount" INTEGER,
    "timerSeconds" INTEGER,
    "challenge" TEXT,
    "round" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "speakerIndex" INTEGER NOT NULL DEFAULT 0,
    "lastEliminatedPlayerId" TEXT,
    "winner" TEXT,
    "dealNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_players" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "seat" INTEGER,
    "role" TEXT,
    "word" TEXT,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "hasSeenReveal" BOOLEAN NOT NULL DEFAULT false,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "playerTokenHash" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_votes" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dealNumber" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "voterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_playerTokenHash_key" ON "room_players"("playerTokenHash");

-- CreateIndex
CREATE INDEX "room_players_roomId_idx" ON "room_players"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_roomId_seat_key" ON "room_players"("roomId", "seat");

-- CreateIndex
CREATE INDEX "room_votes_roomId_dealNumber_round_attempt_idx" ON "room_votes"("roomId", "dealNumber", "round", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "room_votes_roomId_dealNumber_round_attempt_voterId_key" ON "room_votes"("roomId", "dealNumber", "round", "attempt", "voterId");

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_votes" ADD CONSTRAINT "room_votes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_votes" ADD CONSTRAINT "room_votes_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "room_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_votes" ADD CONSTRAINT "room_votes_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "room_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
