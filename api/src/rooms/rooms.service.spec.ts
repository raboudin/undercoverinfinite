import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

function createPrismaMock() {
  return {
    room: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn(),
    },
    roomPlayer: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    roomVote: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('RoomsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let words: { draw: jest.Mock };
  let service: RoomsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    words = { draw: jest.fn() };
    service = new RoomsService(prisma as never, words as never);
  });

  describe('createRoom', () => {
    it('retries with a fresh code after a collision, then succeeds', async () => {
      prisma.$transaction
        .mockImplementationOnce(() => {
          throw { code: 'P2002' };
        })
        .mockImplementationOnce(async (run: (tx: unknown) => Promise<unknown>) =>
          run({
            room: {
              create: jest.fn().mockResolvedValue({ id: 'room-1' }),
              update: jest.fn().mockResolvedValue({}),
            },
            roomPlayer: {
              create: jest.fn().mockResolvedValue({
                id: 'player-1',
                roomId: 'room-1',
                displayName: 'Agent 1',
              }),
            },
          }),
        );

      const result = await service.createRoom({ key: 'device:abc', userId: null }, 'Agent 1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result.playerId).toBe('player-1');
      expect(result.roomId).toBe('room-1');
      expect(result.isHost).toBe(true);
    });
  });

  describe('joinRoom', () => {
    it('rejects once the room has left the lobby', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', phase: 'describe' });
      await expect(
        service.joinRoom('ABC123', 'Agent 2', { key: 'device:xyz', userId: null }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects once the room has reached the player cap', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', phase: 'lobby' });
      prisma.roomPlayer.count.mockResolvedValue(12);
      await expect(
        service.joinRoom('ABC123', 'Agent 2', { key: 'device:xyz', userId: null }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a non-host player when the room has room', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', phase: 'lobby' });
      prisma.roomPlayer.count.mockResolvedValue(3);
      prisma.roomPlayer.create.mockResolvedValue({
        id: 'player-2',
        roomId: 'room-1',
        displayName: 'Agent 2',
      });

      const result = await service.joinRoom('ABC123', 'Agent 2', {
        key: 'device:xyz',
        userId: null,
      });

      expect(result.isHost).toBe(false);
      expect(result.playerId).toBe('player-2');
    });
  });

  describe('castVote', () => {
    const baseRoom = { id: 'room-1', phase: 'vote', dealNumber: 1, round: 1, attempt: 1 };

    it('eliminates the clear winner once every alive player has voted', async () => {
      prisma.room.findUniqueOrThrow.mockResolvedValue(baseRoom);
      prisma.roomPlayer.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'voter', alive: true })
        .mockResolvedValueOnce({ id: 'target', roomId: 'room-1', alive: true });
      prisma.roomVote.create.mockResolvedValue({});
      prisma.roomPlayer.count.mockResolvedValue(2);
      prisma.roomVote.findMany.mockResolvedValue([
        { targetId: 'target' },
        { targetId: 'target' },
      ]);
      prisma.room.updateMany.mockResolvedValue({ count: 1 });
      prisma.roomPlayer.update.mockResolvedValue({});

      const result = await service.castVote('room-1', 'voter', 'target');

      expect(result.resolved).toBe(true);
      expect(result.eliminatedPlayerId).toBe('target');
      expect(prisma.roomPlayer.update).toHaveBeenCalledWith({
        where: { id: 'target' },
        data: { alive: false },
      });
    });

    it('increments the attempt on a tie instead of eliminating anyone', async () => {
      prisma.room.findUniqueOrThrow.mockResolvedValue(baseRoom);
      prisma.roomPlayer.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'voter', alive: true })
        .mockResolvedValueOnce({ id: 'target', roomId: 'room-1', alive: true });
      prisma.roomVote.create.mockResolvedValue({});
      prisma.roomPlayer.count.mockResolvedValue(2);
      prisma.roomVote.findMany.mockResolvedValue([{ targetId: 'a' }, { targetId: 'b' }]);
      prisma.room.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.castVote('room-1', 'voter', 'target');

      expect(result.resolved).toBe(false);
      expect(result.tie).toBe(true);
      expect(prisma.roomPlayer.update).not.toHaveBeenCalled();
    });

    it('rejects a second vote from the same player on the same attempt', async () => {
      prisma.room.findUniqueOrThrow.mockResolvedValue(baseRoom);
      prisma.roomPlayer.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'voter', alive: true })
        .mockResolvedValueOnce({ id: 'target', roomId: 'room-1', alive: true });
      prisma.roomVote.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.castVote('room-1', 'voter', 'target')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
