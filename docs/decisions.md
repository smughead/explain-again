# Design decisions

## Origin (October 4, 2026)

Built from Andrej Karpathy's post of October 1, 2026 on output formats for understanding language model work, ranked "but even better" each step: clear writing in ASD-STE100 (or "80% of the way" to it), diagrams, web pages, and custom explainer videos. The mod offers exactly those four, in that order.

## What shipped in v0.2.0

- Under the last piece of the latest long reply only (about 100 words or more), a row: gray "Explain another way" plus four of the app's own buttons.
- Clicking a format swaps the same row in place to "Format:" plus Send now (filled), Edit first and Back. Same height and spacing in both states, so nothing moves.
- `/explain` opens the same two-step choice above the message box; `/explain plain|diagram|page|video` sends at once.
- Requests are short and read like something a person would type. They are sent as the person's own words (they chose the button). Web pages and videos are saved outside the project.

## Keep the format on (v0.3.0, October 4, 2026)

The owner's request: picking a format should act like an output mode for the rest of the session, not a one-off.

- Send now, `/explain <format>`, or sending an Edit first draft turns the format on. A sent draft counts only if it still names the format ("video", "diagram", "page", "plain"); a draft rewritten into something else leaves it off.
- While it is on, each message the person sends (typed in the terminal or the desktop app, or from their phone or the web) carries a note Claude reads and the person never sees: do what they asked, then give long replies (about 100 words or more) in that format; keep short replies short. The mod's own requests carry no note, so a re-explanation never triggers another.
- Chosen over the alternative of letting Claude reply normally and then re-explaining automatically: that would cost two turns per long reply, and in video mode start a slow build after every reply.
- The row then reads "Explaining as a video", a Stop button, and the other three formats to switch to (through the usual Send now / Edit first step). `/explain off` also stops it.
- While a format is on, the row sits under every latest reply, short ones included. First live test: a diagram reply has little text, so under the length rule the row vanished exactly when the format was working. With no format on, short replies still get no row.
- The desktop Code tab hosts Claude Code through the SDK, so the person's messages there arrive as `sdk`, not `composer`. The first build counted only `composer` and silently skipped every desktop message.
- Session only: the choice is forgotten when the session ends.

## How we got here

1. A strip above the message box after every long reply, with all four formats. Worked, but it was disconnected from the reply.
2. A hover icon (⇄) on every reply that opened the strip. Too hidden, and the hover row could not sit next to the app's own reply icons.
3. Six entry points mocked up side by side (row under the latest reply, footer button, collapsible pill, suggestion in the message box, label on every reply, `/explain`). Chosen: the row under the latest reply, plus `/explain`.
4. Each format as a chip with a ✎ inside for "edit first", plus a one-time tip explaining the ✎. Two click targets per chip felt busy, and only the text was clickable.
5. The owner's idea, shipped: one button per format, and the send-or-edit choice appears only after a click.

## Platform limits found (Claude Code 2.1.286, desktop Code tab)

- A mod cannot add an action to the app's own reply hover row (copy, branch, pin, read aloud).
- Buttons: a `plain` Button draws as bare text whose hover hugs the text; padding or non-breaking spaces in the label do not widen it. A non-plain Button draws as the app's small bordered button; `primary` is filled dark.
- Mod buttons take text labels only, and there are no native tooltips. Custom tooltips placed by character offsets misalign on desktop.
- An element hidden until hover cannot itself be the hover target: keep the hovered box visible and hide a box inside it, or the whole drawing is refused.
- A refused drawing above the message box shows nothing at all. A refused drawing of a reply falls back to the app's own.
- Custom drawn regions (`Client`) are not available on desktop yet.
- Work started inside a slash command's handler is cut off when the command finishes; schedule it with `$.clock.after`.

## Open ideas


- Ask Anthropic to let plugins add actions to the reply hover row (draft request below).
- If the row starts to feel like wallpaper, show it only after dense, technical replies.

> **Let plugins add actions to the reply hover row.** In the desktop Code tab, each Claude reply has a hover row (copy, branch, pin, read aloud). Plugins can redraw a reply's text but can't add an action to that row. Request: a way for a plugin to register a reply action (icon, accessible label or tooltip, press handler) that appears in the existing hover row and receives the reply's text or id when pressed.
