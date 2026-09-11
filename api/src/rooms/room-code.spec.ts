import { generateRoomCode } from './room-code';

describe('generateRoomCode', () => {
  it('generates a 6-character code', () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it('never uses ambiguous characters (0/O/1/I)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('is unlikely to collide across many calls', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRoomCode()));
    expect(codes.size).toBe(500);
  });
});
