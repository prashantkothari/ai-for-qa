---
name: account-health-synth
description: Synthesize churn + upsell signals for a Testsigma customer account by joining product-usage (Testsigma + Datadog), support (Jira), and conversation (Gong) telemetry into a CSM-facing brief. Trigger when the user names an account and asks for a health read, churn risk, upsell fit, renewal readiness, "what's going on with X", "should we push expansion on Y", or drills into a portfolio row.
---

# Account Health Synth

## When to invoke
- User names an account + asks for read / risk / fit / renewal-readiness / "why flagged".
- User drills from portfolio view into a row.
- User asks "who is expandable?" or "who is at risk?" — run for each candidate.

## Inputs
- **Account** (name or tenant ID) — required.
- **Window** — default trailing 30d for signals, 90d for trend. Renewal date pulled from CRM.

## Data joins (run in parallel via sub-agents where possible)

1. **Testsigma health portfolio + Grafana**
   - Active users / licensed seats, cases created (per user/wk), test runs, pass rate, plan runs, projects touched, CI/CD triggers, WoW deltas.

2. **Datadog** (customer's tenant telemetry — `tenant:<domain>`)
   - Logins, distinct active users, session length trend.
   - Test-execution engine: retry rate, flake fingerprint, error clusters (locator drift, timeout, env).
   - Feature-area coverage: UI / API / Mobile / Visual / Perf — which surfaces they touch.
   - Time-to-first-run for new invitees (activation depth).

3. **Jira** (our internal — filter by account/tenant tag)
   - Open tickets: count by priority, oldest age.
   - Closed-in-window vs opened-in-window (net).
   - Blocking bugs affecting their coverage.
   - Feature requests logged **by** them (upsell tell).

4. **Gong** (CSM + sales calls, trailing 90d)
   - Call count, cadence, gaps > 45d = silence flag.
   - Sentiment trend across the window.
   - Topic hits: renewal, budget, layoffs, reorg, competitor (name), expansion, integration, complaint.
   - Champion: identified? Attended last N calls? Silence?
   - Action items outstanding vs closed.

## Signal synthesis

### Churn score — 0–15 (sum of 5 dimensions × 0–3)

| Dimension | 0 (healthy) | 3 (critical) |
|---|---|---|
| Usage decay | active-users flat/↑ | ▼ >20% WoW, sessions ▼ |
| Authoring stall | cases/user ≥ portfolio median | 0 cases in 30d |
| Quality debt | pass rate ≥ 60% | < 20% or falling |
| Support pressure | 0 open P1, tickets aging < 14d | ≥ 1 open P1 or oldest > 30d |
| Conversation risk | recent call, positive sentiment | > 45d silence, or competitor mention, or negative sentiment |

### Upsell score — 0–15 (sum of 5 dimensions × 0–3)

| Dimension | 0 (weak) | 3 (strong) |
|---|---|---|
| Seat saturation | < 40% active of licensed | > 85% active + inviting new |
| Feature breadth | 1 module | ≥ 3 modules used regularly |
| CI/CD depth | none | integrated + volume ↑ |
| Volume growth | plan runs flat/↓ | ▲ >30% WoW sustained |
| Conversation intent | no expansion mentions | expansion / new team / adjacent workload named in Gong |

### Renewal-readiness — separate 0–10
- Contract days remaining (weight ↑ as < 90d)
- Composite = churn score inverse × conversation health × champion presence.

## Output shape (matches Screen 2)

1. **Executive read** — one sentence: verdict + main driver + timing.
2. **Score chips** — `Churn 8/15 · Upsell 4/15 · Renewal 6/10` — one-word verdict each.
3. **4 KPI cards** — anchor numbers (active users %, cases/user, pass rate, plan runs).
4. **Two panels side by side**:
   - **Pulling down** — churn contributors, each cited: `Cases ▼62.6% [Testsigma]`, `2 open P1s, oldest 34d [Jira]`, `No Gong call in 51d [Gong]`.
   - **Pulling up** — upsell contributors, each cited: `61% seat saturation [Testsigma]`, `API + Mobile modules active [Datadog]`, `"expanding to platform team" mentioned Jul 2 [Gong]`.
5. **Support snapshot** — open tickets, oldest, key blocker, top feature request.
6. **Conversation snapshot** — last call date, sentiment, topics, champion.
7. **Suggested playbook** — Your Action / TAM Action, phrased in the account's specific vocabulary drawn from Gong.
8. **Source chips** — deep links: Grafana boards · Datadog dashboards · Jira filter · Gong calls · AI reasoning.

## Rules
- **Cite every number.** Tag inline: `[Testsigma]`, `[Datadog]`, `[Jira]`, `[Gong]`. Untagged numbers are not allowed.
- **Never invent.** Missing source → render "no data", not zero.
- **Downweight thin evidence.** < 2 Gong calls in window → conversation signal weighted 0.5 and noted.
- **Do not name individuals from Gong** unless the user has already named them or they are the recorded champion in CRM.
- **Never surface Jira internal-only comments** to customer-facing exports; they're for the CSM only.
- **No competitor claim without a Gong citation** including the timestamp.

## Handoff to UI
Return a structured object: `{account, window, scores:{churn, upsell, renewal}, kpis[], pulling_down[], pulling_up[], support, conversation, actions{yours, tam}, sources[]}` — the Screen 2 template renders from this object directly.
