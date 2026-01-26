/**
 * Get Gmail avatar URL from email address
 */
export function getGmailAvatar(email: string | null | undefined): string | null {
  if (!email || !email.includes('@gmail.com')) {
    return null;
  }
  
  try {
    // Try to get avatar from Firebase Auth if available
    // For Gmail, Firebase Auth usually provides photoURL
    // If not available, we can use Gravatar with email hash
    // For now, return null and let the caller handle fallback
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Get the first letter of a name for avatar display
 */
export function getInitialLetter(name: string | null | undefined): string {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return '?';
  }
  return name.trim().charAt(0).toUpperCase();
}

/**
 * Generate a poker-themed avatar based on user ID
 * Returns a consistent avatar for each user
 * If name is provided and no avatarUrl, returns first letter of name
 */
export function getPokerAvatar(
  userId: number | null | undefined, 
  avatarUrl?: string | null,
  name?: string | null | undefined
): string {
  // If user has a custom avatar URL, use it (but we'll check this in the component)
  // For fallback, use first letter of name if available
  if (name) {
    return getInitialLetter(name);
  }

  // Generate consistent avatar based on user ID
  if (!userId) {
    userId = 0;
  }

  // Poker-themed avatar emojis
  const pokerAvatars = [
    '🃏', // Joker
    '♠️', // Spades
    '♥️', // Hearts
    '♦️', // Diamonds
    '♣️', // Clubs
    '👑', // Crown
    '🎰', // Slot machine
    '💰', // Money bag
    '🎲', // Dice
    '🂡', // Ace of spades
    '🂱', // Ace of hearts
    '🃁', // Ace of diamonds
    '🃑', // Ace of clubs
    '🎴', // Playing card
    '🏆', // Trophy
    '💎', // Diamond
  ];

  // Use user ID to select avatar (consistent for same user)
  const avatarIndex = userId % pokerAvatars.length;
  return pokerAvatars[avatarIndex];
}

/**
 * Get avatar background gradient based on user ID
 */
export function getAvatarGradient(userId: number | null | undefined): string {
  if (!userId) {
    userId = 0;
  }

  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Pink-Yellow
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', // Cyan-Purple
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Light
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Rose
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Peach
    'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)', // Coral
    'linear-gradient(135deg, #c471ed 0%, #f64f59 100%)', // Purple-Red
    'linear-gradient(135deg, #12c2e9 0%, #c471ed 100%)', // Blue-Purple
    'linear-gradient(135deg, #fad961 0%, #f76b1c 100%)', // Orange
    'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)', // Teal-Purple
    'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)', // Lavender
    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', // Sky Blue
  ];

  return gradients[userId % gradients.length];
}

/**
 * Format user ID as 6-digit number (add 100000)
 */
export function formatUserId(userId: number | null | undefined): string {
  if (!userId) return '100000';
  return (userId + 100000).toString().padStart(6, '0');
}

