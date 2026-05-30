import { program } from 'commander'
import { askCommand } from './commands/ask.js'

program
  .name('xetroc')
  .description('AI Behavioral Intelligence for Developers')
  .version('1.0.0')
  .allowExcessArguments(true)

program
  .command('ask')
  .description('Ask about your work patterns and wellbeing')
  .argument('<question>', 'Natural language question')
  .action(askCommand)

// Bare usage: xetroc why am I burned out?  (no "ask" subcommand needed)
program
  .arguments('[question...]')
  .action(async (words: string[]) => {
    if (words.length > 0) {
      await askCommand(words.join(' '))
    } else {
      program.help()
    }
  })

program.parse()
