/**
 * lib/itemDetails.ts
 *
 * Per-category detail fetchers for the Rankr item detail screen.
 *
 * All functions return null (never throw) if the item cannot be loaded,
 * so the frontend can display a consistent error UI without try/catch.
 *
 * API coverage:
 *  - Movies: TMDB /movie/{id}?append_to_response=credits,watch/providers
 *  - Games:  RAWG /games/{id} + /games/{id}/screenshots
 *  - Music:  iTunes lookup?id={trackId}
 *  - TV:     TMDB /tv/{id}?append_to_response=credits,watch/providers,external_ids   (Phase 5)
 *  - Books:  Google Books /volumes/{volumeId}                                         (Phase 5)
 */

import { TMDB_API_KEY, RAWG_API_KEY } from '@/lib/apiKeys';

// ---------------------------------------------------------------------------
// Exported detail types
// ---------------------------------------------------------------------------

export type MovieDetail = {
  external_id: string;
  title: string;
  overview: string | null;
  image_url: string | null;
  release_year: string | null;
  runtime_minutes: number | null;
  cast: { name: string; character: string; profile_url: string | null }[];
  watch_providers: { name: string; logo_url: string | null }[];
  category: 'movies';
};

export type GameDetail = {
  external_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  release_year: string | null;
  platforms: string[];
  esrb_rating: string | null;
  screenshots: string[];
  category: 'games';
};

export type MusicDetail = {
  external_id: string;
  title: string;
  artist: string;
  album: string | null;
  image_url: string | null;
  preview_url: string | null;
  release_year: string | null;
  genre: string | null;
  category: 'music';
};

export type TvDetail = {
  external_id: string;
  /** `title` here corresponds to TMDB's `name` field on /tv/{id}. */
  title: string;
  overview: string | null;
  image_url: string | null;
  first_air_year: string | null;
  /** Pre-formatted label like "5 seasons, 62 episodes" or null when unknown. */
  episode_count_label: string | null;
  cast: { name: string; character: string; profile_url: string | null }[];
  watch_providers: { name: string; logo_url: string | null }[];
  category: 'tv';
};

export type BookDetail = {
  external_id: string;
  title: string;
  authors: string[];
  description: string | null;
  image_url: string | null;
  publish_year: string | null;
  page_count: number | null;
  categories: string[];
  /** First ISBN-13 if present, else ISBN-10, else null. */
  isbn: string | null;
  category: 'books';
};

/** Union of all detail types for exhaustive handling in the UI. */
export type ItemDetail = MovieDetail | GameDetail | MusicDetail | TvDetail | BookDetail;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function tmdbImageUrl(path: string | null | undefined, size = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function yearFrom(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Movie detail
// ---------------------------------------------------------------------------

/** Raw TMDB movie detail response (partial) */
interface TmdbMovieDetail {
  id?: number;
  title?: string;
  overview?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  credits?: {
    cast?: Array<{
      name?: string;
      character?: string;
      profile_path?: string | null;
    }>;
  };
  'watch/providers'?: {
    results?: {
      US?: {
        flatrate?: Array<{
          provider_name?: string;
          logo_path?: string | null;
        }>;
      };
    };
  };
}

/**
 * Fetch full movie details from TMDB, including cast (top 8) and US
 * streaming providers (flatrate only).
 *
 * @param tmdbId  TMDB numeric movie ID (stored as string in list_items.external_id)
 * @returns       MovieDetail or null if the request fails
 */
export async function fetchMovieDetail(tmdbId: string): Promise<MovieDetail | null> {
  try {
    const url =
      `https://api.themoviedb.org/3/movie/${tmdbId}` +
      `?api_key=${TMDB_API_KEY}&append_to_response=credits,watch%2Fproviders`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: TmdbMovieDetail = await res.json();

    // Cast — top 8 billed
    const cast = (data.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name ?? 'Unknown',
      character: c.character ?? '',
      profile_url: tmdbImageUrl(c.profile_path, 'w185'),
    }));

    // US flatrate streaming providers
    const usProviders =
      data['watch/providers']?.results?.US?.flatrate ?? [];
    const watch_providers = usProviders.map((p) => ({
      name: p.provider_name ?? 'Unknown',
      logo_url: tmdbImageUrl(p.logo_path, 'w92'),
    }));

    return {
      external_id: String(data.id ?? tmdbId),
      title: data.title ?? 'Unknown',
      overview: data.overview ?? null,
      image_url: tmdbImageUrl(data.poster_path),
      release_year: yearFrom(data.release_date),
      runtime_minutes: data.runtime ?? null,
      cast,
      watch_providers,
      category: 'movies',
    };
  } catch (err) {
    console.error('[fetchMovieDetail]', tmdbId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Game detail
// ---------------------------------------------------------------------------

interface RawgPlatformEntry {
  platform?: { name?: string };
}

interface RawgEsrb {
  name?: string;
}

interface RawgGameDetailResponse {
  id?: number;
  name?: string;
  description_raw?: string | null;
  background_image?: string | null;
  released?: string | null;
  platforms?: RawgPlatformEntry[];
  esrb_rating?: RawgEsrb | null;
}

interface RawgScreenshot {
  image?: string;
}

interface RawgScreenshotsResponse {
  results?: RawgScreenshot[];
}

/**
 * Fetch full game details from RAWG, including screenshots (up to 6).
 *
 * @param rawgId  RAWG numeric game ID (stored as string in list_items.external_id)
 * @returns       GameDetail or null if the request fails
 */
export async function fetchGameDetail(rawgId: string): Promise<GameDetail | null> {
  try {
    const [detailRes, screenshotsRes] = await Promise.all([
      fetch(`https://api.rawg.io/api/games/${rawgId}?key=${RAWG_API_KEY}`),
      fetch(`https://api.rawg.io/api/games/${rawgId}/screenshots?key=${RAWG_API_KEY}`),
    ]);

    if (!detailRes.ok) return null;
    const detail: RawgGameDetailResponse = await detailRes.json();

    const screenshots: string[] = [];
    if (screenshotsRes.ok) {
      const ssData: RawgScreenshotsResponse = await screenshotsRes.json();
      (ssData.results ?? []).slice(0, 6).forEach((s) => {
        if (s.image) screenshots.push(s.image);
      });
    }

    const platforms = (detail.platforms ?? [])
      .map((p) => p.platform?.name ?? '')
      .filter((name): name is string => name.length > 0);

    return {
      external_id: String(detail.id ?? rawgId),
      title: detail.name ?? 'Unknown',
      description: detail.description_raw ?? null,
      image_url: detail.background_image ?? null,
      release_year: yearFrom(detail.released),
      platforms,
      esrb_rating: detail.esrb_rating?.name ?? null,
      screenshots,
      category: 'games',
    };
  } catch (err) {
    console.error('[fetchGameDetail]', rawgId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Music detail
// ---------------------------------------------------------------------------

interface ItunesTrackDetail {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string | null;
  artworkUrl100?: string;
  previewUrl?: string | null;
  releaseDate?: string | null;
  primaryGenreName?: string | null;
  wrapperType?: string;
  kind?: string;
}

interface ItunesLookupResponse {
  resultCount?: number;
  results?: ItunesTrackDetail[];
}

/**
 * Fetch full music track details from iTunes.
 * Upgrades the artwork URL from 100x100 to 600x600.
 *
 * @param trackId  iTunes trackId (stored as string in list_items.external_id)
 * @returns        MusicDetail or null if the request fails
 */
export async function fetchMusicDetail(trackId: string): Promise<MusicDetail | null> {
  try {
    const url = `https://itunes.apple.com/lookup?id=${trackId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: ItunesLookupResponse = await res.json();

    // Find the track entry (results may include artist/album entries too)
    const track = (json.results ?? []).find(
      (r) => r.trackId != null
    );
    if (!track || !track.trackId) return null;

    const artworkUrl = track.artworkUrl100
      ? track.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
      : null;

    return {
      external_id: String(track.trackId),
      title: track.trackName ?? 'Unknown',
      artist: track.artistName ?? 'Unknown',
      album: track.collectionName ?? null,
      image_url: artworkUrl,
      preview_url: track.previewUrl ?? null,
      release_year: yearFrom(track.releaseDate),
      genre: track.primaryGenreName ?? null,
      category: 'music',
    };
  } catch (err) {
    console.error('[fetchMusicDetail]', trackId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// TV detail (Phase 5)
// ---------------------------------------------------------------------------

/** Raw TMDB /tv/{id} detail response (subset of fields we read). */
interface TmdbTvDetailResponse {
  id?: number;
  name?: string;
  overview?: string | null;
  poster_path?: string | null;
  first_air_date?: string | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  credits?: {
    cast?: Array<{
      name?: string;
      character?: string;
      profile_path?: string | null;
    }>;
  };
  'watch/providers'?: {
    results?: {
      US?: {
        flatrate?: Array<{
          provider_name?: string;
          logo_path?: string | null;
        }>;
      };
    };
  };
}

/**
 * Build a friendly episode-count label from TMDB's `number_of_seasons` and
 * `number_of_episodes`. Examples:
 *   1 season,  10 episodes
 *   5 seasons, 62 episodes
 *   1 episode  (when seasons is missing but episodes is known)
 *   null       (when both are missing)
 */
function tvEpisodeLabel(
  seasons: number | null | undefined,
  episodes: number | null | undefined
): string | null {
  if ((seasons == null || seasons <= 0) && (episodes == null || episodes <= 0)) {
    return null;
  }
  const parts: string[] = [];
  if (seasons != null && seasons > 0) {
    parts.push(`${seasons} ${seasons === 1 ? 'season' : 'seasons'}`);
  }
  if (episodes != null && episodes > 0) {
    parts.push(`${episodes} ${episodes === 1 ? 'episode' : 'episodes'}`);
  }
  return parts.join(', ');
}

/**
 * Fetch full TV-show details from TMDB, including cast (top 8) and US
 * streaming providers (flatrate only).
 *
 * @param tvId  TMDB numeric TV ID (stored as string in list_items.external_id)
 * @returns     TvDetail or null if the request fails
 */
export async function fetchTvDetail(tvId: string): Promise<TvDetail | null> {
  try {
    const url =
      `https://api.themoviedb.org/3/tv/${tvId}` +
      `?api_key=${TMDB_API_KEY}` +
      `&append_to_response=credits,watch%2Fproviders,external_ids`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: TmdbTvDetailResponse = await res.json();

    // Cast — top 8 billed
    const cast = (data.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name ?? 'Unknown',
      character: c.character ?? '',
      profile_url: tmdbImageUrl(c.profile_path, 'w185'),
    }));

    // US flatrate streaming providers
    const usProviders = data['watch/providers']?.results?.US?.flatrate ?? [];
    const watch_providers = usProviders.map((p) => ({
      name: p.provider_name ?? 'Unknown',
      logo_url: tmdbImageUrl(p.logo_path, 'w92'),
    }));

    return {
      external_id: String(data.id ?? tvId),
      title: data.name ?? 'Unknown',
      overview: data.overview ?? null,
      image_url: tmdbImageUrl(data.poster_path),
      first_air_year: yearFrom(data.first_air_date),
      episode_count_label: tvEpisodeLabel(data.number_of_seasons, data.number_of_episodes),
      cast,
      watch_providers,
      category: 'tv',
    };
  } catch (err) {
    console.error('[fetchTvDetail]', tvId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Book detail (Phase 5)
// ---------------------------------------------------------------------------

/** Raw Google Books /volumes/{id} response (subset of fields we read). */
interface GoogleBookDetailResponse {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string | null;
    publishedDate?: string | null;
    pageCount?: number | null;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    industryIdentifiers?: { type?: string; identifier?: string }[];
  };
}

/**
 * Google Books returns thumbnail URLs as `http://`; rewrite to `https://` so
 * iOS's App Transport Security doesn't refuse to load them.
 */
function upgradeBookImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

/**
 * Pick the best available ISBN from Google Books' identifiers array:
 * prefer ISBN_13, fall back to ISBN_10, else null.
 */
function pickIsbn(
  identifiers: { type?: string; identifier?: string }[] | undefined
): string | null {
  if (!identifiers || identifiers.length === 0) return null;
  const i13 = identifiers.find((x) => x.type === 'ISBN_13' && x.identifier);
  if (i13?.identifier) return i13.identifier;
  const i10 = identifiers.find((x) => x.type === 'ISBN_10' && x.identifier);
  return i10?.identifier ?? null;
}

/**
 * Fetch full book details from Google Books.
 *
 * @param volumeId  Google Books volume ID (stored as string in list_items.external_id)
 * @returns         BookDetail or null if the request fails
 */
export async function fetchBookDetail(volumeId: string): Promise<BookDetail | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: GoogleBookDetailResponse = await res.json();

    const info = data.volumeInfo;
    if (!info) return null;

    return {
      external_id: String(data.id ?? volumeId),
      title: info.title ?? 'Unknown',
      authors: Array.isArray(info.authors) ? info.authors.filter((a) => typeof a === 'string') : [],
      description: info.description ?? null,
      image_url: upgradeBookImage(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
      publish_year: yearFrom(info.publishedDate),
      page_count: typeof info.pageCount === 'number' ? info.pageCount : null,
      categories: Array.isArray(info.categories)
        ? info.categories.filter((c) => typeof c === 'string')
        : [],
      isbn: pickIsbn(info.industryIdentifiers),
      category: 'books',
    };
  } catch (err) {
    console.error('[fetchBookDetail]', volumeId, err);
    return null;
  }
}
