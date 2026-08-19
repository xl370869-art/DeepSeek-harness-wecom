/** WeCom AI Bot channel bundle for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import { WeComHarnessBridge } from './bridge.js'
import { Config, type Config as WeComConfig } from './config.js'

export const name = 'deepseek-harness-wecom'
export const inject = [
  'agentDefaultModel',
  'agentPresets',
  'agents',
  'approval',
  'attachments',
  'commands',
  'credentials',
  'llm',
  'sessionPersistence',
  'systemPrompt',
]
export { Config }
export type { WeComConfig as ConfigType }
export { WeComHarnessBridge }
export { formatApprovalPrompt, parseApprovalCommand, WeComApprovalRegistry } from './approvals.js'
export type { ApprovalCommand, ResolvedApproval } from './approvals.js'
export { detectImageMediaType, inboundContent } from './inbound.js'
export { chatTarget, SeenMessageIds, sessionIdFor, truncateUtf8 } from './util.js'

interface WeComBridgeLifecycle {
  start(): Promise<void>
  stop(): Promise<void>
}

/** Mount the WeCom connection in the background and tie teardown to the Cordis plugin lifecycle. */
export function mountBridge(ctx: Context, bridge: WeComBridgeLifecycle): void {
  const log = ctx.logger('deepseek-harness-wecom')
  ctx.effect(() => {
    const startup = Promise.resolve().then(() => bridge.start()).catch(async (error: unknown) => {
      await Promise.allSettled([bridge.stop()])
      log.warn('WeCom channel remains offline: %s. Harness startup is unaffected.', String(error))
    })
    return async () => {
      await startup
      await bridge.stop()
    }
  }, 'deepseek-harness-wecom.websocket')
}

/** Create and mount the WeCom connection without awaiting external authentication. */
export function apply(ctx: Context, config: WeComConfig): void {
  const bridge = new WeComHarnessBridge(ctx, config)
  mountBridge(ctx, bridge)
}

export default { name, inject, Config, apply }
