import { speakingOrder } from './speaking-order';

interface Seat {
  id: string;
  alive: boolean;
}

describe('speakingOrder', () => {
  const seats: Seat[] = [
    { id: 'a', alive: true },
    { id: 'b', alive: true },
    { id: 'c', alive: true },
    { id: 'd', alive: true },
  ];

  it('starts from the first seat on round 1', () => {
    expect(speakingOrder(seats, 1).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rotates the starting seat on subsequent rounds', () => {
    expect(speakingOrder(seats, 2).map((s) => s.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(speakingOrder(seats, 5).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('excludes eliminated players from the order', () => {
    const withDead: Seat[] = [
      { id: 'a', alive: true },
      { id: 'b', alive: false },
      { id: 'c', alive: true },
    ];
    expect(speakingOrder(withDead, 1).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('returns an empty order when nobody is alive', () => {
    expect(speakingOrder([{ id: 'a', alive: false }], 1)).toEqual([]);
  });
});
