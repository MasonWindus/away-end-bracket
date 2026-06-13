import type {
  User,
  GroupPick,
  ThirdsPick,
  KnockoutPicks,
  LeaderboardEntry,
  GroupResult,
  ThirdsResult,
  KnockoutResult,
  AdminUser,
  PublicBracket,
  GroupCode,
  MatchResult,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---- Auth ----

export async function register(display_name: string, email: string): Promise<{ message: string }> {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ display_name, email }),
  });
}

export async function requestMagicLink(email: string): Promise<{ message: string }> {
  return apiFetch("/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function getMe(): Promise<User> {
  return apiFetch("/auth/me");
}

export async function logout(): Promise<{ message: string }> {
  return apiFetch("/auth/logout", { method: "POST" });
}

// ---- Picks ----

export async function getGroupPicks(): Promise<GroupPick[]> {
  const data = await apiFetch<{ picks: GroupPick[] }>("/picks/groups");
  return data.picks;
}

export async function updateGroupPick(
  code: GroupCode,
  pick: Omit<GroupPick, "group_code" | "locked">
): Promise<GroupPick> {
  const data = await apiFetch<{ pick: GroupPick }>(`/picks/groups/${code}`, {
    method: "PUT",
    body: JSON.stringify(pick),
  });
  return data.pick;
}

export async function getThirdsPick(): Promise<ThirdsPick> {
  return apiFetch<ThirdsPick>("/picks/thirds");
}

export async function updateThirdsPick(teams: string[]): Promise<ThirdsPick> {
  return apiFetch<ThirdsPick>("/picks/thirds", {
    method: "PUT",
    body: JSON.stringify({ teams }),
  });
}

export async function getKnockoutPicks(): Promise<KnockoutPicks> {
  return apiFetch<KnockoutPicks>("/picks/knockout");
}

export async function updateKnockoutPicks(
  picks: Omit<KnockoutPicks, "locked">
): Promise<KnockoutPicks> {
  return apiFetch<KnockoutPicks>("/picks/knockout", {
    method: "PUT",
    body: JSON.stringify(picks),
  });
}

export async function resetKnockoutPicks(): Promise<void> {
  await apiFetch("/picks/knockout", { method: "DELETE" });
}

export async function getKnockoutDeadline(): Promise<{ deadline: string | null; locked: boolean }> {
  return apiFetch("/picks/knockout-deadline");
}

// ---- Public ----

export async function getLeaderboard(
  page = 1,
  search = ""
): Promise<{ entries: LeaderboardEntry[]; pinned: LeaderboardEntry[]; total: number; page: number; totalPages: number }> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return apiFetch(`/leaderboard?${params}`);
}

export async function getUserBracket(userId: string): Promise<PublicBracket> {
  return apiFetch<PublicBracket>(`/brackets/${userId}`);
}

// ---- Admin ----

export async function submitGroupResult(
  code: GroupCode,
  result: Omit<GroupResult, "group_code">
): Promise<{ message: string }> {
  return apiFetch(`/admin/results/groups/${code}`, {
    method: "POST",
    body: JSON.stringify(result),
  });
}

export async function getGroupResults(): Promise<GroupResult[]> {
  const data = await apiFetch<{ results: GroupResult[] }>("/admin/results/groups");
  return data.results;
}

export async function submitThirdsResult(
  data: ThirdsResult
): Promise<{ message: string }> {
  return apiFetch("/admin/results/thirds", {
    method: "POST",
    // Map frontend field names to backend field names
    body: JSON.stringify({
      qualified_thirds: data.qualified_thirds,
      bracket_slots: data.bracket_slots,
    }),
  });
}

export async function getThirdsResult(): Promise<ThirdsResult | null> {
  return apiFetch<{ result: ThirdsResult }>("/admin/results/thirds")
    .then((data) => data.result)
    .catch(() => null);
}

export async function submitKnockoutResult(
  data: KnockoutResult
): Promise<{ message: string }> {
  // Map frontend format to backend format
  return apiFetch("/admin/results/knockout", {
    method: "POST",
    body: JSON.stringify({
      R32Winners: data.R32Winners,
      R16Winners: data.R16Winners,
      QFWinners: data.QFWinners,
      SFWinners: data.SFWinners,
      champion: data.champion,
    }),
  });
}

export async function getKnockoutResult(): Promise<KnockoutResult | null> {
  return apiFetch<{ result: KnockoutResult }>("/admin/results/knockout")
    .then((data) => data.result)
    .catch(() => null);
}

export async function recalculate(): Promise<{ message: string; processed: number }> {
  return apiFetch("/admin/recalculate", { method: "POST" });
}

export async function getAdminUsers(
  page = 1,
  limit = 50
): Promise<{ users: AdminUser[]; total: number; page: number; limit: number }> {
  return apiFetch<{ users: AdminUser[]; total: number; page: number; limit: number }>(
    `/admin/users?page=${page}&limit=${limit}`
  );
}

export async function getMatches(): Promise<MatchResult[]> {
  const data = await apiFetch<{ matches: MatchResult[] }>("/admin/matches");
  return data.matches;
}

export async function submitMatch(
  match: Omit<MatchResult, "match_id" | "entered_at">
): Promise<MatchResult> {
  const data = await apiFetch<{ match: MatchResult }>("/admin/matches", {
    method: "POST",
    body: JSON.stringify(match),
  });
  return data.match;
}

export async function deleteMatch(matchId: string): Promise<void> {
  await apiFetch(`/admin/matches/${encodeURIComponent(matchId)}`, {
    method: "DELETE",
  });
}

export async function pinUser(userId: string): Promise<{ message: string }> {
  return apiFetch(`/admin/users/${encodeURIComponent(userId)}/pin`, { method: "POST" });
}

export async function unpinUser(userId: string): Promise<{ message: string }> {
  return apiFetch(`/admin/users/${encodeURIComponent(userId)}/pin`, { method: "DELETE" });
}

// ---- Bug Reports ----

export async function submitBugReport(data: {
  description: string;
  page?: string;
}): Promise<{ message: string; id: string }> {
  return apiFetch("/bug-report", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface BugReport {
  id: string;
  description: string;
  page?: string;
  user_id?: string;
  display_name?: string;
  status: "open" | "resolved";
  created_at: string;
}

export async function getBugReports(): Promise<BugReport[]> {
  const data = await apiFetch<{ reports: BugReport[] }>("/admin/bug-reports");
  return data.reports;
}

export async function getKnockoutDeadlineConfig(): Promise<{ deadline: string | null }> {
  return apiFetch("/admin/config/knockout-deadline");
}

export async function setKnockoutDeadlineConfig(
  deadline: string | null
): Promise<{ deadline: string | null }> {
  return apiFetch("/admin/config/knockout-deadline", {
    method: "PUT",
    body: JSON.stringify({ deadline }),
  });
}

export async function updateBugReportStatus(
  id: string,
  status: "open" | "resolved"
): Promise<{ message: string }> {
  return apiFetch(`/admin/bug-reports/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}
