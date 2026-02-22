# ClawFarm 🐜

Lightweight sequential multi-agent workflow orchestrator for OpenClaw.

Built as a cheaper, simpler, transparent alternative to Antfarm.

## Why ClawFarm

| | Antfarm | ClawFarm |
|--|--|--|
| Execution | Cron polling (all agents, always) | Sequential (on demand only) |
| Model routing | blockrun/auto (expensive) | Explicit per step |
| Cost per run | $3.50+ (observed) | ~$0.30 (estimated) |
| Visibility | Dashboard only | Streams to terminal |
| State | SQLite daemon | Plain JSON files |
| Resume | Manual | `clawfarm resume <id>` |

## Requirements

- Node.js >= 22
- OpenClaw v2026.2.9+
- `gh` CLI (for PR step)

## Install

```bash
git clone https://github.com/ClawHealthDev/clawfarm
cd clawfarm
npm install
npm link
```

## Usage

```bash
# Run a workflow
clawfarm run feature-dev "Add user authentication"

# Check status
clawfarm status <run-id>

# View step outputs
clawfarm logs <run-id>

# View specific step
clawfarm logs <run-id> --step implement

# Resume a failed run
clawfarm resume <run-id>

# List all runs
clawfarm list

# Stop a run
clawfarm stop <run-id>
```

## How It Works

1. Reads workflow YAML (`workflows/feature-dev.yaml`)
2. For each step sequentially:
   - Builds a prompt from template + previous step outputs
   - Calls `openclaw --agent clawfarm-<role> --model <model> chat`
   - Streams output to terminal in real time
   - Detects completion signal (`STATUS: done`)
   - Saves output to `runs/<id>/<step>.md`
3. Passes context to next step
4. No polling, no cron, no daemon

## Model Assignment

| Step | Model | Why |
|------|-------|-----|
| plan | blockrun/eco | Simple decomposition |
| setup | blockrun/eco | File scaffolding |
| implement | blockrun/sonnet | Complex coding |
| verify | blockrun/eco | Reading + checking |
| test | blockrun/eco | Writing tests |
| pr | blockrun/eco | Git commands |
| review | blockrun/sonnet | Deep code analysis |

Estimated cost per full run: **~$0.30**

## Agent Setup

ClawFarm creates agent IDs like `clawfarm-planner`, `clawfarm-developer` etc.
These use the AGENTS.md files from `agents/<role>/AGENTS.md`.

OpenClaw will auto-create these agents on first use.

## Workflows

Workflows are defined in `workflows/<name>.yaml`.
Each step specifies: agent, model, input template, completion signal, timeout.

See `workflows/feature-dev.yaml` for the full example.

---

Built for the ClawHealth project. Part of the OpenClaw ecosystem.
