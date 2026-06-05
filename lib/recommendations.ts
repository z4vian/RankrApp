/**
 * lib/recommendations.ts
 *
 * Category-specific recommendation fetchers for the Rankr "For You" feed.
 *
 * Each public function fetches recs from a third-party API, deduplicates
 * against the caller-supplied excludeIds set, applies a variety cap of
 * max 2 recs per source item, and returns a flat list capped at `limit`.
 *
 * All per-source fetches run in parallel via Promise.all; individual errors
 * are caught so one bad source never kills the batch.
 *
 * Trending fallbacks are provided for users with no ranked items.
 */

import { TMDB_API_KEY, RAWG_API_KEY } from '@/lib/apiKeys';
import {
  fetchTopRankedInList,
  fetchAllExternalIdsInList,
} from '@/lib/queries';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * Categories of media supported by the recommendation feed.
 *
 * Widened in Phase 5 to add 'books' (Google Books API) and 'tv' (TMDB TV
 * endpoints). The same string union is used by `lib/queries.ts` (UserList.
 * category and the helpers that take a category param) and by
 * `lib/recommendationsCache.ts` so that all category-keyed code paths share
 * one source of truth.
 */
export type RecCategory = 'movies' | 'games' | 'music' | 'books' | 'tv';

/** Unified recommendation item used across all category feeds. */
export type RecItem = {
  external_id: string;
  title: string;
  /**
   * Per-category subtitle:
   *   - movies / tv: release year (e.g. "2024")
   *   - games:       release year
   *   - music:       artist name
   *   - books:       comma-joined authors
   */
  subtitle: string | null;
  image_url: string | null;
  category: RecCategory;
  /** Populated for per-source recs; null for trending fallbacks. */
  because_of: { external_id: string; title: string } | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a full TMDB poster URL from a poster_path fragment. */
function tmdbPoster(posterPath: string | null | undefined): string | null {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

/** Extract a 4-digit year from a date string like "2023-07-14". */
function yearFrom(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : null;
}

/**
 * Deduplicate an array of RecItems by external_id, preserving first occurrence.
 * Also filters out any item whose external_id is in excludeIds.
 */
function dedup(items: RecItem[], excludeIds: string[]): RecItem[] {
  const seen = new Set<string>(excludeIds);
  const result: RecItem[] = [];
  for (const item of items) {
    if (seen.has(item.external_id)) continue;
    seen.add(item.external_id);
    result.push(item);
  }
  return result;
}

/**
 * Apply a variety cap: for each unique source (because_of.external_id),
 * keep at most `cap` recommendations. Items with because_of === null are
 * always kept (trending fallbacks, etc.).
 */
function varietyCap(items: RecItem[], cap: number = 2): RecItem[] {
  const counts = new Map<string, number>();
  const result: RecItem[] = [];
  for (const item of items) {
    if (item.because_of === null) {
      result.push(item);
      continue;
    }
    const sourceId = item.because_of.external_id;
    const count = counts.get(sourceId) ?? 0;
    if (count >= cap) continue;
    counts.set(sourceId, count + 1);
    result.push(item);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Movie recommendations
// ---------------------------------------------------------------------------

/** Raw TMDB /recommendations or /similar result item */
interface TmdbMovieResult {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
}

interface TmdbMovieListResponse {
  results?: TmdbMovieResult[];
}

async function fetchTmdbMovieRecs(
  tmdbId: string,
  endpoint: 'recommendations' | 'similar'
): Promise<TmdbMovieResult[]> {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/${endpoint}?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: TmdbMovieListResponse = await res.json();
  return json.results ?? [];
}

/**
 * Fetch movie recommendations based on the user's top-ranked movies.
 * Uses TMDB /movie/{id}/recommendations with /movie/{id}/similar as fallback
 * when the recommendations endpoint returns fewer than 3 results.
 *
 * @param sources    User's top-ranked movies (external_id = TMDB movie ID)
 * @param excludeIds TMDB IDs already in the user's lists (for dedup)
 * @param limit      Max items to return (default 30)
 */
export async function fetchMovieRecommendations(
  sources: { external_id: string; title: string }[],
  excludeIds: string[],
  limit: number = 30
): Promise<RecItem[]> {
  // Guard: filter out items with falsy external_id before making any API calls.
  const validSources = sources.filter((s) => s.external_id);
  if (validSources.length === 0) return fetchTrendingMovies(limit);

  const perSourceResults = await Promise.all(
    validSources.map(async (source) => {
      try {
        let results = await fetchTmdbMovieRecs(source.external_id, 'recommendations');
        // Fallback to /similar when recommendations are sparse
        if (results.length < 3) {
          const similar = await fetchTmdbMovieRecs(source.external_id, 'similar');
          results = [...results, ...similar];
        }
        return results.map((r): RecItem => ({
          external_id: String(r.id),
          title: r.title ?? 'Unknown',
          subtitle: yearFrom(r.release_date),
          image_url: tmdbPoster(r.poster_path),
          category: 'movies',
          because_of: { external_id: source.external_id, title: source.title },
        }));
      } catch (err) {
        console.error('[rec] fetchMovieRecommendations source error', source.external_id, err);
        return [];
      }
    })
  );

  const flat = perSourceResults.flat();
  const capped = varietyCap(flat, 2);
  const deduped = dedup(capped, excludeIds);
  return deduped.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Game recommendations
// ---------------------------------------------------------------------------

/** Raw RAWG /games/{id}/suggested result item */
interface RawgGameResult {
  id: number;
  name?: string;
  background_image?: string | null;
  released?: string | null;
}

interface RawgGameListResponse {
  results?: RawgGameResult[];
}

/**
 * Fetch game recommendations based on the user's top-ranked games.
 * Uses the RAWG /games/{id}/suggested endpoint.
 *
 * @param sources    User's top-ranked games (external_id = RAWG numeric game ID)
 * @param excludeIds RAWG IDs already in the user's lists (for dedup)
 * @param limit      Max items to return (default 30)
 */
export async function fetchGameRecommendations(
  sources: { external_id: string; title: string }[],
  excludeIds: string[],
  limit: number = 30
): Promise<RecItem[]> {
  // Guard: filter out items with falsy external_id before making any API calls.
  const validSources = sources.filter((s) => s.external_id);
  if (validSources.length === 0) return fetchTrendingGames(limit);

  const perSourceResults = await Promise.all(
    validSources.map(async (source) => {
      try {
        // external_id is the RAWG numeric game ID (e.g. "3498"); the /suggested
        // endpoint expects this numeric id, not a slug.
        const url = `https://api.rawg.io/api/games/${source.external_id}/suggested?key=${RAWG_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error('[rec] fetchGameRecommendations HTTP error', source.external_id, res.status);
          return [];
        }
        const json: RawgGameListResponse = await res.json();
        const results = json.results ?? [];
        if (results.length === 0) {
          console.warn('[rec] fetchGameRecommendations: RAWG /suggested returned empty results for id', source.external_id);
        }
        return results.map((r): RecItem => ({
          external_id: String(r.id),
          title: r.name ?? 'Unknown',
          subtitle: yearFrom(r.released),
          image_url: r.background_image ?? null,
          category: 'games',
          because_of: { external_id: source.external_id, title: source.title },
        }));
      } catch (err) {
        console.error('[rec] fetchGameRecommendations source error', source.external_id, err);
        return [];
      }
    })
  );

  const flat = perSourceResults.flat();
  const capped = varietyCap(flat, 2);
  const deduped = dedup(capped, excludeIds);
  return deduped.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Music recommendations
// ---------------------------------------------------------------------------

/** iTunes lookup/search result item */
interface ItunesTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  artistId?: number;
  kind?: string;
  wrapperType?: string;
}

interface ItunesLookupResponse {
  resultCount?: number;
  results?: ItunesTrack[];
}

async function itunesLookup(id: string | number, extraParams = ''): Promise<ItunesTrack[]> {
  const url = `https://itunes.apple.com/lookup?id=${id}${extraParams}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: ItunesLookupResponse = await res.json();
  return json.results ?? [];
}

async function itunesSearch(term: string, params = ''): Promise<ItunesTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song${params}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: ItunesLookupResponse = await res.json();
  return json.results ?? [];
}

function itunesToRecItem(
  track: ItunesTrack,
  because_of: RecItem['because_of']
): RecItem | null {
  // Skip non-track results (e.g. artist entries returned by lookup)
  if (!track.trackId) return null;
  const artworkUrl = track.artworkUrl100
    ? track.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
    : null;
  return {
    external_id: String(track.trackId),
    title: track.trackName ?? 'Unknown',
    subtitle: track.artistName ?? null,
    image_url: artworkUrl,
    category: 'music',
    because_of,
  };
}

/**
 * Fetch music recommendations based on the user's top-ranked tracks.
 *
 * Strategy per source track:
 *  1. Lookup the source track to get artistId and primaryGenreName.
 *  2. Fetch other songs by the same artist (up to 5).
 *  3. Fetch genre-similar songs via iTunes search (up to 5).
 *
 * @param sources    User's top-ranked tracks (external_id = iTunes trackId)
 * @param excludeIds iTunes trackIds already in the user's lists
 * @param limit      Max items to return (default 30)
 */
export async function fetchMusicRecommendations(
  sources: { external_id: string; title: string }[],
  excludeIds: string[],
  limit: number = 30
): Promise<RecItem[]> {
  // Guard: filter out items with falsy external_id before making any API calls.
  const validSources = sources.filter((s) => s.external_id);
  if (validSources.length === 0) return fetchTrendingMusic(limit);

  const perSourceResults = await Promise.all(
    validSources.map(async (source) => {
      try {
        // 1. Look up source track for artistId and genre
        const lookupResults = await itunesLookup(source.external_id);
        const sourceTrack = lookupResults.find(
          (r) => r.trackId != null || r.wrapperType === 'track'
        );
        if (!sourceTrack) return [];

        const artistId = sourceTrack.artistId;
        const genre = sourceTrack.primaryGenreName;
        const becauseOf = { external_id: source.external_id, title: source.title };

        // 2. Fetch songs by same artist
        const artistTracks = artistId
          ? await itunesLookup(artistId, '&entity=song&limit=5')
          : [];

        // 3. Fetch genre-similar songs
        const genreTracks = genre
          ? await itunesSearch(genre, '&limit=5')
          : [];

        const combined = [...artistTracks, ...genreTracks];
        const items: RecItem[] = [];
        for (const track of combined) {
          const item = itunesToRecItem(track, becauseOf);
          if (item && item.external_id !== source.external_id) {
            items.push(item);
          }
        }
        return items;
      } catch (err) {
        console.error('[rec] fetchMusicRecommendations source error', source.external_id, err);
        return [];
      }
    })
  );

  const flat = perSourceResults.flat();
  const capped = varietyCap(flat, 2);
  const deduped = dedup(capped, excludeIds);
  return deduped.slice(0, limit);
}

// ---------------------------------------------------------------------------
// TV recommendations (Phase 5)
// ---------------------------------------------------------------------------

/** Raw TMDB /tv/{id}/recommendations or /tv/{id}/similar result item */
interface TmdbTvResult {
  id: number;
  name?: string;
  first_air_date?: string | null;
  poster_path?: string | null;
  overview?: string;
}

interface TmdbTvListResponse {
  results?: TmdbTvResult[];
}

async function fetchTmdbTvRecs(
  tvId: string,
  endpoint: 'recommendations' | 'similar'
): Promise<TmdbTvResult[]> {
  const url = `https://api.themoviedb.org/3/tv/${tvId}/${endpoint}?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: TmdbTvListResponse = await res.json();
  return json.results ?? [];
}

/**
 * Fetch TV-show recommendations based on the user's top-ranked shows.
 * Mirrors the movie strategy: TMDB /tv/{id}/recommendations preferred,
 * falls back to /tv/{id}/similar when recommendations are sparse.
 *
 * @param sources    User's top-ranked TV shows (external_id = TMDB TV ID)
 * @param excludeIds TMDB TV IDs already in the user's lists (for dedup)
 * @param limit      Max items to return (default 30)
 */
export async function fetchTvRecommendations(
  sources: { external_id: string; title: string }[],
  excludeIds: string[],
  limit: number = 30
): Promise<RecItem[]> {
  const validSources = sources.filter((s) => s.external_id);
  if (validSources.length === 0) return fetchTrendingTv(limit);

  const perSourceResults = await Promise.all(
    validSources.map(async (source) => {
      try {
        let results = await fetchTmdbTvRecs(source.external_id, 'recommendations');
        if (results.length < 3) {
          const similar = await fetchTmdbTvRecs(source.external_id, 'similar');
          results = [...results, ...similar];
        }
        return results.map((r): RecItem => ({
          external_id: String(r.id),
          title: r.name ?? 'Unknown',
          subtitle: yearFrom(r.first_air_date),
          image_url: tmdbPoster(r.poster_path),
          category: 'tv',
          because_of: { external_id: source.external_id, title: source.title },
        }));
      } catch (err) {
        console.error('[rec] fetchTvRecommendations source error', source.external_id, err);
        return [];
      }
    })
  );

  const flat = perSourceResults.flat();
  const capped = varietyCap(flat, 2);
  const deduped = dedup(capped, excludeIds);
  return deduped.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Book recommendations (Phase 5)
// ---------------------------------------------------------------------------

/** Raw Google Books volume shape (subset of what /volumes returns). */
interface GoogleBookVolumeInfo {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
  categories?: string[];
  industryIdentifiers?: { type?: string; identifier?: string }[];
}

interface GoogleBookVolume {
  id?: string;
  volumeInfo?: GoogleBookVolumeInfo;
}

interface GoogleBooksResponse {
  items?: GoogleBookVolume[];
  totalItems?: number;
}

/**
 * Google Books returns thumbnails as http://; upgrade to https:// so RN's
 * Image component on iOS doesn't refuse to load them under ATS.
 */
function upgradeBookImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

async function googleBooksSearch(
  q: string,
  maxResults: number = 10
): Promise<GoogleBookVolume[]> {
  // Google Books `/volumes?q=...` is keyless for basic search. We cap at 40
  // (the API max) but typically pass a smaller maxResults per call.
  const capped = Math.max(1, Math.min(40, maxResults));
  const url =
    `https://www.googleapis.com/books/v1/volumes` +
    `?q=${encodeURIComponent(q)}&maxResults=${capped}&printType=books`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: GoogleBooksResponse = await res.json();
  return json.items ?? [];
}

function googleBookToRecItem(
  vol: GoogleBookVolume,
  because_of: RecItem['because_of']
): RecItem | null {
  const id = vol.id;
  const info = vol.volumeInfo;
  if (!id || !info) return null;
  // Skip results without a title — they're unusable in the UI.
  if (!info.title) return null;
  return {
    external_id: id,
    title: info.title,
    subtitle: (info.authors ?? []).join(', ') || null,
    image_url: upgradeBookImage(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    category: 'books',
    because_of,
  };
}

/**
 * Fetch book recommendations based on the user's top-ranked books.
 *
 * Strategy per source book:
 *  1. Lookup the source volume to get authors + categories.
 *  2. Search "by the same author" via `inauthor:{author}` (up to 5 results).
 *  3. Search "by category/genre" via the first category string (up to 5).
 *
 * Google Books has no native "similar books" endpoint, so the search-based
 * approach is the standard workaround.
 *
 * @param sources    User's top-ranked books (external_id = Google Books volume ID)
 * @param excludeIds Volume IDs already in the user's lists (for dedup)
 * @param limit      Max items to return (default 30)
 */
export async function fetchBookRecommendations(
  sources: { external_id: string; title: string }[],
  excludeIds: string[],
  limit: number = 30
): Promise<RecItem[]> {
  const validSources = sources.filter((s) => s.external_id);
  if (validSources.length === 0) return fetchTrendingBooks(limit);

  const perSourceResults = await Promise.all(
    validSources.map(async (source) => {
      try {
        // Step 1: look up the source volume to discover authors + categories.
        const lookupUrl =
          `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(source.external_id)}`;
        const lookupRes = await fetch(lookupUrl);
        if (!lookupRes.ok) {
          console.error(
            '[rec] fetchBookRecommendations lookup HTTP error',
            source.external_id,
            lookupRes.status
          );
          return [];
        }
        const lookup: GoogleBookVolume = await lookupRes.json();
        const info = lookup.volumeInfo;
        const becauseOf = { external_id: source.external_id, title: source.title };

        const firstAuthor = info?.authors?.[0];
        const firstCategory = info?.categories?.[0];

        // Step 2+3: parallel author + category searches.
        const [authorBooks, categoryBooks] = await Promise.all([
          firstAuthor ? googleBooksSearch(`inauthor:"${firstAuthor}"`, 5) : Promise.resolve([]),
          firstCategory ? googleBooksSearch(`subject:"${firstCategory}"`, 5) : Promise.resolve([]),
        ]);

        const items: RecItem[] = [];
        for (const vol of [...authorBooks, ...categoryBooks]) {
          const item = googleBookToRecItem(vol, becauseOf);
          // Filter the source book itself out — we only want recommendations.
          if (item && item.external_id !== source.external_id) {
            items.push(item);
          }
        }
        return items;
      } catch (err) {
        console.error('[rec] fetchBookRecommendations source error', source.external_id, err);
        return [];
      }
    })
  );

  const flat = perSourceResults.flat();
  const capped = varietyCap(flat, 2);
  const deduped = dedup(capped, excludeIds);
  return deduped.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Trending fallbacks (new/empty users)
// ---------------------------------------------------------------------------

/**
 * Trending movies this week via TMDB trending endpoint.
 * because_of is null for all trending results.
 */
export async function fetchTrendingMovies(limit: number = 30): Promise<RecItem[]> {
  try {
    const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json: TmdbMovieListResponse = await res.json();
    const results = json.results ?? [];
    return results.slice(0, limit).map((r): RecItem => ({
      external_id: String(r.id),
      title: r.title ?? 'Unknown',
      subtitle: yearFrom(r.release_date),
      image_url: tmdbPoster(r.poster_path),
      category: 'movies',
      because_of: null,
    }));
  } catch (err) {
    console.error('[fetchTrendingMovies]', err);
    return [];
  }
}

/**
 * Popular recent games via RAWG, ordered by -added (popularity), filtered to
 * a rolling 1-year window ending today. The date range is computed dynamically
 * so the feed stays current as time passes (previously hardcoded 2024–2025 was
 * already stale and excluding games released in 2026).
 */
export async function fetchTrendingGames(limit: number = 30): Promise<RecItem[]> {
  try {
    // Rolling window: 1 year ago → today (RAWG expects YYYY-MM-DD).
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dateRange = `${fmt(oneYearAgo)},${fmt(today)}`;

    const url =
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}` +
      `&ordering=-added&page_size=${limit}&dates=${dateRange}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[rec] fetchTrendingGames HTTP error', res.status);
      return [];
    }
    const json: RawgGameListResponse = await res.json();
    const results = json.results ?? [];
    if (results.length === 0) {
      console.warn('[rec] fetchTrendingGames: RAWG returned empty results (dateRange:', dateRange, ')');
    }
    return results.slice(0, limit).map((r): RecItem => ({
      external_id: String(r.id),
      title: r.name ?? 'Unknown',
      subtitle: yearFrom(r.released),
      image_url: r.background_image ?? null,
      category: 'games',
      because_of: null,
    }));
  } catch (err) {
    console.error('[rec] fetchTrendingGames', err);
    return [];
  }
}

/**
 * Popular music via iTunes search.
 * iTunes has no official trending endpoint so we search for a broad popular
 * term and return the top results. because_of is null for all trending results.
 */
export async function fetchTrendingMusic(limit: number = 30): Promise<RecItem[]> {
  try {
    const tracks = await itunesSearch('top hits', `&limit=${limit}`);
    return tracks
      .filter((t) => t.trackId != null)
      .slice(0, limit)
      .map((t): RecItem => {
        const artworkUrl = t.artworkUrl100
          ? t.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
          : null;
        return {
          external_id: String(t.trackId),
          title: t.trackName ?? 'Unknown',
          subtitle: t.artistName ?? null,
          image_url: artworkUrl,
          category: 'music',
          because_of: null,
        };
      });
  } catch (err) {
    console.error('[fetchTrendingMusic]', err);
    return [];
  }
}

/**
 * Trending TV shows this week via TMDB trending endpoint.
 * because_of is null for all trending results.
 */
export async function fetchTrendingTv(limit: number = 30): Promise<RecItem[]> {
  try {
    const url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[rec] fetchTrendingTv HTTP error', res.status);
      return [];
    }
    const json: TmdbTvListResponse = await res.json();
    const results = json.results ?? [];
    return results.slice(0, limit).map((r): RecItem => ({
      external_id: String(r.id),
      title: r.name ?? 'Unknown',
      subtitle: yearFrom(r.first_air_date),
      image_url: tmdbPoster(r.poster_path),
      category: 'tv',
      because_of: null,
    }));
  } catch (err) {
    console.error('[fetchTrendingTv]', err);
    return [];
  }
}

/**
 * Popular books via Google Books search. There's no official trending /
 * bestseller endpoint, so we search a broad popularity term ("bestseller")
 * and take the top results.
 *
 * because_of is null for all trending results.
 */
export async function fetchTrendingBooks(limit: number = 30): Promise<RecItem[]> {
  try {
    const volumes = await googleBooksSearch('bestseller', Math.min(40, Math.max(1, limit)));
    if (volumes.length === 0) {
      console.warn('[rec] fetchTrendingBooks: Google Books returned no items');
    }
    const out: RecItem[] = [];
    for (const vol of volumes) {
      const item = googleBookToRecItem(vol, null);
      if (item) out.push(item);
      if (out.length >= limit) break;
    }
    return out;
  } catch (err) {
    console.error('[fetchTrendingBooks]', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Per-list recommendation wrapper (v2 "For You" per-list feed)
// ---------------------------------------------------------------------------

/**
 * Result shape returned by fetchRecommendationsForList.
 * The UI uses `is_trending` to decide whether to show
 * "Because you liked X" or "Trending in <category>" header copy.
 */
export type RecsForList = {
  list_id: string;
  list_title: string;
  category: RecCategory;
  /** Already deduped + variety-capped items. */
  items: RecItem[];
  /**
   * true when the list had zero ranked items and we fell back to the
   * trending endpoint for this category.
   */
  is_trending: boolean;
};

/**
 * Fetch recommendations for ONE specific list.
 *
 * Internally:
 *  1. Calls fetchTopRankedInList(listId, 10) to get source items.
 *  2. Calls fetchAllExternalIdsInList(listId) for the exclude set.
 *  3. Dispatches to fetchMovieRecommendations / fetchGameRecommendations /
 *     fetchMusicRecommendations based on category.
 *  4. Falls back to the matching trending helper when sources is empty,
 *     and sets is_trending = true so the UI can render appropriate copy.
 *
 * Never throws — returns { items: [], is_trending: false } on unexpected
 * errors so the UI always receives a valid shape.
 *
 * @param listId     UUID of the list in Supabase.
 * @param listTitle  Display name of the list (passed through to the result).
 * @param category   Category of the list — determines which API is called.
 * @param limit      Maximum number of recommendation items to return (default 20).
 */
export async function fetchRecommendationsForList(
  listId: string,
  listTitle: string,
  category: RecCategory,
  limit: number = 20
): Promise<RecsForList> {
  try {
    // Fetch sources and exclude-set in parallel.
    const [sources, excludeIds] = await Promise.all([
      fetchTopRankedInList(listId, 10),
      fetchAllExternalIdsInList(listId),
    ]);

    const isTrending = sources.length === 0;

    let items: RecItem[];
    switch (category) {
      case 'movies':
        items = await fetchMovieRecommendations(sources, excludeIds, limit);
        break;
      case 'games':
        items = await fetchGameRecommendations(sources, excludeIds, limit);
        break;
      case 'music':
        items = await fetchMusicRecommendations(sources, excludeIds, limit);
        break;
      case 'tv':
        items = await fetchTvRecommendations(sources, excludeIds, limit);
        break;
      case 'books':
        items = await fetchBookRecommendations(sources, excludeIds, limit);
        break;
      default: {
        // Exhaustive check — TypeScript narrows `category` to `never` here.
        const _exhaustive: never = category;
        console.error('[rec] fetchRecommendationsForList: unknown category', _exhaustive);
        items = [];
      }
    }

    return { list_id: listId, list_title: listTitle, category, items, is_trending: isTrending };
  } catch (err) {
    console.error('[rec] fetchRecommendationsForList', listId, err);
    return { list_id: listId, list_title: listTitle, category, items: [], is_trending: false };
  }
}
