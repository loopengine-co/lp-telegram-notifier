import type { ToolDefinition } from 'loopengine'

// Telegram's own sendMessage carries a real HTTP status matching the
// result (401 for a bad token, 400 for an unknown/invalid chat, 403
// when the bot cannot message that chat) — unlike Slack's own
// chat.postMessage, which always answers 200. Checked via the response
// body's own `ok` field regardless (Telegram's own documented
// contract: the response always carries a boolean `ok`), since that is
// what actually carries `description` on failure.
//
// Settings come from ctx.env, not process.env: loopengine resolves them
// per agent (see loopengine.ability.json's `scope`). TELEGRAM_BOT_TOKEN
// is agent-scoped, so each agent sends as its own bot and never borrows
// another's; TELEGRAM_DEFAULT_CHAT_ID falls back to the shared value.

export const sendTelegramMessage: ToolDefinition = {
  name: 'send_telegram_message',
  description:
    'Send a message to a Telegram chat, group, or channel from this agent\'s own configured bot — e.g. to relay a summary, a finding, or a notification somewhere a human will actually see it. Not an approval mechanism (actauth\'s own "ask" + a durable httpNotifier already covers that, separately) — this just sends a plain message, with no response or decision expected back.',
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The message text — sent as plain text unless parse_mode is given.',
      },
      chat_id: {
        type: 'string',
        description:
          'Optional — a numeric chat/group/channel id (e.g. "-1001234567890") or a public channel username (e.g. "@mychannel") to send to instead of this agent\'s own default chat (TELEGRAM_DEFAULT_CHAT_ID).',
      },
      parse_mode: {
        type: 'string',
        enum: ['HTML', 'MarkdownV2'],
        description:
          'Optional — format text as Telegram HTML (<b>, <i>, <a href>, ...) or MarkdownV2 (which requires escaping most punctuation, or the whole message is rejected). Omit to send plain text with no formatting, the safest default.',
      },
    },
    required: ['text'],
  },
  execute: async (input, ctx) => {
    const text = String(input.text ?? '')
    if (!text) throw new Error('send_telegram_message: text is required')

    const token = ctx.env.require('TELEGRAM_BOT_TOKEN')
    const chatId = (typeof input.chat_id === 'string' && input.chat_id ? input.chat_id : undefined) ?? ctx.env.get('TELEGRAM_DEFAULT_CHAT_ID')
    if (!chatId) {
      throw new Error(`send_telegram_message: no chat_id given, and TELEGRAM_DEFAULT_CHAT_ID is not set for agent '${ctx.agentName}'`)
    }

    const payload: Record<string, unknown> = { chat_id: chatId, text }
    if (typeof input.parse_mode === 'string' && input.parse_mode) payload.parse_mode = input.parse_mode

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json()) as {
      ok: boolean
      result?: { message_id?: number; date?: number; chat?: { id?: number } }
      description?: string
      error_code?: number
    }
    if (!body.ok) {
      throw new Error(
        `send_telegram_message: Telegram API error ${body.error_code ?? res.status} "${body.description}" — common causes: the bot token is wrong, the chat does not exist, a private-chat target has never started a conversation with the bot, or the bot was removed from the group/channel.`,
      )
    }
    return JSON.stringify({ chat_id: body.result?.chat?.id ?? chatId, message_id: body.result?.message_id, date: body.result?.date })
  },
  // Sends a plain notification to a Telegram chat/group/channel —
  // visible to whoever is in it, but not public, permanent, or
  // attributed the way a social media post is; see actauth/rules.yml's
  // own comment for why that is allow, not ask, by default.
  safe: true,
}
