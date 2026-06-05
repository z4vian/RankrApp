# Agent Teams — Master Reference Guide

A reference for designing, spawning, and operating Claude Code **agent teams**: multiple Claude Code instances coordinating on a shared task list, communicating directly with each other.

> **Source**: <https://code.claude.com/docs/en/agent-teams>
> **Status**: Experimental, disabled by default. Requires Claude Code **v2.1.32+**.

---

## 1. What Agent Teams Are

An agent team is a set of independent Claude Code sessions:

- **Team lead** — the session you started in. Creates the team, spawns teammates, coordinates work, synthesizes results.
- **Teammates** — separate Claude Code instances, each with its own context window. Can talk to the lead *and to each other*.
- **Task list** — shared list of work items teammates claim and complete.
- **Mailbox** — messaging system that delivers messages between agents automatically.

### Teams vs Subagents

| | Subagents | Agent Teams |
|---|---|---|
| **Context** | Own context window; returns result to caller | Own context window; fully independent |
| **Communication** | Reports back to main agent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion + collaboration |
| **Token cost** | Lower (results summarized into main context) | Higher (each teammate is a full Claude instance) |
| **User access** | Cannot interact with subagent directly | Can message any teammate directly |

**Rule of thumb**: Use **subagents** when workers don't need to talk to each other. Use **agent teams** when they do.

### When teams shine

- **Research & review** — multiple angles investigated simultaneously, then findings cross-challenged.
- **New modules/features** — each teammate owns a separate file/module.
- **Debugging with competing hypotheses** — adversarial investigation converges faster than sequential.
- **Cross-layer changes** — frontend, backend, tests, each owned by a different teammate.

### When NOT to use a team

- Sequential tasks where step N depends on step N-1.
- Edits to the same file (overwrites).
- Routine work — coordination overhead and token cost outweigh the benefit.
- Tasks where a single session would finish in <10 minutes.

---

## 2. Enabling Agent Teams

### Required env var

```json
// .claude/settings.local.json (or settings.json, or shell env)
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or in the shell: `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

### Version check

```bash
claude --version    # must be 2.1.32+
```

### Display mode (optional)

```json
// ~/.claude/settings.json
{
  "teammateMode": "in-process"   // or "tmux", or "auto" (default)
}
```

Or per-session: `claude --teammate-mode in-process`.

---

## 3. Display Modes

| Mode | Behavior | Requirements |
|---|---|---|
| **`in-process`** | All teammates run inside the main terminal. Shift+Down cycles between them; type to message. | Any terminal |
| **`tmux`** (split panes) | Each teammate gets its own pane. Click into a pane to interact. | tmux **or** iTerm2 + `it2` CLI |
| **`auto`** (default) | Split panes if already inside tmux, otherwise in-process. | Auto-detects |

**Caveats**:
- tmux works best on macOS. `tmux -CC` in iTerm2 is the recommended entrypoint.
- Split panes **don't work** in VS Code's integrated terminal, Windows Terminal, or Ghostty.
- For iTerm2: install [`it2`](https://github.com/mkusaka/it2), then **iTerm2 → Settings → General → Magic → Enable Python API**.

### In-process key bindings

| Key | Action |
|---|---|
| **Shift+Down** | Cycle to next teammate (wraps back to lead after last) |
| **Enter** | View the active teammate's session |
| **Esc** | Interrupt the teammate's current turn |
| **Ctrl+T** | Toggle the task list |

---

## 4. Starting a Team

Just ask in natural language. Claude decides whether to spawn a team, proposes one, and waits for confirmation. The lead session that starts the team **stays the lead for its lifetime** — leadership cannot be transferred.

### Example prompts

**Three independent perspectives** (good first team):
```
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Create an agent team to explore this from different angles:
one teammate on UX, one on technical architecture, one playing devil's advocate.
```

**Explicit count + model**:
```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

**Adversarial debugging**:
```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk
to each other to try to disprove each other's theories, like a scientific
debate. Update the findings doc with whatever consensus emerges.
```

**Parallel code review** (clean separation of concerns):
```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

### Naming teammates

The lead assigns names at spawn time. To get predictable names you can reference later, name them in the spawn prompt: *"Spawn a teammate named `security` and one named `perf`."*

---

## 5. Architecture & State

### Where state lives

| File | Contents |
|---|---|
| `~/.claude/teams/{team-name}/config.json` | Runtime state: members, session IDs, tmux pane IDs |
| `~/.claude/tasks/{team-name}/` | Task list |

**Do not edit `config.json` by hand** — it is overwritten on every state update. There is **no** project-level equivalent (a file like `.claude/teams/teams.json` is ignored).

### Members array

`config.json.members` has each teammate's name, agent ID, and agent type. Teammates **can read this file** to discover other team members.

### Task list mechanics

- States: `pending`, `in progress`, `completed`.
- Tasks can declare dependencies; a `pending` task with unresolved deps **cannot be claimed** until deps complete.
- Self-claim uses **file locking** to prevent race conditions when two teammates grab the same task.
- Dependency unblocking is automatic — when a task completes, dependents become claimable without manual intervention.

### How tasks get assigned

- **Lead assigns** explicitly: *"Give task 3 to the security reviewer."*
- **Self-claim**: after finishing a task, a teammate picks the next unassigned unblocked task on its own.

---

## 6. Context & Communication

### What teammates inherit at spawn

| Inherited | Not inherited |
|---|---|
| Project `CLAUDE.md` | Lead's conversation history |
| MCP servers (from project + user settings) | Lead's open tool results |
| Skills (from project + user settings) | Lead's todo list state |
| Lead's permission mode | |
| Spawn prompt from the lead | |

**Practical consequence**: spawn prompts must be self-contained. The teammate cannot "see what we just discussed."

### Messaging

- **`SendMessage`** delivers messages by teammate name. Recipient is notified automatically; no polling required.
- **One recipient per message** — to broadcast to N teammates, send N messages.
- **Idle notifications**: when a teammate finishes and goes idle, the lead is notified automatically.

### Plan approval workflow (optional safeguard)

Spawn a teammate that must plan before acting:
```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

The teammate sits in **read-only plan mode** until the lead approves. Lead either approves or rejects with feedback; rejection sends the teammate back to revise. Approval rules are autonomous — to influence them, include criteria in your prompt (e.g. *"only approve plans that include test coverage"*).

---

## 7. Subagent Definitions as Teammates

You can reference an existing subagent type when spawning a teammate. This lets you define a role once and use it both as a one-shot subagent **and** as a long-lived teammate:

```
Spawn a teammate using the security-reviewer agent type to audit the auth module.
```

**What carries over from the subagent definition**:
- `tools` allowlist
- `model`
- Body of the definition (appended to the teammate's system prompt as **additional** instructions — does not replace it)

**What does NOT carry over** (loaded fresh from project/user settings):
- `skills` frontmatter field
- `mcpServers` frontmatter field

**Always-available tools** (even when `tools` restricts other tools):
- `SendMessage`
- Task management tools (claim, complete, etc.)

Subagent scopes: project (`.claude/agents/*.md`), user (`~/.claude/agents/*.md`), plugin, or CLI-defined.

---

## 8. Permissions Model

- Teammates **start with the lead's permission mode**.
- If the lead has `--dangerously-skip-permissions`, so does every teammate.
- Per-teammate modes can be changed **after** spawning, not at spawn time.
- Teammate permission prompts **bubble up to the lead**. To reduce interruption, pre-approve common operations in `.claude/settings.local.json` before spawning.

---

## 9. Quality Gates with Hooks

Three hook events specific to agent teams (configured in `settings.json`):

| Hook event | Fires when | Exit code 2 |
|---|---|---|
| **`TeammateIdle`** | A teammate is about to go idle | Send feedback, keep teammate working |
| **`TaskCreated`** | A task is being created | Prevent creation, send feedback |
| **`TaskCompleted`** | A task is being marked complete | Prevent completion, send feedback |

**Example — block task completion until tests pass**:
```json
{
  "hooks": {
    "TaskCompleted": [{
      "hooks": [{
        "type": "command",
        "command": "npm test --silent 2>&1 || (echo 'Tests must pass before completing task' && exit 2)"
      }]
    }]
  }
}
```

---

## 10. Best Practices

### Team size

- **Start with 3–5 teammates.** Beyond that, coordination overhead dominates.
- **Tasks per teammate**: 5–6 keeps everyone productive without thrashing.
- 15 independent tasks → ~3 teammates is a good starting ratio.
- Three focused teammates often outperform five scattered ones.

### Task sizing

| Too small | Just right | Too large |
|---|---|---|
| Coordination overhead > benefit | Self-contained unit producing a clear deliverable (a function, a test file, a review) | Teammates work too long without check-ins; wasted effort risk grows |

If the lead isn't splitting work finely enough: *"split the work into smaller pieces."*

### Avoid file conflicts

Two teammates editing the same file = overwrites. Design tasks so each teammate **owns a different set of files**.

### Spawn-prompt checklist

Include in every spawn prompt:
- Exact paths/modules to focus on
- Domain context (e.g. "uses JWT in httpOnly cookies")
- What "done" looks like (deliverable + format)
- Severity/priority guidance if applicable

### Operational discipline

- **Wait for teammates**: if the lead starts doing work itself, tell it: *"Wait for your teammates to complete their tasks before proceeding."*
- **Monitor and steer** — don't leave a team running unattended.
- **Start with research/review** if new to teams — clearer boundaries, less coordination risk than parallel implementation.

---

## 11. Lifecycle

### Shut down a single teammate

```
Ask the researcher teammate to shut down
```

The lead sends a shutdown request; the teammate can accept (exits gracefully) or reject with explanation.

### Tear down the whole team

```
Clean up the team
```

This removes shared team resources. **Run this from the lead, never from a teammate** — teammate context may not resolve correctly and resources can be left inconsistent.

Cleanup **fails if any teammates are still running**; shut them down first.

### Switching teams

A lead can only manage **one team at a time**. Clean up before starting another.

---

## 12. Pattern Library

### Pattern: parallel review with distinct lenses
3 reviewers, each owns one concern (security, performance, tests). Lead synthesizes.

### Pattern: adversarial hypothesis testing
N teammates, each defends a different theory and attempts to disprove the others'. Best for "why is this happening?" investigations where a single agent would anchor on the first plausible cause.

### Pattern: cross-layer feature
Backend / frontend / tests teammates, each owning a non-overlapping file set. Lead resolves interface decisions.

### Pattern: research swarm
Each teammate investigates one library/approach and writes a comparison entry to a shared doc. Lead synthesizes a recommendation.

### Pattern: plan-gated refactor
Spawn architect teammates with plan-approval required. Lead enforces "only approve plans with rollback strategy" or similar criteria.

---

## 13. Limitations (current)

- **No session resumption with in-process teammates** — `/resume` and `/rewind` don't restore teammates. After resume, lead may try to message ghosts; tell it to spawn new ones.
- **Task status can lag** — teammates sometimes forget to mark complete, blocking dependents. Update manually or nudge.
- **Slow shutdown** — teammates finish their current request/tool call first.
- **One team at a time per lead.**
- **No nested teams** — teammates cannot spawn their own teams.
- **Lead is fixed for the team's lifetime.**
- **Permissions set at spawn** — can be changed individually after, but not parameterized per-teammate at spawn time.
- **Split panes need tmux/iTerm2** — won't work in VS Code terminal, Windows Terminal, or Ghostty.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Teammates "don't appear" | In-process mode hides them | Shift+Down to cycle |
| No team created | Task wasn't complex enough | Be more explicit: *"Create an agent team with N teammates..."* |
| Split-pane mode fails | tmux/it2 not on PATH | `which tmux` / install `it2` and enable iTerm2 Python API |
| Permission prompt storm | Each teammate prompts lead | Pre-approve common ops in `.claude/settings.local.json` |
| Teammate stops on error | Didn't recover | Message it directly, or spawn a replacement |
| Lead shuts down early | Lead thinks team is done | Tell it to keep going / wait for teammates |
| Orphaned tmux session | Incomplete cleanup | `tmux ls` → `tmux kill-session -t <name>` |
| Task stuck `in progress` | Teammate didn't mark complete | Update manually or tell lead to nudge |

---

## 15. Quick Reference — Commands & Prompts

### Setup

```bash
claude --version                              # require 2.1.32+
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS    # require 1
which tmux                                    # if using split panes
```

### Settings keys

```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "teammateMode": "in-process" | "tmux" | "auto"
}
```

### CLI flags

```bash
claude --teammate-mode in-process
```

### Key prompts (verbatim)

```
Create an agent team to <task>. Spawn <N> teammates: <role 1>, <role 2>, ...
```
```
Spawn a teammate using the <agent-type> agent type to <task>.
```
```
Require plan approval before they make any changes.
```
```
Wait for your teammates to complete their tasks before proceeding.
```
```
Ask the <name> teammate to shut down.
```
```
Clean up the team.
```

### Storage paths

```
~/.claude/teams/{team-name}/config.json
~/.claude/tasks/{team-name}/
```

---

## 16. Decision Tree — "Should I use an agent team here?"

```
Task takes <10 min for one session?           → No team. Single session.
Edits mostly the same file?                   → No team. Single session.
Steps are strictly sequential?                → No team. Single session, maybe subagents for side queries.
Independent angles / files / hypotheses?      → ✓ Team.
Need workers to challenge each other?         → ✓ Team (adversarial pattern).
Just need a side investigation, no debate?    → Subagent, not team.
Implementing across frontend+backend+tests?   → ✓ Team (one teammate per layer).
```

---

## 17. Cost Awareness

Token usage scales **linearly with active teammates** (each has its own context). For routine tasks a single session is cheaper. For research, review, and new-feature work the extra tokens are usually worthwhile.

See: <https://code.claude.com/docs/en/costs#agent-team-token-costs>

---

## 18. Related Docs

- Subagents: <https://code.claude.com/docs/en/sub-agents>
- Hooks: <https://code.claude.com/docs/en/hooks>
- Git worktrees (manual parallel sessions): <https://code.claude.com/docs/en/worktrees>
- Settings: <https://code.claude.com/docs/en/settings>
- Permissions: <https://code.claude.com/docs/en/permissions>
- Feature comparison: <https://code.claude.com/docs/en/features-overview#compare-similar-features>
