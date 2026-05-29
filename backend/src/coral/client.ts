import { execFileSync } from 'child_process'

export type CoralRow = Record<string, string | number | boolean | null>

export function coralQuery<T extends CoralRow = CoralRow>(sql: string): T[] {
  let stdout: string
  try {
    stdout = execFileSync('coral', ['sql', '--format', 'json', sql.trim()], {
      encoding: 'utf-8',
      timeout: 30000,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`coral sql failed: ${msg}`)
  }

  try {
    const parsed: unknown = JSON.parse(stdout)
    if (!Array.isArray(parsed)) throw new Error('Expected array from coral sql')
    return parsed as T[]
  } catch {
    // Coral didn't output JSON — surface the raw output so the user can see what flag to use
    throw new Error(
      `Could not parse coral output as JSON.\n` +
      `Raw output:\n${stdout.slice(0, 500)}\n\n` +
      `If coral uses a different flag, update client.ts and replace '--format','json'.`
    )
  }
}

export function isCoralSourceActive(schema: string): boolean {
  try {
    const rows = coralQuery<{ schema_name: string }>(
      `SELECT schema_name FROM coral.tables WHERE schema_name = '${schema}' LIMIT 1`
    )
    return rows.length > 0
  } catch {
    return false
  }
}
