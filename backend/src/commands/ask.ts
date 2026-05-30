import chalk from 'chalk'
import ora from 'ora'
import { computeMetrics, type BehavioralMetrics } from '../coral/query.js'
import { generateInsight } from '../ai/gemini.js'
import { SYSTEM_PROMPT, buildAnalysisPrompt } from '../ai/prompts.js'

const BURNOUT_COLORS = {
  low: chalk.green,
  moderate: chalk.yellow,
  high: chalk.red,
  critical: chalk.bgRed.white,
}

export async function askCommand(question: string): Promise<void> {
  console.log()
  console.log(chalk.bold.cyan('  xetroc') + chalk.dim(' · Behavioral Intelligence'))
  console.log(chalk.dim('  ─────────────────────────────────────'))
  console.log()

  const spinner = ora({ text: chalk.dim('Loading behavioral data across 6 sources...'), color: 'cyan' }).start()

  let metrics: BehavioralMetrics
  try {
    metrics = computeMetrics()
    spinner.text = chalk.dim('Computing cross-source metrics...')
    await sleep(300)
    spinner.text = chalk.dim('Sending to AI for analysis...')
  } catch (err) {
    spinner.fail(chalk.red('Failed to load data: ' + String(err)))
    process.exit(1)
  }

  const prompt = buildAnalysisPrompt(question, metrics)

  let response: string
  try {
    response = await generateInsight(SYSTEM_PROMPT, prompt)
    spinner.stop()
  } catch (err) {
    spinner.fail(chalk.red('AI request failed: ' + String(err)))
    process.exit(1)
  }

  const colorFn = BURNOUT_COLORS[metrics.burnout.level]

  console.log('  ' + chalk.bold('BURNOUT RISK') + chalk.dim('  ─────────────────────────────────'))
  console.log()
  renderBurnoutRing(metrics.burnout.score, metrics.burnout.level, colorFn)
  console.log()
  console.log('  ' + chalk.bold('PRODUCTIVITY') + chalk.dim('  last 7 days  ───────────────────'))
  console.log()
  renderProductivityBars(metrics.productivity.recentScores)
  console.log()
  console.log(chalk.dim('  ────────────────────────────────────────────────────'))
  console.log()

  printFormattedResponse(response)
  console.log()
}

// 16-segment ring, fills clockwise from top-left.
// Segments: 0-4 = top, 5-7 = right, 8-12 = bottom (right→left), 13-15 = left (bottom→top)
function renderBurnoutRing(score: number, level: string, colorFn: typeof chalk): void {
  const N = 16
  const filled = Math.round((score / 100) * N)
  const d = (i: number): string => i < filled ? colorFn('●') : chalk.dim('○')

  const W = 11
  const scoreStr = `${score}/100`
  const sPadL = Math.floor((W - scoreStr.length) / 2)
  const sPadR = W - scoreStr.length - sPadL
  const scoreText = ' '.repeat(sPadL) + scoreStr + ' '.repeat(sPadR)

  const lvl = level.toUpperCase()
  const lPadL = Math.floor((W - lvl.length) / 2)
  const lPadR = W - lvl.length - lPadL
  const levelText = ' '.repeat(lPadL) + colorFn(lvl) + ' '.repeat(lPadR)

  const P = '  '
  console.log(P + `    ${d(0)} ${d(1)} ${d(2)} ${d(3)} ${d(4)}    `)
  console.log(P + `  ${d(15)}           ${d(5)}  `)
  console.log(P + `  ${d(14)}${scoreText}${d(6)}  `)
  console.log(P + `  ${d(13)}${levelText}${d(7)}  `)
  console.log(P + `    ${d(12)} ${d(11)} ${d(10)} ${d(9)} ${d(8)}    `)
}

function renderProductivityBars(
  recentScores: Array<{ date: string; score: number; deepWorkHours: number }>
): void {
  const BAR_WIDTH = 18
  const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  for (let i = 0; i < recentScores.length; i++) {
    const day = recentScores[i]!
    const [, mm, dd] = day.date.split('-')
    const label = `${MONTHS[parseInt(mm ?? '1')] ?? ''} ${parseInt(dd ?? '1')}`.padEnd(6)

    const filledCount = Math.round((day.score / 100) * BAR_WIDTH)
    const barFn = day.score >= 60 ? chalk.green : day.score >= 40 ? chalk.yellow : chalk.red
    const bar = barFn('█'.repeat(filledCount)) + chalk.dim('░'.repeat(BAR_WIDTH - filledCount))

    const prev = recentScores[i - 1]
    let trend: string
    if (!prev) {
      trend = '  '
    } else {
      const diff = day.score - prev.score
      trend = diff > 3 ? chalk.green(' ▲') : diff < -3 ? chalk.red(' ▼') : chalk.dim(' ~')
    }

    console.log(`  ${chalk.dim(label)}  ${bar}  ${chalk.bold(String(day.score).padStart(3))}${trend}`)
  }
}

function printFormattedResponse(text: string): void {
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === 'TL;DR') {
      console.log('  ' + chalk.bold.cyan('TL;DR'))
      console.log('  ' + chalk.dim('─'.repeat(40)))
    } else if (trimmed === 'KEY FINDINGS') {
      console.log()
      console.log('  ' + chalk.bold.yellow('KEY FINDINGS'))
      console.log('  ' + chalk.dim('─'.repeat(40)))
    } else if (trimmed === 'ROOT CAUSES') {
      console.log()
      console.log('  ' + chalk.bold.magenta('ROOT CAUSES'))
      console.log('  ' + chalk.dim('─'.repeat(40)))
    } else if (trimmed === 'RECOMMENDATIONS') {
      console.log()
      console.log('  ' + chalk.bold.green('RECOMMENDATIONS'))
      console.log('  ' + chalk.dim('─'.repeat(40)))
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      console.log('  ' + chalk.cyan('◆') + ' ' + trimmed.slice(2))
    } else if (/^\d+\./.test(trimmed)) {
      console.log('  ' + chalk.green('→') + ' ' + trimmed)
    } else if (trimmed.length > 0) {
      console.log('  ' + trimmed)
    } else {
      console.log()
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
