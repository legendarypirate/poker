const { cardValue, suitOrder } = require('./cardUtils');

// FIXED: Check for straights including special cases A-2-3-4-5 and 2-3-4-5-6
function checkStraight(cards) {
  if (cards.length !== 5) return false;
  
  // Get unique ranks
  const ranks = [...new Set(cards.map(c => c.rank))];
  if (ranks.length !== 5) return false;
  
  // Check for special case: A-2-3-4-5 (wheel)
  if (ranks.includes('A') && ranks.includes('2') && ranks.includes('3') && 
      ranks.includes('4') && ranks.includes('5')) {
    return true;
  }
  
  // Check for special case: 2-3-4-5-6
  if (ranks.includes('2') && ranks.includes('3') && ranks.includes('4') && 
      ranks.includes('5') && ranks.includes('6')) {
    return true;
  }
  
  // Check for normal consecutive straights
  const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
  for (let i = 0; i < sortedCards.length - 1; i++) {
    if (cardValue(sortedCards[i].rank) + 1 !== cardValue(sortedCards[i + 1].rank)) {
      return false;
    }
  }
  return true;
}

function checkFlush(cards) {
  const firstSuit = cards[0].suit;
  return cards.every(card => card.suit === firstSuit);
}

function checkFullHouse(cards) {
  const ranks = cards.map(card => card.rank);
  const rankCounts = {};
  for (const rank of ranks) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  return counts[0] === 3 && counts[1] === 2;
}

function checkFourOfAKind(cards) {
  const ranks = cards.map(card => card.rank);
  const rankCounts = {};
  for (const rank of ranks) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  return counts[0] === 4;
}

function getTwoPairValue(cards) {
  const ranks = cards.map(card => card.rank);
  const rankCounts = {};
  for (const rank of ranks) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  
  const pairs = [];
  const suitsForPairs = {};
  
  // Find pairs and their highest suits
  for (const card of cards) {
    if (rankCounts[card.rank] === 2) {
      if (!suitsForPairs[card.rank]) {
        suitsForPairs[card.rank] = [];
      }
      suitsForPairs[card.rank].push(suitOrder[card.suit] || 0);
    }
  }
  
  // Get the highest suit for each pair
  for (const [rank, suits] of Object.entries(suitsForPairs)) {
    const highestSuit = Math.max(...suits);
    pairs.push({
      rankValue: cardValue(rank),
      suitValue: highestSuit
    });
  }
  
  // Sort pairs by rank then by suit
  pairs.sort((a, b) => {
    if (b.rankValue !== a.rankValue) {
      return b.rankValue - a.rankValue;
    }
    return b.suitValue - a.suitValue;
  });
  
  if (pairs.length >= 2) {
    return pairs[0].rankValue * 100 + pairs[0].suitValue * 10 + pairs[1].rankValue;
  }
  
  return 0;
}

function evaluateFiveCardHand(cards) {
  const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
  
  const isStraight = checkStraight(sortedCards);
  const isFlush = checkFlush(cards);
  const isFullHouse = checkFullHouse(cards);
  const isFourOfAKind = checkFourOfAKind(cards);
  
  if (isStraight && isFlush) {
    // Check for Royal Flush (10-J-Q-K-A)
    if (sortedCards[0].rank === '10' && sortedCards[4].rank === 'A') {
      return { rank: 'RoyalFlush', value: 1000, cards: cards };
    }
    return { rank: 'StraightFlush', value: 900 + cardValue(sortedCards[4].rank), cards: cards };
  }
  
  if (isFourOfAKind) {
    return { rank: 'FourOfAKind', value: 800 + cardValue(sortedCards[2].rank), cards: cards };
  }
  
  if (isFullHouse) {
    return { rank: 'FullHouse', value: 700 + cardValue(sortedCards[2].rank), cards: cards };
  }
  
  if (isFlush) {
    return { rank: 'Flush', value: 600 + cardValue(sortedCards[4].rank), cards: cards };
  }
  
  if (isStraight) {
    // For special straights, use appropriate high card value
    let highCardValue = cardValue(sortedCards[4].rank);
    // A-2-3-4-5 should be treated as low straight (value based on 5)
    if (sortedCards[0].rank === 'A' && sortedCards[1].rank === '2') {
      highCardValue = cardValue('5');
    }
    // 2-3-4-5-6 should use 6 as high card
    if (sortedCards[0].rank === '2' && sortedCards[4].rank === '6') {
      highCardValue = cardValue('6');
    }
    return { rank: 'Straight', value: 500 + highCardValue, cards: cards };
  }
  
  // BLOCK all other 5-card combinations including TwoPair
  return { rank: 'Invalid', value: 0 };
}

function evaluateHand(cards) {
  if (!cards || cards.length === 0) return { rank: 'Invalid', value: 0 };
  
  // Sort cards by rank and suit for consistent evaluation
  const sortedCards = [...cards].sort((a, b) => {
    const valueA = cardValue(a.rank);
    const valueB = cardValue(b.rank);
    if (valueA !== valueB) {
      return valueA - valueB;
    }
    return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
  });
  
  // STRICT VALIDATION - Only allow specific combinations
  switch (cards.length) {
    case 1:
      return { 
        rank: 'Single', 
        value: cardValue(sortedCards[0].rank) * 100 + (suitOrder[sortedCards[0].suit] || 0),
        cards: sortedCards 
      };
      
    case 2:
      // Must be a pair
      if (sortedCards[0].rank === sortedCards[1].rank) {
        const pairValue = cardValue(sortedCards[0].rank) * 100;
        const highestSuit = Math.max(suitOrder[sortedCards[0].suit] || 0, suitOrder[sortedCards[1].suit] || 0);
        return { 
          rank: 'Pair', 
          value: pairValue + highestSuit,
          cards: sortedCards 
        };
      }
      break;
      
    case 3:
      // Must be three of a kind
      if (sortedCards[0].rank === sortedCards[1].rank && sortedCards[1].rank === sortedCards[2].rank) {
        return { 
          rank: 'ThreeOfAKind', 
          value: cardValue(sortedCards[0].rank), 
          cards: sortedCards 
        };
      }
      break;
      
    case 4:
      // Must be two pair (2+2) or four of a kind
      const ranks4 = sortedCards.map(card => card.rank);
      const rankCounts4 = {};
      for (const rank of ranks4) {
        rankCounts4[rank] = (rankCounts4[rank] || 0) + 1;
      }
      const counts4 = Object.values(rankCounts4).sort((a, b) => b - a);
      
      if (counts4[0] === 2 && counts4[1] === 2) {
        return { 
          rank: 'TwoPair', 
          value: 300 + getTwoPairValue(sortedCards), 
          cards: sortedCards 
        };
      } else if (counts4[0] === 4) {
        return { 
          rank: 'FourOfAKind', 
          value: 800 + cardValue(sortedCards[0].rank), 
          cards: sortedCards 
        };
      }
      break;
      
    case 5:
      // Only allow specific 5-card combinations
      return evaluateFiveCardHand(sortedCards);
  }
  
  return { rank: 'Invalid', value: 0 };
}

function canPlayCards(playedCards, lastPlay) {
  if (!lastPlay) return true; // First play of the round
  
  // Basic validation - same number of cards
  if (playedCards.length !== lastPlay.cards.length) {
    return false;
  }
  
  const playedHand = evaluateHand(playedCards);
  const lastHand = evaluateHand(lastPlay.cards);
  
  // Check if played hand is valid
  if (playedHand.rank === 'Invalid') {
    return false;
  }
  
  // Compare hand values (now includes suit consideration)
  console.log(`🔍 Comparing hands: Played=${playedHand.value}, Last=${lastHand.value}`);
  return playedHand.value > lastHand.value;
}

module.exports = {
  checkStraight,
  checkFlush,
  checkFullHouse,
  checkFourOfAKind,
  evaluateHand,
  evaluateFiveCardHand,
  canPlayCards
};

