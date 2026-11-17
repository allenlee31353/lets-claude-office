#!/usr/bin/env bash
# Simulates Claude Code hook events and checks roster.js.
# Usage: bash tests/test-hook.sh            (uses jq if installed)
#        NO_JQ=1 bash tests/test-hook.sh    (forces the awk fallback)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/scripts/office-hook.sh"
export LETS_OFFICE_DIR="$(mktemp -d)"
export CLAUDE_PLUGIN_ROOT="$ROOT"
fail=0

if [ "${NO_JQ:-}" = "1" ]; then
  shim="$(mktemp -d)"
  for c in bash sh cat tr awk sed grep cut sort mkdir rmdir rm mv cp cmp date head ps basename dirname sleep kill; do
    p="$(command -v "$c")" && ln -s "$p" "$shim/$c"
  done
  export PATH="$shim"
fi

send() { # event json
  printf '%s' "$2" | bash "$HOOK" "$1"
}
state_of() { # sid
  sed -n "s/.*\"id\":\"$1\",\"project\":\"[^\"]*\",\"state\":\"\([a-z]*\)\".*/\1/p" "$LETS_OFFICE_DIR/roster.js" | head -1
}
seat_of() {
  tr '{' '\n' < "$LETS_OFFICE_DIR/roster.js" | grep "\"id\":\"$1\"" | sed -n 's/.*"seat":\(-\{0,1\}[0-9]*\).*/\1/p'
}
expect() { # label actual expected
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got '$2' want '$3'"; fail=1; fi
}

A='"session_id":"aaaa-1111","transcript_path":"/x/t.jsonl","cwd":"/home/me/projects/my-app"'
B='"session_id":"bbbb-2222","transcript_path":"/x/u.jsonl","cwd":"/home/me/work/api \"server\""'

send SessionStart "{$A,\"hook_event_name\":\"SessionStart\",\"source\":\"startup\"}"
expect "start → idle" "$(state_of aaaa-1111)" idle
expect "first session gets seat 0" "$(seat_of aaaa-1111)" 0
[ -f "$LETS_OFFICE_DIR/index.html" ] && echo "ok   page installed" || { echo "FAIL page not installed"; fail=1; }

send SessionStart "{$B,\"hook_event_name\":\"SessionStart\",\"source\":\"startup\"}"
expect "second session gets seat 1" "$(seat_of bbbb-2222)" 1

SECRET='TOP-SECRET-PROMPT \"cwd\":\"/evil/path\" \\ done'
send UserPromptSubmit "{$A,\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"$SECRET\"}"
expect "prompt → working" "$(state_of aaaa-1111)" working
if grep -rq "TOP-SECRET" "$LETS_OFFICE_DIR"; then echo "FAIL prompt text was stored"; fail=1; else echo "ok   prompt text not stored"; fi
grep -q '"project":"my-app"' "$LETS_OFFICE_DIR/roster.js" && echo "ok   project name kept" || { echo "FAIL project name"; fail=1; }

send Notification "{$A,\"hook_event_name\":\"Notification\",\"message\":\"Claude is waiting for your input\",\"notification_type\":\"idle_prompt\"}"
expect "idle reminder ignored" "$(state_of aaaa-1111)" working

send Notification "{$A,\"hook_event_name\":\"Notification\",\"message\":\"Claude needs your permission to use Bash\",\"notification_type\":\"permission_prompt\"}"
expect "permission → waiting" "$(state_of aaaa-1111)" waiting

send PostToolUse "{$A,\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"ls\"},\"tool_response\":{\"stdout\":\"secret-output\"}}"
expect "tool done → working" "$(state_of aaaa-1111)" working
grep -rq "secret-output" "$LETS_OFFICE_DIR" && { echo "FAIL tool output stored"; fail=1; } || echo "ok   tool output not stored"

send PreToolUse "{$A,\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"AskUserQuestion\",\"tool_input\":{\"questions\":[]}}"
expect "AskUserQuestion → waiting" "$(state_of aaaa-1111)" waiting

send Notification "{$A,\"hook_event_name\":\"Notification\",\"message\":\"Claude needs your permission to use Edit\"}"
expect "old-style permission message → waiting" "$(state_of aaaa-1111)" waiting
send PostToolUse "{$A,\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"AskUserQuestion\"}"
send Notification "{$A,\"hook_event_name\":\"Notification\",\"message\":\"Claude is waiting for your input\"}"
expect "old-style idle message ignored" "$(state_of aaaa-1111)" working

send Stop "{$A,\"hook_event_name\":\"Stop\",\"stop_hook_active\":false}"
expect "stop → idle" "$(state_of aaaa-1111)" idle

grep -q 'api \\"server\\"' "$LETS_OFFICE_DIR/roster.js" && echo "ok   quotes escaped" || { echo "FAIL quote escaping"; cat "$LETS_OFFICE_DIR/roster.js"; fail=1; }

# Fill all seats, then one more waits without a seat until a seat frees up.
for i in 3 4 5 6 7 8; do
  send SessionStart "{\"session_id\":\"s$i\",\"cwd\":\"/p/proj$i\",\"hook_event_name\":\"SessionStart\",\"source\":\"startup\"}"
done
expect "8th session has no seat" "$(seat_of s8)" -1
send SessionEnd "{$A,\"hook_event_name\":\"SessionEnd\",\"reason\":\"exit\"}"
grep -q aaaa-1111 "$LETS_OFFICE_DIR/roster.js" && { echo "FAIL ended session still listed"; fail=1; } || echo "ok   ended session removed"
expect "8th session promoted to seat 0" "$(seat_of s8)" 0

if command -v node >/dev/null 2>&1; then
  node -e "global.window={}; require('$LETS_OFFICE_DIR/roster.js'); const r=window.LETS_OFFICE_ROSTER; if(!r||r.sessions.length!==7) {console.log('FAIL roster parse'); process.exit(1)} else console.log('ok   roster.js parses ('+r.sessions.length+' sessions)')" || fail=1
fi

rm -rf "$LETS_OFFICE_DIR"
[ "$fail" = "0" ] && echo "ALL PASSED" || { echo "SOME TESTS FAILED"; exit 1; }
