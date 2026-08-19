import { CallId } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import {
  formatApprovalPrompt,
  parseApprovalCommand,
  WeComApprovalRegistry,
} from '../src/approvals.js'

function request(signal?: AbortSignal): never {
  return {
    agent: {
      session: {
        events: [{
          type: 'tool/call',
          data: {
            callId: CallId('call-approval'),
            name: 'bash',
            arguments: JSON.stringify({ command: 'ls -la' }),
          },
        }],
      },
    },
    callId: CallId('call-approval'),
    toolName: 'bash',
    reason: 'Run a command',
    signal,
  } as never
}

describe('WeCom approval commands', () => {
  it('parses valid decisions and rejects malformed approval commands', () => {
    expect(parseApprovalCommand('/approve 123456')).toEqual({ code: '123456', outcome: 'allowed-once' })
    expect(parseApprovalCommand('/REJECT 654321')).toEqual({ code: '654321', outcome: 'rejected' })
    expect(parseApprovalCommand('/approve nope')).toBe('invalid')
    expect(parseApprovalCommand('ordinary text')).toBeUndefined()
  })

  it('renders the exact structured command without unrelated session content', () => {
    const prompt = formatApprovalPrompt(request(), '123456', 30_000)
    expect(prompt).toContain('Bash 请求执行：ls -la')
    expect(prompt).toContain('/approve 123456')
    expect(prompt).toContain('30 秒')
  })

  it('accepts one decision only from the originating conversation', async () => {
    const registry = new WeComApprovalRegistry(1_000)
    let prompt = ''
    const pending = registry.request('conversation-a', request(), async text => { prompt = text })
    const code = prompt.match(/\/approve ([0-9]{6})/u)?.[1]
    if (code === undefined) throw new Error('approval code was not rendered')

    expect(registry.decide('conversation-b', { code, outcome: 'allowed-once' })).toBeUndefined()
    expect(registry.decide('conversation-a', { code, outcome: 'allowed-once' })).toMatchObject({
      code,
      outcome: 'allowed-once',
      toolName: 'bash',
    })
    await expect(pending).resolves.toBe('allowed-once')
    expect(registry.decide('conversation-a', { code, outcome: 'rejected' })).toBeUndefined()
  })

  it('closes unavailable, cancelled, and aborted requests', async () => {
    const registry = new WeComApprovalRegistry(1_000)
    await expect(registry.request('send-failed', request(), async () => {
      throw new Error('send failed')
    })).resolves.toBe('unavailable')

    const cancelled = registry.request('cancelled', request(), vi.fn(async () => undefined))
    expect(registry.cancelConversation('cancelled')).toBe(true)
    await expect(cancelled).resolves.toBe('cancelled')

    const controller = new AbortController()
    const aborted = registry.request('aborted', request(controller.signal), vi.fn(async () => undefined))
    controller.abort()
    await expect(aborted).resolves.toBe('cancelled')
  })
})
