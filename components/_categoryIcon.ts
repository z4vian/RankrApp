import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Maps a Rankr category to its Ionicon name. Internal — not exported from the barrel.
 * Phase 5 update: switched to outline variants and added books/tv.
 */
export function categoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case 'movies': return 'film-outline';
    case 'games': return 'game-controller-outline';
    case 'music': return 'musical-notes-outline';
    case 'books': return 'book-outline';
    case 'tv': return 'tv-outline';
    default: return 'pricetag-outline';
  }
}
