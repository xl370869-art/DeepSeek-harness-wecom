import { describe, expect, it, vi } from 'vitest'
import { inspectSession } from '../src/session-read.js'
import { resolveSessionPreset } from '../src/session-preset.js'

describe('DSH 0.2 session reads', () => {
  it('releases an observed cut and retains the last selected preset on resume', async () => {
    const release = vi.fn()
    const events = [
      { type: 'agent-preset/selected', data: { agentPreset: 'changed' } },
      { type: 'agent-preset/selected', data: { agentPreset: 'latest' } },
    ]
    const ctx = { sessionQuery: { observeSession: vi.fn(async () => ({
      header: { id: 'resume', agentPreset: 'initial' }, events,
      [Symbol.dispose]: release,
    })) } }
    const inspected = await inspectSession(ctx as never, 'resume' as never)
    events.length = 0
    expect(resolveSessionPreset({ header: inspected.meta, events: inspected.events })).toBe('latest')
    expect(release).toHaveBeenCalledOnce()
    expect(ctx.sessionQuery.observeSession).toHaveBeenCalledWith('resume', { projectionMode: 'none' })
  })

  it('releases the lease even if the observed log cannot be materialized', async () => {
    const release = vi.fn()
    const ctx = { sessionQuery: { observeSession: async () => ({
      header: {}, get events() { throw new Error('corrupt log') },
      [Symbol.dispose]: release,
    }) } }
    await expect(inspectSession(ctx as never, 'broken' as never)).rejects.toThrow('corrupt log')
    expect(release).toHaveBeenCalledOnce()
  })
})
