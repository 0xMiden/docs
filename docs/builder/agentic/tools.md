---
title: "Add agent skills"
sidebar_label: "Agent skills"
description: "Discover, preview, install, and check Rust, MASM, and protocol skills for your coding agent."
---

# Add agent skills

This optional step adds knowledge beyond the template and installed SDK guidance. Complete the main [setup](setup.md) and [context checks](templates.md) first.

[Agent tools](https://github.com/0xMiden/agent-tools) provides Rust, MASM, and protocol knowledge skills plus Markdown workflow prompts. Use it in an existing project or alongside a template. Browser API skills remain owned by the installed npm SDK packages.

## Discover the bundle

Use Python 3.11+ and keep the checkout matched to your project's release:

```bash
git clone https://github.com/0xMiden/agent-tools.git
cd agent-tools
python3 scripts/agent_tools.py list
python3 scripts/agent_tools.py check
```

`list` reports prompt names, descriptions, paths, hashes, and the release baseline. `check` validates bundle metadata. Read the relevant `SKILL.md` before asking the agent to use it.

## Preview and install

Choose an existing project directory. Preview the file plan first, then apply it and check the installed content:

```bash
python3 scripts/agent_tools.py install --project /path/to/project --agent codex
python3 scripts/agent_tools.py install --project /path/to/project --agent codex --apply
python3 scripts/agent_tools.py check --project /path/to/project --agent codex
```

Preview writes no files. `--apply` copies the selected prompts and maintains a marked index in `AGENTS.md`; it preserves instructions outside that block. Use repeated `--skill` arguments to select fewer skills and repeat the same agent/selection when checking.

| Agent | Project skills | Command prompts |
| --- | --- | --- |
| Codex | `.agents/skills/` | Read `commands/*.md` as prompts |
| Claude Code | `.claude/skills/` | Add `--commands` to install `.claude/commands/` |
| Cursor | `.cursor/skills/` | Read `commands/*.md` as prompts |

Claude can import `AGENTS.md` from its existing `CLAUDE.md`; the installer does not edit that file. Discovery and slash-command behavior depend on the agent. Ask it which files it loaded, or supply a selected file directly.

## Check the consumer too

An installed prompt matching the bundle does not establish that the app uses matching SDK packages. [Check your setup](templates.md) checks the actual locks, installed package guides, copied skills, and root pointers. Keep npm-bundled Web/React guidance as the browser API source instead of copying a second frontend bundle from agent-tools.

These tools perform local file reads and selected copies. They do not install packages, launch a node, access credentials, sign, or submit transactions. Workflow prompts describe tasks for the agent; they are not an MCP server or executable scanner.

## Resolve installation conflicts

The installer refuses conflicting files, symlink destinations, and malformed context markers. Preserve local edits, compare the conflicting selected files, and preview again. There is no force-overwrite option.

Caught write failures roll back newly copied files; an interrupted process can leave partial copies. Check the displayed paths and rerun the same selection with one writer at a time. Preserve unrelated skills, SDK context, keys, and stores. Continue to [Troubleshooting](recover.md) for build or runtime failures.
