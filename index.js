/**
 * Host half.
 *
 * Two jobs, both passive:
 *
 * 1. Publish the three configuration values to the browser page through the
 *    official index-injection table (`webserver/index-inject`), which renders
 *    `window.__DSH_ENTER_REMAP__` before any client plugin runs. The client
 *    half uses it when the settings service is unavailable.
 *
 * 2. Declare the plugin's `Config` so DSH's settings service derives the
 *    `dsh-enter-remap` namespace for it. The client half registers the page
 *    that edits that namespace, and keeps listening to it, so a change applies
 *    on the next key press without a reload.
 *
 * No route, no HTTP call, and nothing about DSH itself is touched. Every field
 * is `volatile()`: a settings edit is committed into the running fiber instead
 * of remounting the plugin, which is exactly what a key mapping wants.
 */

export const name = 'dsh-enter-remap'

export const DEFAULTS = Object.freeze({
  enter: 'newline',
  ctrlEnter: 'send',
  shiftEnter: 'busySend',
})

export const BEHAVIORS = Object.freeze(['newline', 'send', 'busySend'])

/**
 * `@deepseek-ai/schemastery` is part of the Harness installation, so a plugin
 * loaded from a profile resolves it through DSH's own runtime package routing
 * (the same way the bundled plugins import it). The import stays defensive: if
 * a future host stops exposing it, the remap itself keeps working from the
 * injected values and only the settings namespace goes away.
 */
let Schema = null
try {
  Schema = (await import('@deepseek-ai/schemastery')).default
} catch {}

/** One "pick one of the three actions" field, live-editable without a remount. */
function field(fallback) {
  return Schema.union([...BEHAVIORS]).default(fallback).volatile()
}

export const Config = Schema === null || Schema === undefined
  ? undefined
  : Schema.object({
    enter: field(DEFAULTS.enter),
    ctrlEnter: field(DEFAULTS.ctrlEnter),
    shiftEnter: field(DEFAULTS.shiftEnter),
  })

/** Read one config field, which the running fiber may hold as a volatile reference. */
function readField(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value
}

function normalize(config) {
  const values = { ...DEFAULTS }
  if (config !== null && typeof config === 'object') {
    for (const key of Object.keys(DEFAULTS)) {
      const value = readField(config[key])
      if (BEHAVIORS.includes(value)) values[key] = value
    }
  }
  return values
}

export function apply(ctx, config) {
  ctx.on('webserver/index-inject', (table) => {
    // The callback runs when a page is rendered, so reading the references
    // here (instead of once at mount) hands the page the current mapping.
    table.push({ kind: 'global', name: '__DSH_ENTER_REMAP__', value: normalize(config) })
  })

  ctx.inject(['settings'], (child) => {
    // The plugin owns its page; there is no generated form to race with it.
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
