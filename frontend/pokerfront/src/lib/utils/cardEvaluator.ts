import { Card, cardValue } from '../models/card';
import { HandPlay, HandRank } from '../models/hand';

// Suit order matching Dart implementation: higher number = higher suit
const suitOrder: Record<string, number> = {
  '♦': 1,
  '♣': 2,
  '♥': 3,
  '♠': 4,
};

export function evaluateHand(cards: Card[]): HandPlay {
  if (cards.length === 0) {
    return { rank: HandRank.Invalid, cards };
  }

  const rankCount: Record<string, number> = {};
  const suitCount: Record<string, number> = {};
  const values: number[] = [];

  for (const card of cards) {
    rankCount[card.rank] = (rankCount[card.rank] || 0) + 1;
    suitCount[card.suit] = (suitCount[card.suit] || 0) + 1;
    values.push(cardValue(card.rank));
  }

  const isFlush = Object.keys(suitCount).length === 1;
  values.sort((a, b) => a - b);

  const isSequential = (): boolean => {
    if (cards.length < 2) return false;
    
    if (cards.length === 5) {
      const ranks = new Set(cards.map(c => c.rank));
      // Check for A-2-3-4-5 (wheel)
      if (ranks.has('A') && ranks.has('2') && ranks.has('3') && 
          ranks.has('4') && ranks.has('5')) {
        return true;
      }
      // Check for 2-3-4-5-6
      if (ranks.has('2') && ranks.has('3') && ranks.has('4') && 
          ranks.has('5') && ranks.has('6')) {
        return true;
      }
    }
    // Check normal consecutive - ensure no duplicates
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length !== values.length) return false; // Has duplicates
    for (let i = 0; i < uniqueValues.length - 1; i++) {
      if (uniqueValues[i + 1] !== uniqueValues[i] + 1) return false;
    }
    return true;
  };

  const counts = Object.values(rankCount).sort((a, b) => b - a);

  switch (cards.length) {
    case 1:
      return { rank: HandRank.HighCard, cards };

    case 2:
      if (counts[0] === 2) {
        return { rank: HandRank.OnePair, cards };
      }
      break;

    case 3:
      if (counts[0] === 3) {
        return { rank: HandRank.ThreeOfAKind, cards };
      }
      break;

    case 4:
      if (counts[0] === 4) {
        return { rank: HandRank.FourOfAKind, cards };
      }
      break;

    case 5:
      if (isSequential() && isFlush && values[values.length - 1] === 13) {
        return { rank: HandRank.RoyalFlush, cards };
      } else if (isSequential() && isFlush) {
        return { rank: HandRank.StraightFlush, cards };
      } else if (counts[0] === 4) {
        return { rank: HandRank.FourOfAKind, cards };
      } else if (counts[0] === 3 && counts[1] === 2) {
        return { rank: HandRank.FullHouse, cards };
      } else if (isFlush) {
        return { rank: HandRank.Flush, cards };
      } else if (isSequential()) {
        return { rank: HandRank.Straight, cards };
      }
      break;
  }

  return { rank: HandRank.Invalid, cards };
}

/**
 * Calculate the straight value for comparison
 * A-2-3-4-5 (lowest) = 5, 2-3-4-5-6 = 6, 3-4-5-6-7 = 7, ..., 10-J-Q-K-A (highest) = 14
 */
function getStraightValue(cards: Card[]): number {
  const ranks = new Set(cards.map(c => c.rank));
  const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
  
  // Check for A-2-3-4-5 (wheel - lowest straight)
  if (ranks.has('A') && ranks.has('2') && ranks.has('3') && 
      ranks.has('4') && ranks.has('5') && !ranks.has('6')) {
    return cardValue('5'); // A-2-3-4-5 is valued at 5 (lowest)
  }
  
  // Check for 10-J-Q-K-A (highest straight)
  if (ranks.has('10') && ranks.has('J') && ranks.has('Q') && 
      ranks.has('K') && ranks.has('A') && !ranks.has('2')) {
    return cardValue('A'); // 10-J-Q-K-A is valued at A (14, highest)
  }
  
  // For all other straights, find the actual highest card in the sequence
  // Note: '2' has cardValue 15, but in a straight 2-3-4-5-6, the high card is 6, not 2
  if (ranks.has('2')) {
    // Straight contains 2, so find highest non-2 card (e.g., 2-3-4-5-6 -> 6)
    const nonTwoCards = sortedCards.filter(c => c.rank !== '2');
    // After filtering, the last card is the highest
    return cardValue(nonTwoCards[nonTwoCards.length - 1].rank);
  } else {
    // No 2 in straight, highest card is the last one after sorting
    return cardValue(sortedCards[4].rank);
  }
}

export function canPlay(playCards: Card[], lastPlay: HandPlay | null): boolean {
  // If no last play, can always play (starting a new round)
  if (!lastPlay || !lastPlay.cards || lastPlay.cards.length === 0) {
    return true;
  }

  // CRITICAL: Must play the same number of cards as the last play
  if (playCards.length !== lastPlay.cards.length) {
    console.warn(`❌ Card count mismatch: trying to play ${playCards.length} cards against ${lastPlay.cards.length} cards`);
    return false;
  }

  const play = evaluateHand(playCards);
  if (play.rank === HandRank.Invalid) {
    console.error('Invalid play evaluated:', playCards);
    return false;
  }

  // Ensure lastPlay has valid rank
  if (lastPlay.rank === HandRank.Invalid || !lastPlay.rank) {
    console.warn('LastPlay has invalid rank, allowing play');
    return true;
  }

  // Correct hand ranking order (lowest to highest) as specified:
  // HighCard < Pair < Triple < Straight < Flush < FullHouse < Poker (FourOfAKind) < StraightFlush < RoyalFlush
  const rankOrder = [
    HandRank.HighCard,        // 0 - lowest
    HandRank.OnePair,         // 1
    HandRank.ThreeOfAKind,    // 2 (Triple)
    HandRank.Straight,        // 3
    HandRank.Flush,           // 4
    HandRank.FullHouse,       // 5
    HandRank.FourOfAKind,     // 6 (Poker)
    HandRank.StraightFlush,   // 7
    HandRank.RoyalFlush,       // 8 - highest
  ];

  const lastRankIndex = rankOrder.indexOf(lastPlay.rank);
  const playRankIndex = rankOrder.indexOf(play.rank);

  // If rank not found in order, something is wrong - allow play to prevent blocking
  if (lastRankIndex === -1 || playRankIndex === -1) {
    console.warn('Rank not found in order:', { 
      lastRank: lastPlay.rank, 
      playRank: play.rank,
      lastRankIndex,
      playRankIndex,
      rankOrder
    });
    return true; // Allow play if we can't determine order
  }

  // Debug logging for hand comparison
  console.log('🔍 Frontend hand comparison:', {
    playRank: play.rank,
    playRankIndex,
    lastRank: lastPlay.rank,
    lastRankIndex,
    canBeat: playRankIndex > lastRankIndex,
    rankOrderString: rankOrder.map((r, i) => `${i}:${r}`).join(', '),
    playCards: playCards.map(c => `${c.rank}${c.suit}`),
    lastPlayCards: lastPlay.cards.map(c => `${c.rank}${c.suit}`),
    playRankType: typeof play.rank,
    lastRankType: typeof lastPlay.rank,
    rankOrderValues: rankOrder
  });

  // Higher rank index always wins (FullHouse=5 beats Straight=3 and Flush=4)
  if (playRankIndex > lastRankIndex) {
    console.log(`✅ ${play.rank} (index ${playRankIndex}) beats ${lastPlay.rank} (index ${lastRankIndex})`);
    return true;
  }
  // Lower rank always loses
  if (playRankIndex < lastRankIndex) {
    console.log(`❌ ${play.rank} (index ${playRankIndex}) cannot beat ${lastPlay.rank} (index ${lastRankIndex})`);
    return false;
  }

  // Same rank, compare values
  if (lastPlay.cards.length === 0) return true;
  
  // For straights, use special straight value calculation
  if (play.rank === HandRank.Straight && lastPlay.rank === HandRank.Straight) {
    const lastStraightValue = getStraightValue(lastPlay.cards);
    const playStraightValue = getStraightValue(playCards);
    
    // If straight values are different, higher value wins
    if (playStraightValue !== lastStraightValue) {
      return playStraightValue > lastStraightValue;
    }
    
    // If straight values are the same, compare by highest suit in the straight
    // Find the highest suit in each straight
    const lastMaxSuit = Math.max(...lastPlay.cards.map(c => suitOrder[c.suit] || 0));
    const playMaxSuit = Math.max(...playCards.map(c => suitOrder[c.suit] || 0));
    
    return playMaxSuit > lastMaxSuit;
  }
  
  // For full houses, compare three-of-a-kind rank first, then pair rank
  if (play.rank === HandRank.FullHouse && lastPlay.rank === HandRank.FullHouse) {
    const getFullHouseRanks = (cards: Card[]) => {
      const rankCounts: Record<string, number> = {};
      for (const card of cards) {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      }
      let threeOfAKindRank: string | null = null;
      let pairRank: string | null = null;
      for (const [rank, count] of Object.entries(rankCounts)) {
        if (count === 3) {
          threeOfAKindRank = rank;
        } else if (count === 2) {
          pairRank = rank;
        }
      }
      return { threeOfAKindRank, pairRank };
    };
    
    const lastRanks = getFullHouseRanks(lastPlay.cards);
    const playRanks = getFullHouseRanks(playCards);
    
    const lastThreeValue = cardValue(lastRanks.threeOfAKindRank || '');
    const playThreeValue = cardValue(playRanks.threeOfAKindRank || '');
    
    // Compare three-of-a-kind first
    if (playThreeValue !== lastThreeValue) {
      return playThreeValue > lastThreeValue;
    }
    
    // If three-of-a-kind is the same, compare pair
    const lastPairValue = cardValue(lastRanks.pairRank || '');
    const playPairValue = cardValue(playRanks.pairRank || '');
    return playPairValue > lastPairValue;
  }
  
  // For other hands (including HighCard), compare highest card value first
  const lastMaxRank = Math.max(...lastPlay.cards.map(c => cardValue(c.rank)));
  const playMaxRank = Math.max(...playCards.map(c => cardValue(c.rank)));
  
  // Debug logging for HighCard comparison
  if (play.rank === HandRank.HighCard && lastPlay.rank === HandRank.HighCard) {
    console.log('🔍 HighCard comparison:', {
      playCard: `${playCards[0].rank}${playCards[0].suit}`,
      playRankValue: playMaxRank,
      lastCard: `${lastPlay.cards[0].rank}${lastPlay.cards[0].suit}`,
      lastRankValue: lastMaxRank,
      canBeat: playMaxRank > lastMaxRank || (playMaxRank === lastMaxRank && suitOrder[playCards[0].suit] > suitOrder[lastPlay.cards[0].suit])
    });
  }
  
  // If ranks are different, higher rank wins
  if (playMaxRank !== lastMaxRank) {
    const result = playMaxRank > lastMaxRank;
    if (play.rank === HandRank.HighCard && lastPlay.rank === HandRank.HighCard) {
      console.log(`  → Rank comparison: ${playMaxRank} > ${lastMaxRank} = ${result}`);
    }
    return result;
  }
  
  // Same rank, compare suits (matching Dart logic)
  // Find all cards with the max rank
  const lastMaxCards = lastPlay.cards.filter(c => cardValue(c.rank) === lastMaxRank);
  const playMaxCards = playCards.filter(c => cardValue(c.rank) === playMaxRank);
  
  // Get the highest suit value for each
  const lastMaxSuit = Math.max(...lastMaxCards.map(c => suitOrder[c.suit] || 0));
  const playMaxSuit = Math.max(...playMaxCards.map(c => suitOrder[c.suit] || 0));
  
  // Higher suit value wins (matching Dart: suitOrder higher = stronger)
  const suitResult = playMaxSuit > lastMaxSuit;
  if (play.rank === HandRank.HighCard && lastPlay.rank === HandRank.HighCard) {
    console.log(`  → Suit comparison: ${playMaxSuit} > ${lastMaxSuit} = ${suitResult}`);
  }
  return suitResult;
}

