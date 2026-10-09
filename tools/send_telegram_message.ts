import { agentScopedEnvVarName, inferAgentNameFromToolUrl } from 'loopengine'
import type { ToolDefinition } from 'loopengine'

// Telegram's own sendMessage carries a real HTTP status matching the
// result (401 for a bad token, 400 for an unknown/invalid chat, 403
// when the bot cannot message that chat) — unlike Slack's own
// chat.postMessage, which always answers 200. Checked via the response
// body's own `ok` field regardless (Telegram's own documented
// contract: the response always carries a boolean `ok`), since that is
// what actually carries `description` on failure.
function requireEnv(name: string, action: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${action}: ${name} must be set`)
  return value
}

// Resolved once at module load, same as lp-slack-notifier's own
// post_to_slack — there's exactly one .env/process.env for the whole
// project (see loopengine's own env-admin.ts), so two agents both
// installing this ability and relying on the bare
// TELEGRAM_DEFAULT_CHAT_ID would otherwise always message the same
// chat. undefined when this file isn't actually at the expected
// agents/<name>/tools/ depth (a test harness loading it from
// elsewhere) — the fallback chain below just skips the per-agent
// override entirely in that case.
const AGENT_NAME = inferAgentNameFromToolUrl(import.meta.url)

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
          'Optional — a numeric chat/group/channel id (e.g. "-1001234567890") or a public channel username (e.g. "@mychannel") to send to instead of this agent\'s own default chat (its own <AGENT_NAME>_TELEGRAM_DEFAULT_CHAT_ID override if set, else the shared TELEGRAM_DEFAULT_CHAT_ID).',
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
  execute: async (input) => {
    const text = String(input.text ?? '')
    if (!text) throw new Error('send_telegram_message: text is required')

    const token = requireEnv('TELEGRAM_BOT_TOKEN', 'send_telegram_message')
    const scopedChatId = AGENT_NAME ? process.env[agentScopedEnvVarName(AGENT_NAME, 'TELEGRAM_DEFAULT_CHAT_ID')] : undefined
    const chatId = (typeof input.chat_id === 'string' && input.chat_id ? input.chat_id : undefined) ?? scopedChatId ?? process.env.TELEGRAM_DEFAULT_CHAT_ID
    if (!chatId) {
      throw new Error(
        `send_telegram_message: no chat_id given, and neither ${AGENT_NAME ? `${agentScopedEnvVarName(AGENT_NAME, 'TELEGRAM_DEFAULT_CHAT_ID')} nor ` : ''}TELEGRAM_DEFAULT_CHAT_ID is set`,
      )
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
