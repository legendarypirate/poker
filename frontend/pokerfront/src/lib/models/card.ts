export interface Card {
  rank: string;
  suit: string;
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardValue(rank: string): number {
  const values: Record<string, number> = {
    '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15,
  };
  return values[rank] || 0;
}

