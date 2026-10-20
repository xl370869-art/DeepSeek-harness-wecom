import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-query'

/** Release the observation lease after copying its immutable event cut. */
export async function inspectSession(ctx: Context, id: SessionId) {
  const observation = await ctx.sessionQuery.observeSession(id, { projectionMode: 'none' })
  try {
    return { meta: observation.header, events: [...observation.events] }
  } finally {
    observation[Symbol.dispose]()
  }
}

export async function readSessionEvents(ctx: Context, id: SessionId) {
  return (await inspectSession(ctx, id)).events
}
