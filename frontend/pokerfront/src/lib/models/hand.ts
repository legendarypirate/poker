import { Card } from './card';

export enum HandRank {
  Invalid = 'Invalid',
  HighCard = 'HighCard',
  OnePair = 'OnePair',
  ThreeOfAKind = 'ThreeOfAKind',
  FourOfAKind = 'FourOfAKind',
  FullHouse = 'FullHouse',
  Flush = 'Flush',
  Straight = 'Straight',
  StraightFlush = 'StraightFlush',
  RoyalFlush = 'RoyalFlush',
}

export interface HandPlay {
  rank: HandRank;
  cards: Card[];
}

