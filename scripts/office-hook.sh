#!/usr/bin/env bash
# Let's Claude Office — session status hook.
#
# Claude Code runs this for SessionStart, UserPromptSubmit, PreToolUse,
# PostToolUse, Notification, Stop and SessionEnd. It records ONLY:
#   session id · project folder name · state · process id · timestamps
# and writes them to ~/.claude/lets-office/roster.js for the 3D office page.
#
# Prompt text, tool inputs, tool outputs and notification messages are never
# written anywhere. The hook never blocks Claude: it prints nothing and always
# exits 0, even when something goes wrong.
#
# Portable: macOS bash 3.2, Linux, Git Bash on Windows. jq is used when
# present, otherwise a small awk reader takes the first (top-level) match.

EVENT="${1:-}"
OFFICE_DIR="${LETS_OFFICE_DIR:-$HOME/.claude/lets-office}"
SESS_DIR="$OFFICE_DIR/sessions"
LOCK_DIR="$OFFICE_DIR/.lock"
SEATS=7
STALE_SECONDS=$((12 * 3600))

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"

INPUT=""

# ---------------------------------------------------------------- helpers ---

json_field() {
  # Print a top-level string field from the hook's JSON input.
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$key" 'if type=="object" then (.[$k] // empty) else empty end | if type=="string" then . else tostring end' 2>/dev/null | head -n 1
    return
  fi
  printf '%s' "$INPUT" | tr '\n\r' '  ' | awk -v k="$key" '
    {
      pat = "\"" k "\"[ \t]*:[ \t]*\"([^\"\\\\]|\\\\.)*\""
      if (match($0, pat)) {
        s = substr($0, RSTART, RLENGTH)
        sub(/^"[^"]*"[ \t]*:[ \t]*"/, "", s)
        sub(/"$/, "", s)
        gsub(/\\\//, "/", s); gsub(/\\"/, "\"", s); gsub(/\\\\/, "\\\\", s)
        print s
      }
      exit
    }'
}

now() { date +%s; }

safe_id() {
  # Session ids are UUIDs; keep only filename-safe characters.
  printf '%s' "$1" | tr -cd 'A-Za-z0-9_-' | cut -c1-80
}

js_string() {
  # Escape for a double-quoted JS string; drop control characters.
  printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | cut -c1-120
}

lock() {
  local i=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -gt 40 ]; then
      # A lock older than ~4s is left over from a killed hook: take it.
      rm -rf "$LOCK_DIR" 2>/dev/null
      mkdir "$LOCK_DIR" 2>/dev/null && return 0
      return 1
    fi
    sleep 0.1
  done
  return 0
}

unlock() { rmdir "$LOCK_DIR" 2>/dev/null; }

find_claude_pid() {
  # Walk up from the hook's parent to the Claude Code process.
  # Prints "<pid> <1 if confirmed claude, else 0>".
  local pid="$PPID" n=0 comm fallback=""
  while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null && [ "$n" -lt 8 ]; do
    comm="$(ps -o comm= -p "$pid" 2>/dev/null)" || break
    [ -z "$comm" ] && break
    case "$comm" in
      *claude*|*Claude*) echo "$pid 1"; return ;;
      *node*) [ -z "$fallback" ] && fallback="$pid" ;;
    esac
    pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    n=$((n + 1))
  done
  if [ -n "$fallback" ]; then echo "$fallback 1"; else echo "$PPID 0"; fi
}

pid_alive() { kill -0 "$1" 2>/dev/null; }

# Session record: one key=value per line, in sessions/<id>.session
read_session() {
  S_ID=""; S_PROJECT=""; S_STATE=""; S_PID=""; S_PIDOK="0"; S_SEAT="-1"; S_STARTED=""; S_UPDATED=""
  [ -f "$1" ] || return 1
  local k v
  while IFS='=' read -r k v; do
    case "$k" in
      id) S_ID="$v" ;; project) S_PROJECT="$v" ;; state) S_STATE="$v" ;;
      pid) S_PID="$v" ;; pidok) S_PIDOK="$v" ;; seat) S_SEAT="$v" ;;
      started) S_STARTED="$v" ;; updated) S_UPDATED="$v" ;;
    esac
  done < "$1"
  return 0
}

write_session() {
  local f="$SESS_DIR/$S_ID.session" tmp="$SESS_DIR/.$S_ID.$$"
  {
    echo "id=$S_ID"
    echo "project=$S_PROJECT"
    echo "state=$S_STATE"
    echo "pid=$S_PID"
    echo "pidok=$S_PIDOK"
    echo "seat=$S_SEAT"
    echo "started=$S_STARTED"
    echo "updated=$S_UPDATED"
  } > "$tmp" && mv -f "$tmp" "$f"
}

seat_taken() {
  # Is seat $1 used by any session other than $2?
  local f
  for f in "$SESS_DIR"/*.session; do
    [ -f "$f" ] || continue
    case "$f" in */"$2".session) continue ;; esac
    if grep -qx "seat=$1" "$f" 2>/dev/null; then return 0; fi
  done
  return 1
}

first_free_seat() {
  local s=0
  while [ "$s" -lt "$SEATS" ]; do
    if ! seat_taken "$s" "$1"; then echo "$s"; return; fi
    s=$((s + 1))
  done
  echo "-1"
}

prune_and_promote() {
  local f t
  t="$(now)"
  for f in "$SESS_DIR"/*.session; do
    [ -f "$f" ] || continue
    read_session "$f" || continue
    if [ "$S_PIDOK" = "1" ] && [ -n "$S_PID" ] && ! pid_alive "$S_PID"; then
      rm -f "$f"; continue
    fi
    if [ -n "$S_UPDATED" ] && [ $((t - S_UPDATED)) -gt "$STALE_SECONDS" ]; then
      rm -f "$f"; continue
    fi
  done
  # Sessions that arrived while all seats were full get a seat as soon as
  # one frees up, oldest first.
  local list
  list="$(for f in "$SESS_DIR"/*.session; do
    [ -f "$f" ] || continue
    if grep -qx 'seat=-1' "$f" 2>/dev/null; then
      printf '%s %s\n' "$(sed -n 's/^started=//p' "$f")" "$f"
    fi
  done | sort -n | awk '{print $2}')"
  for f in $list; do
    read_session "$f" || continue
    S_SEAT="$(first_free_seat "$S_ID")"
    [ "$S_SEAT" = "-1" ] && break
    write_session
  done
}

write_roster() {
  local out="$OFFICE_DIR/roster.js" tmp="$OFFICE_DIR/.roster.$$" f first=1 t
  t="$(now)"
  {
    printf 'window.LETS_OFFICE_ROSTER = {"version":1,"updated":%s,"sessions":[' "$t"
    for f in "$SESS_DIR"/*.session; do
      [ -f "$f" ] || continue
      read_session "$f" || continue
      [ -z "$S_ID" ] && continue
      [ "$first" = "1" ] || printf ','
      first=0
      printf '{"id":"%s","project":"%s","state":"%s","pid":%s,"seat":%s,"started":%s,"updated":%s}' \
        "$(js_string "$S_ID")" "$(js_string "$S_PROJECT")" "$(js_string "$S_STATE")" \
        "${S_PID:-0}" "${S_SEAT:--1}" "${S_STARTED:-0}" "${S_UPDATED:-0}"
    done
    printf ']};\n'
  } > "$tmp" && mv -f "$tmp" "$out"
}

install_page() {
  # Keep ~/.claude/lets-office/index.html and open.sh in step with the plugin.
  local src
  for src in "$PLUGIN_ROOT/web/index.html" "$PLUGIN_ROOT/scripts/open.sh"; do
    [ -f "$src" ] || continue
    local dst="$OFFICE_DIR/$(basename "$src")"
    if ! cmp -s "$src" "$dst" 2>/dev/null; then
      cp -f "$src" "$dst.$$" 2>/dev/null && mv -f "$dst.$$" "$dst"
    fi
  done
}

# ------------------------------------------------------------------- main ---

main() {
  mkdir -p "$SESS_DIR" 2>/dev/null || return 0

  INPUT="$(cat 2>/dev/null)"
  [ -z "$EVENT" ] && EVENT="$(json_field hook_event_name)"

  local sid
  sid="$(safe_id "$(json_field session_id)")"
  [ -z "$sid" ] && return 0

  [ "$EVENT" = "SessionStart" ] && install_page

  lock || return 0
  trap unlock EXIT

  local f="$SESS_DIR/$sid.session" existed=0
  if read_session "$f"; then existed=1; fi

  if [ "$EVENT" = "SessionEnd" ]; then
    rm -f "$f"
    prune_and_promote
    write_roster
    return 0
  fi

  local t new_state=""
  t="$(now)"

  case "$EVENT" in
    SessionStart)
      case "$(json_field source)" in
        compact) new_state="${S_STATE:-working}" ;;   # auto-compact happens mid-task
        *) new_state="idle" ;;
      esac
      ;;
    UserPromptSubmit)
      new_state="working" ;;                 # the prompt itself is never read
    PreToolUse)
      case "$(json_field tool_name)" in
        AskUserQuestion|ExitPlanMode) new_state="waiting" ;;
        *) new_state="working" ;;
      esac
      ;;
    PostToolUse)
      new_state="working" ;;
    Notification)
      # Only prompts that need the user count as waiting: a permission
      # request or a question. The "waiting for your input" idle reminder
      # does not change anything.
      local ntype msg
      ntype="$(json_field notification_type)"
      case "$ntype" in
        permission_prompt|elicitation_dialog) new_state="waiting" ;;
        idle_prompt|auth_success) new_state="" ;;
        "")
          msg="$(json_field message)"
          case "$msg" in
            *"waiting for your input"*|*"Waiting for your input"*) new_state="" ;;
            *permission*|*Permission*|*approv*|*Approv*|*question*|*Question*) new_state="waiting" ;;
            *) new_state="" ;;
          esac
          msg=""
          ;;
        *) new_state="" ;;
      esac
      ;;
    Stop)
      new_state="idle" ;;
    *)
      new_state="" ;;
  esac

  if [ "$existed" = "0" ]; then
    S_ID="$sid"
    S_STARTED="$t"
    S_STATE="${new_state:-idle}"
    S_SEAT="$(first_free_seat "$sid")"
  elif [ -n "$new_state" ]; then
    S_STATE="$new_state"
  fi
  S_ID="$sid"

  local cwd
  cwd="$(json_field cwd)"
  if [ -n "$cwd" ]; then
    cwd="${cwd%/}"; cwd="${cwd%\\}"
    S_PROJECT="$(basename "$cwd" 2>/dev/null)"
  fi
  [ -z "$S_PROJECT" ] && S_PROJECT="session"

  if [ -z "$S_PID" ] || [ "$EVENT" = "SessionStart" ] || [ "$S_PIDOK" != "1" ]; then
    set -- $(find_claude_pid)
    S_PID="${1:-0}"; S_PIDOK="${2:-0}"
  fi
  S_UPDATED="$t"

  write_session
  prune_and_promote
  write_roster
  INPUT=""
}

main >/dev/null 2>&1
exit 0
