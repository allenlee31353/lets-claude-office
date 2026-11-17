#!/usr/bin/env bash
# Open Let's Claude Office in the default browser.
OFFICE_DIR="${LETS_OFFICE_DIR:-$HOME/.claude/lets-office}"
PAGE="$OFFICE_DIR/index.html"

if [ ! -f "$PAGE" ]; then
  echo "Let's Office has not started yet: start a new Claude Code session (the plugin's hooks begin working in new sessions), then run /office again."
  exit 0
fi

URL="file://$PAGE"
opened=0
case "$(uname -s 2>/dev/null)" in
  Darwin) open "$PAGE" && opened=1 ;;
  MINGW*|MSYS*|CYGWIN*)
    WIN_PATH="$(cygpath -w "$PAGE" 2>/dev/null || echo "$PAGE")"
    cmd.exe /c start "" "$WIN_PATH" >/dev/null 2>&1 && opened=1 ;;
  *)
    if grep -qi microsoft /proc/version 2>/dev/null && command -v wslview >/dev/null 2>&1; then
      wslview "$PAGE" >/dev/null 2>&1 && opened=1
    elif grep -qi microsoft /proc/version 2>/dev/null && command -v explorer.exe >/dev/null 2>&1; then
      explorer.exe "$(wslpath -w "$PAGE" 2>/dev/null)" >/dev/null 2>&1; opened=1
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$PAGE" >/dev/null 2>&1 & opened=1
    fi ;;
esac

if [ "$opened" = "1" ]; then
  echo "Opened $PAGE"
else
  echo "Open this page in your browser: $URL"
fi
