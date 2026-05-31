# xetroc

AI behavioral intelligence for developers. Ask natural language questions about your productivity, burnout risk, and work patterns — xetroc cross-references your GitHub activity, calendar, sleep, and interruption data to give you real answers.

```
xetroc why am I not productive lately
xetroc am I close to burnout
xetroc what's killing my focus
```

## How it works

xetroc pulls data from multiple sources, computes behavioral metrics across all of them, then sends everything to Gemini 2.5 Flash for analysis:

```
GitHub commits  →  context switching, late-night sessions, code velocity
Google Calendar →  meeting load, fragmentation
Sleep / interruptions / productivity  →  JSONL (or your own source)
                           ↓
                   Behavioral metrics engine
                           ↓
                    Gemini 2.5 Flash
                           ↓
              TL;DR · Key Findings · Root Causes · Recommendations
```

Live sources (via [Coral](https://withcoral.com)) fall back to mock JSONL data automatically if auth is unavailable — the tool always works.

## Installation

**Prerequisites:** Node.js 18+, a [Gemini API key](https://aistudio.google.com/app/apikey)

```bash
git clone <repo>
cd xetroc/backend
npm install
```

Create a `.env` file:

```env
GEMINI_API_KEY=your_key_here
GITHUB_USERNAME=your_github_username   # optional, auto-detected via Coral
```

Link globally so you can run `xetroc` from anywhere:

```bash
npm link
```

## Usage

```bash
# Natural language — no subcommand needed
xetroc why am I exhausted
xetroc show me my productivity this week
xetroc am I close to burnout
xetroc what's causing all these context switches

# Explicit subcommand also works
xetroc ask "why am I not sleeping enough"
```

Every response includes:
- **Burnout ring** — a half-block circle that fills clockwise as your risk grows
- **AI analysis** — TL;DR, Key Findings, Root Causes, Recommendations
- **Productivity bars** — last 7 days scored and color-coded with trend arrows

## Connecting live data sources

xetroc uses [Coral](https://withcoral.com) as a local SQL runtime over your APIs.

```bash
# Install Coral CLI
npm install -g @withcoral/cli

# Connect GitHub (give it a PAT with repo + read:user scopes)
coral source add --interactive github

# Connect Google Calendar
coral source add --interactive google_calendar
```

Once connected, xetroc queries real data automatically and falls back to mock JSONL only if a source fails.

## Data sources & metrics

| Source | What it measures |
|--------|-----------------|
| GitHub (live via Coral) | Commits, repos/day, late-night sessions, PR activity |
| Google Calendar (live via Coral) | Meetings/day, total meeting hours, heavy meeting days |
| Sleep (JSONL) | Avg hours, quality trend, bedtime drift |
| Interruptions (JSONL) | Slack + email + GitHub notifications per day |
| Productivity (JSONL) | Focus score, deep work hours, task throughput |

Burnout score: `sleep × 0.30 + lateNight × 0.20 + meetings × 0.20 + interruptions × 0.20 + contextSwitching × 0.10`

## Publishing to npm

```bash
# Log in to npm (create account at npmjs.com if needed)
npm login

# If "xetroc" is taken, use a scoped name first:
# Change "name" in package.json to "@yourusername/xetroc"

npm publish --access public
```

After publishing, anyone can install it with:

```bash
npm install -g xetroc
# then set GEMINI_API_KEY and run:
xetroc why am I not productive
```

## Tech stack

- **Runtime:** Node.js + TypeScript (tsx, NodeNext ESM)
- **CLI:** Commander.js
- **Data layer:** Coral (SQL over APIs) + JSONL fallback
- **AI:** Gemini 2.5 Flash via `@google/genai`
- **UI:** chalk + ora
