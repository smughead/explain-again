# Explain Again

A Claude Code mod that re-explains Claude's latest long reply in a format that is easier to take in: in plain English, as a diagram, as a web page, or as a video.

It grew out of Andrej Karpathy's post of October 1, 2026 about output formats for understanding what language models produce: clear controlled writing (ASD-STE100), diagrams, web pages and explainer videos. As AI does more of the work, more of our job becomes understanding it. This mod puts those formats one click away, right where a reply loses you.

## What you see

Under Claude's latest long reply (about 100 words or more):

```
Explain another way   [In plain English]   [As a diagram]   [As a web page]   [As a video]
```

Click one and the same row turns into a choice:

```
As a diagram:   [Send now]   [Edit first]   Back
```

- **Send now** asks Claude right away.
- **Edit first** puts the request in your message box so you can adjust it before sending.
- **Back** returns to the four formats.

The format you pick then stays on for the rest of the session: every later long reply comes in that format, with no extra click. Under the latest reply (short ones too, while a format is on) the row shows what is on, a Stop button, and the other formats if you want to switch:

```
Explaining as a video   [Stop]   Switch to   [In plain English]   [As a diagram]   [As a web page]
```

**Edit first** turns the format on once you send the draft, as long as it still asks for that format (for example, it still says "video"). The choice is forgotten when the session ends.

The row moves to each new long reply, steps aside while Claude is working, and never appears under short answers. Web pages and videos are saved outside your project, so your code folders stay clean.

## Commands

- `/explain` opens the same choice above the message box, for your last reply.
- `/explain plain`, `/explain diagram`, `/explain page` or `/explain video` sends right away and keeps that format on.
- `/explain off` stops it.

## Install

**From GitHub** (you need access to this repository while it is private):

```
claude plugin marketplace add smughead/explain-again
claude plugin install explain-again@explain-again
```

**For development** (live editing): point Claude Code at this folder in `~/.claude/settings.json`. Terminal sessions reload the mod whenever a file changes. Desktop app sessions only do so with `CLAUDE_CODE_PLUGIN_DIR_WATCH` set; without it they keep the version they started with, so test changes in a new session.

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/Documents/projects/explain-again", "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1" } }
```

Either way, the setting is read when a session starts.

Requires Claude Code 2.1.286 or later. Works in the desktop app's Code tab and in the terminal.

## Develop

Use the Claude Code build that ships with the desktop app (a standalone `claude` may be too old for mods):

```
claude plugin validate ./.claude-plugin/plugin.json
claude plugin validate .
claude plugin test .
```

The first line checks the mod itself; the second checks the install file (`marketplace.json`).

Why the mod looks and behaves the way it does, and what the platform can't do yet: [docs/decisions.md](docs/decisions.md).
