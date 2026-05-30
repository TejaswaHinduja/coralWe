import { coralQuery } from '../client.js'

export interface CalendarDayMeetings {
  date: string
  count: number
  total_hours: number
  types: string[]
}

// Confirmed column names from:
//   coral sql "SELECT column_name FROM coral.columns WHERE schema_name='google_calendar' AND table_name='events'"
// Key columns: start_date_time, end_date_time, summary, status, calendar_id
//
// Timed events use start_date_time/end_date_time.
// All-day events (OOO, holidays) use start_date/end_date — excluded here.

export function fetchCalendarMeetings(days = 30): CalendarDayMeetings[] {
  const rows = coralQuery<{
    date: string
    count: number
    total_hours: number
    types: string   // ARRAY_AGG returns JSON string
  }>(`
    SELECT
      CAST(start_date_time AS DATE)                                           AS date,
      COUNT(*)                                                                AS count,
      SUM(
        EXTRACT(EPOCH FROM (
          CAST(end_date_time AS TIMESTAMP) - CAST(start_date_time AS TIMESTAMP)
        )) / 3600.0
      )                                                                       AS total_hours,
      ARRAY_AGG(DISTINCT COALESCE(summary, 'Untitled'))                      AS types
    FROM google_calendar.events
    WHERE start_date_time IS NOT NULL
      AND start_date_time >= NOW() - INTERVAL '${days} days'
      AND status = 'confirmed'
    GROUP BY CAST(start_date_time AS DATE)
    ORDER BY date ASC
  `)

  return rows.map(row => ({
    date: row.date,
    count: Number(row.count),
    total_hours: Math.round(Number(row.total_hours) * 100) / 100,
    types: parseArrayField(row.types),
  }))
}

function parseArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try { return JSON.parse(value) as string[] } catch { return [value] }
  }
  return []
}
