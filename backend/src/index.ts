import { program } from 'commander'
import { askCommand } from './commands/ask.js'

program
  .name('xetroc')
  .description('AI Behavioral Intelligence for Developers')
  .version('1.0.0')

program
  .command('ask')
  .description('Ask about your work patterns and wellbeing')
  .argument('<question>', 'Natural language question about your behavior and productivity')
  .action(askCommand)

program.parse()
