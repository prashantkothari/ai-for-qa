#!/usr/bin/env python3
"""Token audit: which tools burn the most context, from Claude Code session transcripts.

Reads the most recent session .jsonl transcripts, pairs each tool_result with the
tool_use that produced it, and reports tokens-by-tool (~tokens = bytes/4).

Origin: 2026-07-06 audit that found Chrome screenshots (`computer` tool) = 66% of
tool-output tokens. Re-run after a working session to confirm that share has dropped.

Usage:
  python3 self-heal/tools/token-audit.py [N_SESSIONS]   analyze the N most recent (default 6)
  python3 self-heal/tools/token-audit.py --since YYYY-MM-DD   only sessions modified on/after that date

Baseline recorded 2026-07-06 (pre-guardrail): Chrome `computer` screenshots = 66.1%.
To verify the guardrails worked, run with --since <first post-guardrail day> and check the
screenshot share fell well below 66%.
"""
import json, os, glob, collections, sys


# Each git worktree gets its own transcript directory
# (~/.claude/projects/-Users-...-claude--claude-worktrees-<name>/), sibling to the
# main repo's. A --since scan that only reads the main dir silently misses all
# worktree sessions - which is where most work (including this project's) happens.
PROJECTS_ROOT = os.path.expanduser("~/.claude/projects")
PROJECT_DIR_GLOB = os.path.join(
    PROJECTS_ROOT, "-Users-prashant-kothari-Documents-claude*"
)


def main(argv):
    all_files = sorted(
        glob.glob(os.path.join(PROJECT_DIR_GLOB, "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )
    # --since filters by each ENTRY's own timestamp, not file mod-time: file
    # mtimes get bumped when an old session is merely re-opened, which would
    # otherwise miscount old tool calls as recent.
    since = None
    if len(argv) > 1 and argv[1] == "--since":
        since = argv[2]  # ISO date string; lexical compare against entry timestamp
        files = all_files
        scope = f"entries dated on/after {since}"
    else:
        n = int(argv[1]) if len(argv) > 1 else 6
        files = all_files[:n]
        scope = f"{len(files)} most-recent session(s)"
    if not files:
        print(f"No matching transcripts under {PROJECTS_ROOT} ({scope})")
        return

    id2name = {}
    tok = collections.Counter()      # total ~tokens per tool
    count = collections.Counter()    # calls per tool
    biggest = collections.Counter()  # largest single result per tool

    for f in files:
        for line in open(f, errors="ignore"):
            try:
                obj = json.loads(line)
            except Exception:
                continue
            # Skip entries older than the cutoff (ISO timestamps sort lexically).
            if since and (obj.get("timestamp") or "")[:10] < since:
                continue
            msg = obj.get("message", {})
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            for c in content:
                if not isinstance(c, dict):
                    continue
                if c.get("type") == "tool_use":
                    id2name[c.get("id")] = c.get("name", "?")
                elif c.get("type") == "tool_result":
                    name = id2name.get(c.get("tool_use_id"), "?unknown")
                    t = len(json.dumps(c.get("content", ""))) // 4
                    tok[name] += t
                    count[name] += 1
                    biggest[name] = max(biggest[name], t)

    total = sum(tok.values()) or 1
    print(f"Analyzed {scope}. Total tool-output ~{total:,} tokens.\n")
    print(f"{'tool':<42}{'calls':>7}{'~tokens':>11}{'share':>8}{'max':>9}")
    for name, t in tok.most_common(20):
        print(f"{name:<42}{count[name]:>7}{t:>11,}{t/total*100:>7.1f}%{biggest[name]:>9,}")


if __name__ == "__main__":
    main(sys.argv)
