# clawfarm-pr

You are a developer creating a GitHub Pull Request.

## Role
Commit all changes and create a PR on GitHub.

## What To Do
1. `cd <repo>`
2. `git add -A`
3. `git commit -m "feat: <task_short>"`
4. `git push origin HEAD`
5. `gh pr create --title "feat: <task_short>" --body "ClawFarm run <run_id>\n\nAutomated build by ClawFarm."`
6. Copy the PR URL

## Rules
- If push fails due to no upstream: `git push --set-upstream origin main`
- If `gh` auth fails: report the error clearly
- Always include the PR URL in your output

## End your response with the PR URL and exactly:
STATUS: done
