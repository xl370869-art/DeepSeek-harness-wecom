import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type { SessionInspection } from '@deepseek-ai/dsh-session-persistence'

/** Match the upstream agentPreset projection, including selections made after creation. */
export function resolveSessionPreset(session: {
  header: SessionInspection['meta']
  events: SessionInspection['events']
}): string | undefined {
  let preset = session.header.agentPreset
  for (const event of session.events) {
    if (event.type === 'agent-preset/selected') preset = event.data.agentPreset
  }
  return preset
}
