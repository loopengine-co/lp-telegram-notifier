# lp-telegram-notifier

A [loopengine](https://github.com/loopengine-co/loopengine) ability: a
`send_telegram_message` tool that sends a plain message to a Telegram
chat, group, or channel from a configured bot — relaying a summary,
finding, or notification somewhere a human will actually see it,
independent of actauth's own approval-notification mechanism — plus a
skill on how to use it well.

## What's in it

- **Tool** — `send_telegram_message(text, chat_id?, parse_mode?)`.
  Sends `text` to `chat_id`, or `TELEGRAM_DEFAULT_CHAT_ID` (or this
  agent's own per-agent override — see "Different default chat per
  agent" below) if omitted. `parse_mode` is optional — omit for plain
  text, or pass `"HTML"`/`"MarkdownV2"` to format it. Returns
  `{ chat_id, message_id, date }` on success. A failure surfaces
  Telegram's own `description` plainly (most commonly a wrong bot
  token, an unknown chat, a private-chat target who's never started a
  conversation with the bot, or the bot being removed from a
  group/channel).
- **Skill** — `telegram-notifying`: when this is the right tool versus
  just answering in the current conversation, why it's unrelated to
  actauth's own "ask" approval mechanism, and what makes a notification
  actually useful to read at a glance in a chat.
- **actauth rule** — `decision: allow`. Sending to an internal Telegram
  chat is visible to whoever's in it, but not public or permanent the
  way a social post is — see the rule's own comment for when to tighten
  this instead.

## Auth

A Telegram bot token, from [@BotFather](https://t.me/botfather) —
message it on Telegram, run `/newbot`, and follow the prompts. The
token looks like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`.

- `TELEGRAM_BOT_TOKEN` (secret).
- `TELEGRAM_DEFAULT_CHAT_ID` — a numeric chat/group/channel id (e.g.
  `"-1001234567890"`) or a public channel username (e.g.
  `"@mychannel"`) to send to when a call doesn't specify one.

**For a private chat, the target user must have already started a
conversation with the bot** (sent it `/start`) — Telegram doesn't let a
bot message a user cold. **For a group or channel, the bot must
already be a member** (and, for a channel, usually an admin able to
post) — add it the same way you'd add a human member.

No npm dependency needed — a single `fetch()` call against Telegram's
own Bot API, no SDK.

### Different default chat per agent

Installed under more than one agent, and each one should default to a
different chat? Set `<AGENT_NAME>_TELEGRAM_DEFAULT_CHAT_ID` (e.g.
`SUPPORT_TELEGRAM_DEFAULT_CHAT_ID` for an agent named `support`,
`SALES_TELEGRAM_DEFAULT_CHAT_ID` for one named `sales`) instead of — or
alongside — the shared `TELEGRAM_DEFAULT_CHAT_ID`. Each agent's own
installed copy of `send_telegram_message` checks its own override
first, and only falls back to the shared `TELEGRAM_DEFAULT_CHAT_ID`
when its own isn't set — so agents that don't need a different chat
can just leave it unset and keep using the shared one. The Admin UI's
Environment tab shows this per-agent override as its own row, right
alongside the shared default, for whichever agent's Environment tab
you're viewing.

## Install

```
npx loopengine add-ability lp-telegram-notifier --agent <your-agent>
```

Then set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_DEFAULT_CHAT_ID` (see
"Auth" above). No `npm install` step — this ability has no
dependencies of its own.

## Upgrading

```
npx loopengine upgrade-ability lp-telegram-notifier --agent <your-agent>
```

See loopengine's own `ABILITIES.md` for how abilities, installs, and
upgrades work in general — and remember that upgrading only rewrites
files on disk; the server process itself needs restarting afterward to
actually run the new code.
