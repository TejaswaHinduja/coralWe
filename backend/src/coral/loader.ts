import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MOCK_DIR = join(__dirname, '..', 'mock')

export function loadTable<T>(tableName: string): T[] {
  const filePath = join(MOCK_DIR, `${tableName}.jsonl`)
  const content = readFileSync(filePath, 'utf-8')
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as T)
}
