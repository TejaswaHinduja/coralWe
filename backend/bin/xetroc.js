#!/usr/bin/env node
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const dir = dirname(fileURLToPath(import.meta.url))
const entry = join(dir, '..', 'src', 'index.ts')

const result = spawnSync('npx', ['tsx', entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 0)
