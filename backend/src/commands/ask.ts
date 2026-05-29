import chalk from 'chalk'
import ora from 'ora'
import { computeMetrics } from '../coral/query.js'
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

  let metrics
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
  console.log(
    '  Burnout: ' + colorFn(` ${metrics.burnout.level.toUpperCase()} `) +
    chalk.dim(` (${metrics.burnout.score}/100)`)
  )
  console.log()

  
  printFormattedResponse(response)
  console.log()
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
