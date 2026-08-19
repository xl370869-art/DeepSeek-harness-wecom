import { describe, expect, it, vi } from 'vitest'
import { mountBridge } from '../src/index.js'

describe('WeCom plugin lifecycle', () => {
  it('does not await external startup and cleans up after it settles', async () => {
    const deferred = Promise.withResolvers<void>()
    let dispose: (() => Promise<void>) | undefined
    const bridge = {
      start: vi.fn(() => deferred.promise),
      stop: vi.fn(async () => undefined),
    }
    const ctx = {
      logger: vi.fn(() => ({ warn: vi.fn() })),
      effect: vi.fn((setup: () => () => Promise<void>) => {
        dispose = setup()
      }),
    }

    expect(mountBridge(ctx as never, bridge)).toBeUndefined()
    await Promise.resolve()
    expect(bridge.start).toHaveBeenCalledOnce()
    expect(bridge.stop).not.toHaveBeenCalled()

    deferred.resolve()
    await dispose?.()
    expect(bridge.stop).toHaveBeenCalledOnce()
  })

  it('keeps Harness running when background startup fails', async () => {
    let dispose: (() => Promise<void>) | undefined
    const warn = vi.fn()
    const bridge = {
      start: vi.fn(async () => { throw new Error('authentication unavailable') }),
      stop: vi.fn(async () => undefined),
    }
    const ctx = {
      logger: vi.fn(() => ({ warn })),
      effect: vi.fn((setup: () => () => Promise<void>) => {
        dispose = setup()
      }),
    }

    mountBridge(ctx as never, bridge)
    await dispose?.()

    expect(bridge.stop).toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Harness startup is unaffected'),
      expect.stringContaining('authentication unavailable'),
    )
  })
})
