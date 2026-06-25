# CLAUDE.md

**Read [`context.md`](context.md) first** — it's the shared orientation for every session (goals,
non-negotiable rules, current status, how to run). The full source of truth is the Inferences Ledger
at `~/.claude/plans/i-would-like-you-buzzing-goblet.md`.

Quick rules (detail in `context.md`):
- **false-heal = 0** is the gating metric; a correct **abstain with a named reason** is a deliverable.
- **No fabrication** — no % without a labelled set; tag numbers `measured/simulated/proxy/asserted`.
- **Keep `selfheal-core.js` pristine**; build in `self-heal/pipeline/` + `self-heal/tools/`.
- **No Node here** — run via `python3 static-server.py` (port 8765) + Chrome MCP; own tab per session.
- Architecture + OSS-stack map: [`self-heal/docs/ARCHITECTURE.md`](self-heal/docs/ARCHITECTURE.md).
