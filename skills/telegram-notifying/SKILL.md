---
name: telegram-notifying
description: When to use send_telegram_message versus just answering in this conversation, how to write a notification that's actually useful at a glance, and why this is unrelated to actauth's own approval-asking mechanism.
---

# Telegram notifying

`send_telegram_message` sends a plain message to a Telegram chat,
group, or channel from this agent's own configured bot. It's a one-way
notification — nobody is expected to respond to it the way an approval
request is, and nothing here waits for a reply. A common real use:
searching for something (X posts, recent commits, whatever), deciding
what's actually worth surfacing, and relaying a summary of it to a
chat a human actually watches — especially from a scheduled, unattended
routine (see lp-task-scheduler) where there's no live conversation for
the summary to land in otherwise.

## This is not the same thing as asking for approval

A tool call gated `ask` in actauth (and, for a scheduled/unattended
run, a durable approval via that agent's own `httpNotifier`) is a
*different* mechanism, built into the framework itself, not something
this ability provides. Don't reach for `send_telegram_message` as a
workaround to "ask permission before doing X" — it has no way to wait
for or collect a response at all; it just sends text. If the real need
is "a human should approve this before it happens," that's actauth's
own job (see HUMAN_IN_THE_LOOP.md), not this tool.

## Writing a useful notification

- Lead with what matters, not a preamble — "3 new mentions of AI agent
  frameworks on X, one worth a reply" beats "I searched X and here's
  what I found."
- Omit `parse_mode` for plain text (the safest default); pass `"HTML"`
  to format with Telegram's own tags (`<b>`, `<i>`, `<a href="...">`)
  when it genuinely helps scanning — `<b>` for the one-line takeaway, a
  link for a source. Avoid `"MarkdownV2"` unless every special
  character in the text is already escaped — Telegram rejects the
  whole message outright on an unescaped `.`, `-`, `!`, or several
  other characters MarkdownV2 treats as meaningful.
- If nothing worth surfacing came up, it's fine to say so briefly
  rather than sending a notification that says nothing — but whether to
  send "nothing today" at all, versus skip the message entirely,
  depends on whether silence itself would read as "didn't run" to
  whoever's watching that chat; say what's actually happening, don't
  guess.

## Chat id and failures

Omit `chat_id` to use this agent's own default chat
(`TELEGRAM_DEFAULT_CHAT_ID`) — and pass one explicitly
only when a specific call genuinely belongs somewhere else. A failure
here almost always means one of: the bot token is wrong, the target
chat doesn't exist, a private-chat target has never started a
conversation with the bot (Telegram won't let a bot message a user
cold), or the bot was removed from the group/channel.
