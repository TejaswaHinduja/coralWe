import { coralQuery } from '../client.js'

export interface GithubDayActivity {
  date: string
  commits: number
  repos: string[]
  prs_opened: number
  prs_reviewed: number
  lines_added: number
  lines_deleted: number
}

export interface CodingSession {
  date: string
  repo: string
  start: string
  end: string
  hours: number
  late_night: boolean
}

// Confirmed columns from coral.columns WHERE schema_name='github' AND table_name='commits':
//   commit__author__date, repo, owner, stats__additions, stats__deletions, author__login
//
// github.commits requires WHERE owner = <constant> (the GitHub account login).
// We auto-detect it from github.user; override with GITHUB_USERNAME in .env.

function getOwner(): string {
  const fromEnv = process.env['GITHUB_USERNAME']
  if (fromEnv) return fromEnv

  const rows = coralQuery<{ login: string }>('SELECT login FROM github.user')
  const login = rows[0]?.login
  if (!login) throw new Error('Could not detect GitHub username. Set GITHUB_USERNAME in .env.')
  return login
}

export function fetchGithubActivity(days = 30): GithubDayActivity[] {
  const owner = getOwner()

  const commitRows = coralQuery<{
    date: string
    commits: number
    repos: string
    lines_added: number
    lines_deleted: number
  }>(`
    SELECT
      CAST(commit__author__date AS DATE)   AS date,
      COUNT(*)                             AS commits,
      ARRAY_AGG(DISTINCT repo)             AS repos,
      SUM(COALESCE(stats__additions, 0))   AS lines_added,
      SUM(COALESCE(stats__deletions, 0))   AS lines_deleted
    FROM github.commits
    WHERE owner = '${owner}'
      AND commit__author__date >= NOW() - INTERVAL '${days} days'
    GROUP BY CAST(commit__author__date AS DATE)
    ORDER BY date ASC
  `)

  // Pulls may require owner + repo — attempt it, skip gracefully if it fails
  const prsByDate = new Map<string, number>()
  try {
    const prRows = coralQuery<{ date: string; prs_opened: number }>(`
      SELECT
        CAST(created_at AS DATE) AS date,
        COUNT(*)                 AS prs_opened
      FROM github.pulls
      WHERE owner = '${owner}'
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY CAST(created_at AS DATE)
      ORDER BY date ASC
    `)
    for (const r of prRows) prsByDate.set(r.date, r.prs_opened)
  } catch {
    // pulls may require a repo filter too — fall through with 0 counts
  }

  return commitRows.map(row => ({
    date: row.date,
    commits: Number(row.commits),
    repos: parseArrayField(row.repos),
    prs_opened: prsByDate.get(row.date) ?? 0,
    prs_reviewed: 0,
    lines_added: Number(row.lines_added),
    lines_deleted: Number(row.lines_deleted),
  }))
}

export function fetchCodingSessions(days = 30): CodingSession[] {
  const owner = getOwner()

  const rows = coralQuery<{
    date: string
    repo: string
    session_start: string
    session_end: string
    commit_count: number
  }>(`
    SELECT
      CAST(commit__author__date AS DATE) AS date,
      repo,
      MIN(commit__author__date)          AS session_start,
      MAX(commit__author__date)          AS session_end,
      COUNT(*)                           AS commit_count
    FROM github.commits
    WHERE owner = '${owner}'
      AND commit__author__date >= NOW() - INTERVAL '${days} days'
    GROUP BY CAST(commit__author__date AS DATE), repo
    ORDER BY date, session_start ASC
  `)

  return rows.map(row => {
    const start = new Date(row.session_start)
    const end = new Date(row.session_end)
    const hours = Math.max(0.25, (end.getTime() - start.getTime()) / 3_600_000)
    const startHour = start.getHours()
    return {
      date: row.date,
      repo: row.repo,
      start: start.toTimeString().slice(0, 5),
      end: end.toTimeString().slice(0, 5),
      hours: Math.round(hours * 100) / 100,
      late_night: startHour >= 22 || startHour < 5,
    }
  })
}

function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try { return JSON.parse(value) as string[] } catch { return [value] }
  }
  return []
}
