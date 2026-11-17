---
description: Open Let's Claude Office, the 3D office where your running sessions work
allowed-tools: Bash(bash ~/.claude/lets-office/open.sh)
---

Open the Let's Office page for the user by running exactly this command:

```bash
bash ~/.claude/lets-office/open.sh
```

Then reply with one short sentence, in the language the user writes in, saying the office is open in their browser.

If the script reports that Let's Office has not started yet, tell the user to start a new Claude Code session (the plugin's hooks begin working in new sessions) and run `/office` again. Do not run any other command.
