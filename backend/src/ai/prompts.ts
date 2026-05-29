import type { BehavioralMetrics } from '../coral/query.js'

export const SYSTEM_PROMPT = `You are xetroc, an AI behavioral intelligence system for developers.
You analyze cross-source behavioral data (sleep, coding sessions, meetings, interruptions, productivity) to help developers understand their work patterns and wellbeing.

Be direct, developer-friendly, and data-driven. Use the specific numbers from the metrics provided.
Format your response with these exact sections:

TL;DR
[One sentence summary of the core finding]

KEY FINDINGS
[3-5 bullet points with specific numbers from the data]

ROOT CAUSES
[2-3 paragraph explanation of what's driving the patterns]

RECOMMENDATIONS
[3-4 numbered, actionable suggestions]

Keep the tone honest but constructive. No fluff.`

export function buildAnalysisPrompt(question: string, metrics: BehavioralMetrics): string {
  const bedtimeFormatted = formatBedtime(metrics.sleep.avgBedtimeHour)

  return `Developer question: "${question}"

Here are the last 30 days of behavioral metrics:

SLEEP
- Recent avg (last 7 days): ${metrics.sleep.avgHours_recent}h
- Baseline avg (first 14 days): ${metrics.sleep.avgHours_baseline}h
- Decline: ${metrics.sleep.declinePercent}%
- Poor quality nights in last 7: ${metrics.sleep.poorDaysLast7}/7
- Average bedtime (last 7 days): ${bedtimeFormatted}

CODING SESSIONS
- Late-night sessions (after 10pm) in last 7 days: ${metrics.coding.lateNightLast7}
- Late-night sessions in baseline: ${metrics.coding.lateNightBaseline}
- Weekend coding sessions (last 30 days): ${metrics.coding.weekendSessions}
- Avg coding hours/day (last 7 days): ${metrics.coding.avgHoursPerDay_recent}h

MEETINGS
- Recent avg meetings/day: ${metrics.meetings.avgPerDay_recent}
- Baseline avg meetings/day: ${metrics.meetings.avgPerDay_baseline}
- Increase: ${metrics.meetings.increasePercent}%
- Avg meeting hours/day (recent): ${metrics.meetings.avgHoursPerDay_recent}h
- Days with 3+ hours of meetings in last 7: ${metrics.meetings.heavyDaysLast7}

INTERRUPTIONS
- Recent avg interruptions/day: ${metrics.interruptions.avgPerDay_recent}
- Baseline avg interruptions/day: ${metrics.interruptions.avgPerDay_baseline}
- Increase: ${metrics.interruptions.increasePercent}%

CONTEXT SWITCHING
- Avg repos touched per day (recent): ${metrics.contextSwitching.avgReposPerDay_recent}
- Avg repos touched per day (baseline): ${metrics.contextSwitching.avgReposPerDay_baseline}

PRODUCTIVITY
- Recent avg score: ${metrics.productivity.avgScore_recent}/100
- Baseline avg score: ${metrics.productivity.avgScore_baseline}/100
- Decline: ${metrics.productivity.declinePercent}%
- Avg deep work hours/day (recent): ${metrics.productivity.avgDeepWorkHours_recent}h
- Avg tasks added/day (recent): ${metrics.productivity.avgTasksAdded_recent}
- Avg tasks completed/day (recent): ${metrics.productivity.avgTasksCompleted_recent}

BURNOUT ASSESSMENT
- Burnout score: ${metrics.burnout.score}/100
- Level: ${metrics.burnout.level.toUpperCase()}

Answer the developer's question using this data.`
}

function formatBedtime(hour: number): string {
  const normalized = hour >= 24 ? hour - 24 : hour
  const h = Math.floor(normalized)
  const m = Math.round((normalized - h) * 60)
  const suffix = h < 12 ? 'AM' : 'PM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`
}
