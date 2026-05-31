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

  // Burnout ring — shown at the top before AI analysis
  console.log('  ' + chalk.bold('BURNOUT RISK') + chalk.dim('  ─────────────────────────────────'))
  console.log()
  renderBurnoutRing(metrics.burnout.score, metrics.burnout.level, colorFn)
  console.log()
  console.log(chalk.dim('  ────────────────────────────────────────────────────'))
  console.log()

  // AI analysis
  printFormattedResponse(response)

  // Productivity bars — at the bottom as a detailed data view
  console.log()
  console.log(chalk.dim('  ────────────────────────────────────────────────────'))
  console.log()
  console.log('  ' + chalk.bold('PRODUCTIVITY') + chalk.dim('  last 7 days  ───────────────────'))
  console.log()
  renderProductivityBars(metrics.productivity.recentScores)
  console.log()
}

// 30-segment half-block ring, fills clockwise from top-left.
// ▘▀…▀▝ = top arc   ▌/▐ = left/right sides   ▗▄…▄▖ = bottom arc
// Segment map:  0=▘  1–11=▀  12=▝  13–14=▐  15=▖  16–26=▄  27=▗  28–29=▌
function renderBurnoutRing(score: number, level: string, colorFn: typeof chalk): void {
  const N = 30
  const filled = Math.round((score / 100) * N)
  const ringFn = level === 'critical' ? chalk.red : colorFn
  const seg = (i: number, ch: string): string => i < filled ? ringFn(ch) : chalk.dim(ch)

  const W = 11
  const scoreStr = `${score}/100`
  const sp = Math.max(0, W - scoreStr.length)
  const scoreText = ' '.repeat(Math.floor(sp / 2)) + scoreStr + ' '.repeat(Math.ceil(sp / 2))

  const lvl = level.toUpperCase()
  const lp = Math.floor((W - lvl.length) / 2)
  const levelText = ' '.repeat(lp) + colorFn(lvl) + ' '.repeat(W - lvl.length - lp)

  const topRow = seg(0, '▘') + [1,2,3,4,5,6,7,8,9,10,11].map(i => seg(i, '▀')).join('') + seg(12, '▝')
  const midRow1 = seg(29, '▌') + scoreText + seg(13, '▐')
  const midRow2 = seg(28, '▌') + levelText + seg(14, '▐')
  const botRow = seg(27, '▗') + [26,25,24,23,22,21,20,19,18,17,16].map(i => seg(i, '▄')).join('') + seg(15, '▖')

  const P = '  '
  console.log(P + topRow)
  console.log(P + midRow1)
  console.log(P + midRow2)
  console.log(P + botRow)
}

function renderProductivityBars(
  recentScores: Array<{ date: string; score: number; deepWorkHours: number }>
): void {
  const BAR_WIDTH = 18
  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
