# Dashboard card pop-up mocks

Sample records for the three cards that open a details pop-up: **Bugs**, **Flakiness**, **Self-Healing**.
Numbers are `simulated` — labelled so the numbers-hygiene rule isn't violated when we wire this up.

Field conventions:
- `id` — stable slug, used as row key
- `test` — the automated test that surfaced the signal
- `suite` / `env` — where it ran
- `firstSeen` / `lastSeen` — ISO date
- `owner` — team/individual who owns the fix
- `link` — deep-link into the run/report (placeholder anchors for now)

---

## 1 · Bugs pop-up

Header stats (already on the card): 75 bugs last release · caught 94 % pre-ship · Unit 12 / Integration 18 / QA 34 / Staging 8 / Prod 3.

**Additional pop-up stats** (simulated):
- Median time-to-detect: **1.4 days**
- Median time-to-fix: **3.1 days**
- Regression rate (bug reopened within 30 d): **6 %**
- Top offender area: **checkout → payment step (11 bugs)**

**Records (18):**

| id | title | severity | stage caught | area | test | owner | opened | status |
|---|---|---|---|---|---|---|---|---|
| BUG-4821 | Checkout total mis-rounds on 3-item cart with coupon | S1 | QA | checkout/pricing | `checkout.coupon.rounding.spec` | payments | 2026-06-14 | fixed |
| BUG-4822 | Login button loses focus ring in Safari 17 | S3 | Unit | auth/ui | `login.a11y.focus.spec` | web-platform | 2026-06-15 | fixed |
| BUG-4823 | Search returns 0 results for query with trailing space | S2 | Integration | search | `search.query.trim.spec` | search | 2026-06-15 | fixed |
| BUG-4824 | PDF export truncates last row on 50+ row tables | S2 | QA | reports | `report.export.pdf.spec` | reports | 2026-06-16 | fixed |
| BUG-4825 | Session logout does not clear localStorage `prefs.*` | S2 | QA | auth | `auth.logout.cleanup.spec` | auth | 2026-06-16 | fixed |
| BUG-4826 | Timezone offset off-by-one in daily digest email | S2 | Staging | notifications | `email.digest.tz.spec` | growth | 2026-06-17 | fixed |
| BUG-4827 | Dashboard "Month" toggle keeps "Week" data on first click | S3 | QA | dashboard | `dashboard.range.toggle.spec` | insights | 2026-06-17 | fixed |
| BUG-4828 | CSV import crashes on BOM-prefixed UTF-8 files | S1 | Integration | import | `csv.import.bom.spec` | data-tools | 2026-06-18 | fixed |
| BUG-4829 | Duplicate webhook fires on retry when 202 is returned | S1 | Prod | webhooks | `webhook.retry.idempotency.spec` | integrations | 2026-06-18 | in-progress |
| BUG-4830 | Slack notification omits thread link for replies | S3 | Unit | notifications | `slack.thread.link.spec` | growth | 2026-06-19 | fixed |
| BUG-4831 | Free-plan users see paid-only "Trends" tab briefly | S2 | Staging | billing/ui | `billing.plan.gates.spec` | billing | 2026-06-19 | fixed |
| BUG-4832 | Role picker allows assigning `owner` twice on same team | S2 | Integration | admin | `admin.role.assign.spec` | admin | 2026-06-20 | fixed |
| BUG-4833 | Chart legend colors swap Unit/Integration in dark mode | S3 | QA | dashboard | `dashboard.chart.legend.spec` | insights | 2026-06-20 | fixed |
| BUG-4834 | API returns 500 on empty JSON array to `/v1/bulk` | S1 | Integration | api | `api.bulk.empty.spec` | api-core | 2026-06-21 | fixed |
| BUG-4835 | Mobile web: file upload picker cancels itself on iOS 18 | S1 | Prod | uploads | `upload.mobile.ios18.spec` | mobile-web | 2026-06-21 | in-progress |
| BUG-4836 | Search sort "recent" ignores tie-breaker, order flaps | S3 | QA | search | `search.sort.recent.spec` | search | 2026-06-22 | fixed |
| BUG-4837 | Onboarding step 3 accepts empty company name | S2 | Unit | onboarding | `onboarding.validation.spec` | growth | 2026-06-22 | fixed |
| BUG-4838 | Rate-limit header missing on 429 response | S2 | Prod | api | `api.ratelimit.header.spec` | api-core | 2026-06-23 | in-progress |

---

## 2 · Flakiness pop-up

Header stats (already on the card): 2.5 % flake rate · down from 4.2 % four releases ago.

**Additional pop-up stats** (simulated):
- Flaky tests (last 7 days): **19**
- Median retries per flaky test / run: **1.6**
- Top root cause: **timing / animation wait (42 %)**
- Quarantined tests: **4**

**Records (18):**

| id | test | suite | flake % (7d) | runs | root cause | env | owner | firstSeen | status |
|---|---|---|---|---|---|---|---|---|---|
| FLK-101 | `checkout.confirm.button.spec` | e2e/checkout | 7.4 % | 216 | animation wait | Chrome/Linux | payments | 2026-06-02 | quarantined |
| FLK-102 | `search.autocomplete.debounce.spec` | e2e/search | 6.1 % | 198 | debounce race | Chrome/Linux | search | 2026-06-03 | investigating |
| FLK-103 | `dashboard.week.toggle.spec` | e2e/dashboard | 5.8 % | 202 | selector drift | Firefox/Linux | insights | 2026-06-04 | self-healed |
| FLK-104 | `login.oauth.google.spec` | e2e/auth | 5.5 % | 180 | 3p redirect timing | Chrome/Linux | auth | 2026-06-05 | investigating |
| FLK-105 | `notifications.toast.dismiss.spec` | e2e/notifications | 4.9 % | 240 | animation wait | Chrome/Linux | growth | 2026-06-06 | fixed |
| FLK-106 | `admin.role.picker.spec` | e2e/admin | 4.3 % | 175 | dropdown scroll-into-view | Chrome/Linux | admin | 2026-06-06 | self-healed |
| FLK-107 | `report.export.pdf.spec` | e2e/reports | 4.1 % | 156 | file-download detect | Chrome/Linux | reports | 2026-06-07 | investigating |
| FLK-108 | `billing.upgrade.modal.spec` | e2e/billing | 3.9 % | 210 | modal focus trap | Chrome/Linux | billing | 2026-06-08 | fixed |
| FLK-109 | `onboarding.step2.next.spec` | e2e/onboarding | 3.6 % | 190 | selector drift | Chrome/Linux | growth | 2026-06-09 | self-healed |
| FLK-110 | `search.filter.chips.spec` | e2e/search | 3.4 % | 220 | animation wait | Firefox/Linux | search | 2026-06-10 | fixed |
| FLK-111 | `settings.tabs.reorder.spec` | e2e/settings | 3.2 % | 165 | drag-drop timing | Chrome/Linux | admin | 2026-06-11 | investigating |
| FLK-112 | `dashboard.month.chart.spec` | e2e/dashboard | 3.0 % | 240 | canvas ready | Chrome/Linux | insights | 2026-06-12 | fixed |
| FLK-113 | `checkout.tax.state.spec` | e2e/checkout | 2.8 % | 205 | dropdown scroll | Chrome/Linux | payments | 2026-06-13 | self-healed |
| FLK-114 | `mobile.upload.picker.spec` | e2e/mobile-web | 2.7 % | 120 | picker timing | Safari/iOS | mobile-web | 2026-06-14 | quarantined |
| FLK-115 | `api.bulk.progress.spec` | e2e/api | 2.4 % | 240 | poll interval | Chrome/Linux | api-core | 2026-06-15 | fixed |
| FLK-116 | `notifications.email.preview.spec` | e2e/notifications | 2.1 % | 195 | iframe load | Chrome/Linux | growth | 2026-06-16 | fixed |
| FLK-117 | `admin.audit.filter.spec` | e2e/admin | 1.9 % | 170 | date-picker open | Chrome/Linux | admin | 2026-06-17 | fixed |
| FLK-118 | `search.zero.state.spec` | e2e/search | 1.6 % | 240 | animation wait | Chrome/Linux | search | 2026-06-18 | fixed |

---

## 3 · Self-Healing pop-up

Header stats (already on the card): 96 % heal success · 340 heals absorbed this release · 12 needed a human fix.

**Additional pop-up stats** (simulated):
- Median heal latency: **0.8 s**
- Most common signal: **role+name (48 %)**
- Fallback signal: **stable-ancestor + role (27 %)**
- Manual overrides accepted by dev: **331 / 340**

**Records (18):** each is a heal event on a run.

| id | test | old selector | new signal | reason | confidence | latency | outcome | when |
|---|---|---|---|---|---|---|---|---|
| HEA-9001 | `checkout.confirm.button.spec` | `.btn.btn-primary.confirm` | role=button name="Place order" | class churn | 0.97 | 0.6 s | accepted | 2026-06-24 09:12 |
| HEA-9002 | `search.autocomplete.debounce.spec` | `#s-2f8a input` | role=combobox name="Search" | id hashed | 0.95 | 0.7 s | accepted | 2026-06-24 09:41 |
| HEA-9003 | `dashboard.week.toggle.spec` | `button:nth-child(2)` | role=tab name="Month" | index drift | 0.92 | 0.9 s | accepted | 2026-06-24 10:03 |
| HEA-9004 | `login.oauth.google.spec` | `.oauth-google-btn` | role=button name="Continue with Google" | class churn | 0.98 | 0.5 s | accepted | 2026-06-24 10:22 |
| HEA-9005 | `admin.role.picker.spec` | `#role-select` | role=combobox name="Role" | id changed | 0.94 | 0.8 s | accepted | 2026-06-24 10:44 |
| HEA-9006 | `report.export.pdf.spec` | `.export .pdf-icon` | role=menuitem name="Export as PDF" | icon-only → labelled | 0.93 | 1.0 s | accepted | 2026-06-24 11:05 |
| HEA-9007 | `billing.upgrade.modal.spec` | `.modal .cta-upgrade` | role=button name="Upgrade plan" | class churn | 0.96 | 0.7 s | accepted | 2026-06-24 11:31 |
| HEA-9008 | `onboarding.step2.next.spec` | `button.next` | role=button name="Next" | class removed | 0.97 | 0.6 s | accepted | 2026-06-24 11:55 |
| HEA-9009 | `settings.tabs.reorder.spec` | `[data-tab="notifications"]` | role=tab name="Notifications" | data-attr renamed | 0.90 | 1.1 s | accepted | 2026-06-24 12:18 |
| HEA-9010 | `notifications.toast.dismiss.spec` | `.toast .close` | role=button name="Dismiss" | class churn | 0.95 | 0.7 s | accepted | 2026-06-24 12:40 |
| HEA-9011 | `checkout.tax.state.spec` | `select[name=state]` | role=combobox name="State" | tag → combobox pattern | 0.91 | 0.9 s | accepted | 2026-06-24 13:02 |
| HEA-9012 | `search.filter.chips.spec` | `.chip.active` | role=button name="Filter: Open" pressed | class semantics | 0.89 | 1.2 s | accepted | 2026-06-24 13:27 |
| HEA-9013 | `dashboard.month.chart.spec` | `canvas#chart1` | region name="Bugs by stage" | id numbered | 0.88 | 1.3 s | accepted | 2026-06-24 13:49 |
| HEA-9014 | `api.bulk.progress.spec` | `.progress .bar` | progressbar name="Bulk import" | class churn | 0.94 | 0.7 s | accepted | 2026-06-24 14:11 |
| HEA-9015 | `admin.audit.filter.spec` | `.date-range .from` | textbox name="From date" | class churn | 0.92 | 0.8 s | accepted | 2026-06-24 14:36 |
| HEA-9016 | `mobile.upload.picker.spec` | `#upload-btn-2` | role=button name="Upload file" | id numbered | 0.86 | 1.4 s | needs-review | 2026-06-24 15:02 |
| HEA-9017 | `search.zero.state.spec` | `.empty .cta` | role=link name="Clear filters" | class churn | 0.95 | 0.6 s | accepted | 2026-06-24 15:24 |
| HEA-9018 | `notifications.email.preview.spec` | `iframe.preview` | region name="Email preview" | class removed | 0.87 | 1.5 s | needs-review | 2026-06-24 15:48 |

---

## Notes for the UI wiring pass

- Only the three cards above are clickable — Automation Coverage, Defect Removal Efficiency, Open Bugs stay static for now (per the request).
- Pop-up shape: header line ( echoes the card's summary ) → additional stats block → table of records → close (`Esc` / click backdrop).
- Data source: import this file's tables as JS arrays (one const per card) in a new `dashboard/mock-data.js` when wiring. Keep the `simulated` tag visible on the numbers block so the numbers-hygiene rule is respected.
