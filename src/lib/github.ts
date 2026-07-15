import snapshot from '../data/github-snapshot.json';

interface Repo {
  name: string;
  full_name?: string;
  language: string | null;
  stars: number;
  created_at: string;
  pushed_at: string;
  description?: string | null;
}

export interface RecentRepo {
  name: string;
  url: string;
  language: string | null;
  langColor: string;
  stars: number;
  description: string;
  updated: string; // relative, e.g. "3 mo ago"
}

export interface GithubStats {
  totalRepos: number;
  totalStars: number;
  followers: number;
  memberSinceYear: number;
  activeYears: number;
  busiestYear: { year: number; count: number };
  topLanguage: string;
  languages: { name: string; count: number; pct: number; color: string }[];
  reposPerYear: { year: number; count: number }[];
  recent: RecentRepo[];
  live: boolean;
}

const USER = 'ming-undefined';
const ORG = 'quiet-build';

/* Validated categorical palette for dark surface #0a0e15
   (dataviz six-checks: lightness band, chroma floor, CVD ΔE 14.9, contrast ≥3:1).
   Fixed assignment order; "Other" is a deliberate neutral outside the set. */
const LANG_COLORS = ['#c97c14', '#1f9dab', '#57a24d', '#d14a66', '#8563e0'];
const OTHER_COLOR = '#8b93a3';

/* Reference "now" for relative timestamps = the snapshot date, so the site is
   deterministic between the live fetch and the committed fallback. */
const NOW = new Date(`${snapshot.fetchedAt}T00:00:00Z`).getTime();

function relTime(iso: string): string {
  const diff = NOW - new Date(iso).getTime();
  const day = 86400e3;
  if (diff < 2 * day) return 'today';
  if (diff < 45 * day) return `${Math.round(diff / day)}d ago`;
  if (diff < 400 * day) return `${Math.round(diff / (30 * day))}mo ago`;
  return `${Math.round(diff / (365 * day))}y ago`;
}

function langColorFor(lang: string | null, ranked: Map<string, string>): string {
  if (!lang) return OTHER_COLOR;
  return ranked.get(lang) ?? OTHER_COLOR;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchLive(): Promise<{ repos: Repo[]; followers: number; memberSince: string }> {
  const [user, userRepos, orgRepos] = await Promise.all([
    fetchJson(`https://api.github.com/users/${USER}`),
    fetchJson(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`),
    fetchJson(`https://api.github.com/orgs/${ORG}/repos?per_page=100`),
  ]);
  const toRepo = (r: any): Repo => ({
    name: r.name,
    full_name: r.full_name,
    language: r.language,
    stars: r.stargazers_count,
    created_at: r.created_at,
    pushed_at: r.pushed_at,
    description: r.description,
  });
  return {
    repos: [...userRepos, ...orgRepos]
      .filter((r: any) => !r.fork && !r.private)
      .map(toRepo),
    followers: user.followers,
    memberSince: user.created_at,
  };
}

function aggregate(repos: Repo[], followers: number, memberSince: string, live: boolean): GithubStats {
  const langCounts = new Map<string, number>();
  for (const r of repos) {
    const l = r.language ?? 'Other';
    langCounts.set(l, (langCounts.get(l) ?? 0) + 1);
  }
  const sorted = [...langCounts.entries()]
    .filter(([name]) => name !== 'Other')
    .sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const otherCount =
    sorted.slice(5).reduce((s, [, c]) => s + c, 0) + (langCounts.get('Other') ?? 0);
  const total = repos.length;
  const languages = [
    ...top.map(([name, count], i) => ({
      name,
      count,
      pct: (count / total) * 100,
      color: LANG_COLORS[i],
    })),
    ...(otherCount > 0
      ? [{ name: 'Other', count: otherCount, pct: (otherCount / total) * 100, color: OTHER_COLOR }]
      : []),
  ];
  const rankedColors = new Map(languages.map((l) => [l.name, l.color]));

  const yearCounts = new Map<number, number>();
  for (const r of repos) {
    const y = Number(r.created_at.slice(0, 4));
    yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
  }
  const years = [...yearCounts.keys()];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const reposPerYear: { year: number; count: number }[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    reposPerYear.push({ year: y, count: yearCounts.get(y) ?? 0 });
  }
  const busiest = reposPerYear.reduce((a, b) => (b.count > a.count ? b : a), reposPerYear[0]);

  const recent: RecentRepo[] = [...repos]
    .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
    .slice(0, 12)
    .map((r) => ({
      name: r.name,
      url: `https://github.com/${r.full_name ?? `${USER}/${r.name}`}`,
      language: r.language,
      langColor: langColorFor(r.language, rankedColors),
      stars: r.stars,
      description: r.description?.trim() || 'No description yet — a quiet work in progress.',
      updated: relTime(r.pushed_at),
    }));

  return {
    totalRepos: total,
    totalStars: repos.reduce((s, r) => s + r.stars, 0),
    followers,
    memberSinceYear: Number(memberSince.slice(0, 4)),
    activeYears: new Date(NOW).getUTCFullYear() - Number(memberSince.slice(0, 4)),
    busiestYear: busiest,
    topLanguage: languages[0]?.name ?? '—',
    languages,
    reposPerYear,
    recent,
    live,
  };
}

let cached: GithubStats | null = null;

export async function getGithubStats(): Promise<GithubStats> {
  if (cached) return cached;
  try {
    const { repos, followers, memberSince } = await fetchLive();
    cached = aggregate(repos, followers, memberSince, true);
  } catch {
    cached = aggregate(
      snapshot.repos as Repo[],
      snapshot.followers,
      `${snapshot.memberSince}T00:00:00Z`,
      false
    );
  }
  return cached;
}
