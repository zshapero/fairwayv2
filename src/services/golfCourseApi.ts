/**
 * Typed client for golfcourseapi.com.
 *
 * Docs: https://api.golfcourseapi.com/docs/api
 *
 * Auth: send `Authorization: Key <API_KEY>` on every request.
 * The free tier is limited to 300 requests / day; rate-limit responses
 * are surfaced to callers so the UI can show a useful message.
 */

const BASE_URL = "https://api.golfcourseapi.com/v1";

/** True when the API key environment variable is populated. Never leaks the key itself. */
export function hasApiKey(): boolean {
  const key = process.env.EXPO_PUBLIC_GOLF_COURSE_API_KEY;
  return typeof key === "string" && key.length > 0;
}

export class GolfCourseApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "missing_key"
      | "unauthorized"
      | "rate_limited"
      | "not_found"
      | "network"
      | "server"
      | "unknown",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GolfCourseApiError";
  }
}

export interface ApiHole {
  par: number;
  yardage: number;
  handicap: number;
}

export interface ApiTee {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  bogey_rating?: number;
  total_yards: number;
  total_meters?: number;
  number_of_holes: number;
  par_total: number;
  front_course_rating?: number;
  front_slope_rating?: number;
  front_bogey_rating?: number;
  back_course_rating?: number;
  back_slope_rating?: number;
  back_bogey_rating?: number;
  holes: readonly ApiHole[];
}

export interface ApiLocation {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface ApiCourseSummary {
  id: number;
  club_name: string;
  course_name: string;
  location?: ApiLocation;
}

export interface ApiCourseDetail extends ApiCourseSummary {
  tees?: {
    male?: readonly ApiTee[];
    female?: readonly ApiTee[];
  };
}

export interface ApiSearchResponse {
  courses: readonly ApiCourseSummary[];
}

export interface Club {
  /** Stable client-side id derived from the club name. */
  id: string;
  name: string;
  location?: ApiLocation;
  courses: readonly ApiCourseSummary[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.EXPO_PUBLIC_GOLF_COURSE_API_KEY;
  if (!key) {
    throw new GolfCourseApiError(
      "GolfCourseAPI key is missing. Set EXPO_PUBLIC_GOLF_COURSE_API_KEY in your environment.",
      "missing_key",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Key ${key}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new GolfCourseApiError(
      `Could not reach GolfCourseAPI: ${err instanceof Error ? err.message : String(err)}`,
      "network",
    );
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  const status = response.status;
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    // ignore
  }

  if (status === 401 || status === 403) {
    throw new GolfCourseApiError(
      "GolfCourseAPI rejected the API key. Double-check EXPO_PUBLIC_GOLF_COURSE_API_KEY.",
      "unauthorized",
      status,
    );
  }
  if (status === 429) {
    throw new GolfCourseApiError(
      "GolfCourseAPI rate limit hit (free tier is 300 requests/day). Try again tomorrow or upgrade the key.",
      "rate_limited",
      status,
    );
  }
  if (status === 404) {
    throw new GolfCourseApiError("Course not found.", "not_found", status);
  }
  if (status >= 500) {
    throw new GolfCourseApiError(
      `GolfCourseAPI server error (${status}). Try again shortly.`,
      "server",
      status,
    );
  }
  throw new GolfCourseApiError(
    `Unexpected GolfCourseAPI error (${status}): ${detail || "no body"}`,
    "unknown",
    status,
  );
}

function clubIdFor(clubName: string): string {
  return clubName.trim().toLowerCase().replace(/\s+/g, "-");
}

function groupByClub(courses: readonly ApiCourseSummary[]): Club[] {
  const map = new Map<string, Club>();
  for (const course of courses) {
    const id = clubIdFor(course.club_name);
    const existing = map.get(id);
    if (existing) {
      map.set(id, { ...existing, courses: [...existing.courses, course] });
    } else {
      map.set(id, {
        id,
        name: course.club_name,
        location: course.location,
        courses: [course],
      });
    }
  }
  return Array.from(map.values());
}

/**
 * Search for golf clubs matching the supplied free-text query. The underlying
 * GolfCourseAPI endpoint returns courses; results are grouped by club name so
 * the UI can present clubs and their courses hierarchically.
 *
 * Returns an empty array for blank queries (so callers can wire this directly
 * to a search input without burning rate limits on empty input).
 */
export async function searchClubs(query: string): Promise<Club[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const result = await request<ApiSearchResponse>(
    `/search?search_query=${encodeURIComponent(trimmed)}`,
  );
  return groupByClub(result.courses ?? []);
}

/**
 * Fetch a club's full details, including all courses that belong to it.
 *
 * GolfCourseAPI is keyed on courses rather than clubs, so this function
 * searches by the club name (the `clubId` produced by `searchClubs`) and
 * returns the matching club entry, or null if none match.
 */
export async function getClub(clubId: string): Promise<Club | null> {
  const trimmed = clubId.trim();
  if (trimmed.length === 0) return null;
  // Convert our slug back into something the search endpoint understands.
  const query = trimmed.replace(/-/g, " ");
  const result = await request<ApiSearchResponse>(
    `/search?search_query=${encodeURIComponent(query)}`,
  );
  const clubs = groupByClub(result.courses ?? []);
  return clubs.find((c) => c.id === trimmed) ?? null;
}

/**
 * Fetch a single course's full details, including every tee and the per-hole
 * par / yardage / handicap data.
 */
export async function getCourse(courseId: string): Promise<ApiCourseDetail> {
  const trimmed = courseId.trim();
  if (trimmed.length === 0) {
    throw new GolfCourseApiError("courseId is required", "unknown");
  }
  const result = await request<{ course: ApiCourseDetail } | ApiCourseDetail>(
    `/courses/${encodeURIComponent(trimmed)}`,
  );
  // The API has historically returned both shapes; normalise to the detail object.
  if ("course" in result && (result as { course: ApiCourseDetail }).course) {
    return (result as { course: ApiCourseDetail }).course;
  }
  return result as ApiCourseDetail;
}

/** Cache key helpers for TanStack Query. Exposed so screens stay consistent. */
export const golfCourseQueryKeys = {
  all: ["golfCourseApi"] as const,
  search: (query: string) => ["golfCourseApi", "search", query.trim().toLowerCase()] as const,
  club: (clubId: string) => ["golfCourseApi", "club", clubId] as const,
  course: (courseId: string) => ["golfCourseApi", "course", courseId] as const,
};

/** 24 hours expressed in milliseconds; matches the staleTime guidance in the spec. */
export const GOLF_COURSE_STALE_TIME_MS = 24 * 60 * 60 * 1000;
