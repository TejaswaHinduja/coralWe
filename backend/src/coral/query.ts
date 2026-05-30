import { loadTable } from './loader.js'
import { isCoralSourceActive } from './client.js'
import { fetchGithubActivity, fetchCodingSessions } from './sources/github.js'
import { fetchCalendarMeetings } from './sources/calendar.js'

interface SleepRecord {
  date: string
  hours: number
  quality: 'good' | 'fair' | 'poor'
  bedtime: string
  restless: boolean
}

interface CodingSession {
  date: string
  repo: string
  hours: number
  late_night: boolean
}

interface MeetingRecord {
  date: string
  count: number
  total_hours: number
  types: string[]
}

interface InterruptionRecord {
  date: string
  total: number
  slack: number
  peak_hour: number
}

interface GithubRecord {
  date: string
  commits: number
  repos: string[]
  prs_opened: number
  prs_reviewed: number
}

interface ProductivityRecord {
  date: string
  score: number
  focus_sessions: number
  deep_work_hours: number
  tasks_completed: number
  tasks_added: number
}

export interface BehavioralMetrics {
  sleep: {
    avgHours_recent: number
    avgHours_baseline: number
    declinePercent: number
    poorDaysLast7: number
    avgBedtimeHour: number
  }
  coding: {
    lateNightLast7: number
    lateNightBaseline: number
    weekendSessions: number
    avgHoursPerDay_recent: number
  }
  meetings: {
    avgPerDay_recent: number
    avgPerDay_baseline: number
    increasePercent: number
    avgHoursPerDay_recent: number
    heavyDaysLast7: number
  }
  interruptions: {
    avgPerDay_recent: number
    avgPerDay_baseline: number
    increasePercent: number
  }
  contextSwitching: {
    avgReposPerDay_recent: number
    avgReposPerDay_baseline: number
  }
  productivity: {
    avgScore_recent: number
    avgScore_baseline: number
    declinePercent: number
    avgDeepWorkHours_recent: number
    avgTasksAdded_recent: number
    avgTasksCompleted_recent: number
    recentScores: Array<{ date: string; score: number; deepWorkHours: number }>
  }
  burnout: {
    score: number
    level: 'low' | 'moderate' | 'high' | 'critical'
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function bedtimeToHour(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const hour = (h ?? 0) + (m ?? 0) / 60
  // Treat midnight–6am as 24–30 to reflect late bedtimes correctly
  return hour < 6 ? hour + 24 : hour
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getUTCDay()
  return day === 0 || day === 6
}

function groupByDate<T extends { date: string }>(records: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of records) {
    const bucket = map.get(r.date) ?? []
    bucket.push(r)
    map.set(r.date, bucket)
  }
  return map
}

export function computeMetrics(): BehavioralMetrics {
  const sleep = loadTable<SleepRecord>('sleep').sort((a, b) => a.date.localeCompare(b.date))
  let meetings: MeetingRecord[]
  if (isCoralSourceActive('google_calendar')) {
    try {
      meetings = fetchCalendarMeetings(30).sort((a, b) => a.date.localeCompare(b.date))
    } catch {
      // Auth expired or credential issue — fall back to mock data
      meetings = loadTable<MeetingRecord>('meetings').sort((a, b) => a.date.localeCompare(b.date))
    }
  } else {
    meetings = loadTable<MeetingRecord>('meetings').sort((a, b) => a.date.localeCompare(b.date))
  }
  const interruptions = loadTable<InterruptionRecord>('interruptions').sort((a, b) => a.date.localeCompare(b.date))
  const productivity = loadTable<ProductivityRecord>('productivity').sort((a, b) => a.date.localeCompare(b.date))

  // Use live Coral data for GitHub if the source is connected; fall back to mock JSONL
  let github: GithubRecord[]
  let coding: CodingSession[]
  if (isCoralSourceActive('github')) {
    try {
      github = fetchGithubActivity(30).sort((a, b) => a.date.localeCompare(b.date))
      coding = fetchCodingSessions(30)
    } catch {
      github = loadTable<GithubRecord>('github_activity').sort((a, b) => a.date.localeCompare(b.date))
      coding = loadTable<CodingSession>('coding_sessions')
    }
  } else {
    github = loadTable<GithubRecord>('github_activity').sort((a, b) => a.date.localeCompare(b.date))
    coding = loadTable<CodingSession>('coding_sessions')
  }

  // Time windows
  const sleepLast7 = sleep.slice(-7)
  const sleepFirst14 = sleep.slice(0, 14)
  const recentCutoffDate = sleepLast7[0]?.date ?? ''
  const baselineEndDate = sleepFirst14[sleepFirst14.length - 1]?.date ?? ''

  // --- Sleep ---
  const avgHours_recent = avg(sleepLast7.map(d => d.hours))
  const avgHours_baseline = avg(sleepFirst14.map(d => d.hours))
  const sleepDecline = avgHours_baseline > 0
    ? ((avgHours_baseline - avgHours_recent) / avgHours_baseline) * 100
    : 0
  const poorDaysLast7 = sleepLast7.filter(d => d.quality === 'poor').length
  const avgBedtimeHour = avg(sleepLast7.map(d => bedtimeToHour(d.bedtime)))

  // --- Coding ---
  const codingByDate = groupByDate(coding)
  const lateNightLast7 = coding.filter(s => s.date >= recentCutoffDate && s.late_night).length
  const lateNightBaseline = coding.filter(s => s.date <= baselineEndDate && s.late_night).length
  const weekendSessions = coding.filter(s => isWeekend(s.date)).length

  const recentDates = sleepLast7.map(d => d.date)
  const codingHoursRecent = recentDates.map(date => {
    const sessions = codingByDate.get(date) ?? []
    return sessions.reduce((sum, s) => sum + s.hours, 0)
  })
  const avgCodingHoursPerDay_recent = avg(codingHoursRecent)

  // --- Meetings ---
  const meetingsLast7 = meetings.slice(-7)
  const meetingsFirst14 = meetings.slice(0, 14)
  const avgMeetPerDay_recent = avg(meetingsLast7.map(d => d.count))
  const avgMeetPerDay_baseline = avg(meetingsFirst14.map(d => d.count))
  const meetingIncrease = avgMeetPerDay_baseline > 0
    ? ((avgMeetPerDay_recent - avgMeetPerDay_baseline) / avgMeetPerDay_baseline) * 100
    : 0
  const avgMeetHoursPerDay_recent = avg(meetingsLast7.map(d => d.total_hours))
  const heavyMeetDaysLast7 = meetingsLast7.filter(d => d.total_hours > 3).length

  // --- Interruptions ---
  const intLast7 = interruptions.slice(-7)
  const intFirst14 = interruptions.slice(0, 14)
  const avgIntPerDay_recent = avg(intLast7.map(d => d.total))
  const avgIntPerDay_baseline = avg(intFirst14.map(d => d.total))
  const intIncrease = avgIntPerDay_baseline > 0
    ? ((avgIntPerDay_recent - avgIntPerDay_baseline) / avgIntPerDay_baseline) * 100
    : 0

  // --- Context switching (repos per day from github) ---
  const githubLast7 = github.filter(d => d.date >= recentCutoffDate)
  const githubFirst14 = github.filter(d => d.date <= baselineEndDate)
  const avgReposRecent = avg(githubLast7.map(d => d.repos.length))
  const avgReposBaseline = avg(githubFirst14.map(d => d.repos.length))

  // --- Productivity ---
  const prodLast7 = productivity.slice(-7)
  const prodFirst14 = productivity.slice(0, 14)
  const avgScore_recent = avg(prodLast7.map(d => d.score))
  const avgScore_baseline = avg(prodFirst14.map(d => d.score))
  const prodDecline = avgScore_baseline > 0
    ? ((avgScore_baseline - avgScore_recent) / avgScore_baseline) * 100
    : 0
  const avgDeepWorkHours_recent = avg(prodLast7.map(d => d.deep_work_hours))
  const avgTasksAdded_recent = avg(prodLast7.map(d => d.tasks_added))
  const avgTasksCompleted_recent = avg(prodLast7.map(d => d.tasks_completed))

  // --- Burnout score ---
  const s_sleep = Math.min(100, Math.max(0, sleepDecline * 2.5))
  const s_lateNight = Math.min(100, lateNightLast7 * 14)
  const s_meetings = Math.min(100, Math.max(0, meetingIncrease * 0.4))
  const s_interruptions = Math.min(100, Math.max(0, intIncrease * 0.35))
  const s_context = Math.min(100, Math.max(0, (avgReposRecent - 1) * 30))

  const burnoutScore = Math.round(
    s_sleep * 0.30 +
    s_lateNight * 0.20 +
    s_meetings * 0.20 +
    s_interruptions * 0.20 +
    s_context * 0.10
  )

  const burnoutLevel: BehavioralMetrics['burnout']['level'] =
    burnoutScore >= 75 ? 'critical' :
    burnoutScore >= 50 ? 'high' :
    burnoutScore >= 25 ? 'moderate' : 'low'

  return {
    sleep: {
      avgHours_recent: Math.round(avgHours_recent * 10) / 10,
      avgHours_baseline: Math.round(avgHours_baseline * 10) / 10,
      declinePercent: Math.round(sleepDecline),
      poorDaysLast7,
      avgBedtimeHour: Math.round(avgBedtimeHour * 10) / 10,
    },
    coding: {
      lateNightLast7,
      lateNightBaseline,
      weekendSessions,
      avgHoursPerDay_recent: Math.round(avgCodingHoursPerDay_recent * 10) / 10,
    },
    meetings: {
      avgPerDay_recent: Math.round(avgMeetPerDay_recent * 10) / 10,
      avgPerDay_baseline: Math.round(avgMeetPerDay_baseline * 10) / 10,
      increasePercent: Math.round(meetingIncrease),
      avgHoursPerDay_recent: Math.round(avgMeetHoursPerDay_recent * 10) / 10,
      heavyDaysLast7: heavyMeetDaysLast7,
    },
    interruptions: {
      avgPerDay_recent: Math.round(avgIntPerDay_recent),
      avgPerDay_baseline: Math.round(avgIntPerDay_baseline),
      increasePercent: Math.round(intIncrease),
    },
    contextSwitching: {
      avgReposPerDay_recent: Math.round(avgReposRecent * 10) / 10,
      avgReposPerDay_baseline: Math.round(avgReposBaseline * 10) / 10,
    },
    productivity: {
      avgScore_recent: Math.round(avgScore_recent),
      avgScore_baseline: Math.round(avgScore_baseline),
      declinePercent: Math.round(prodDecline),
      avgDeepWorkHours_recent: Math.round(avgDeepWorkHours_recent * 10) / 10,
      avgTasksAdded_recent: Math.round(avgTasksAdded_recent * 10) / 10,
      avgTasksCompleted_recent: Math.round(avgTasksCompleted_recent * 10) / 10,
      recentScores: prodLast7.map(d => ({
        date: d.date,
        score: d.score,
        deepWorkHours: d.deep_work_hours,
      })),
    },
    burnout: {
      score: burnoutScore,
      level: burnoutLevel,
    },
  }
}
