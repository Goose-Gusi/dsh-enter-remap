/**
 * Host half.
 *
 * The only job here is to publish this plugin's three configuration values to
 * the browser page. DSH already exposes an official channel for that: the
 * structured index-injection table (`webserver/index-inject`), which renders
 * `window.__DSH_ENTER_REMAP__` before any client plugin runs. No route, no
 * HTTP call, no settings namespace, and nothing about DSH itself is touched.
 *
 * If the injection never happens (for example a host without a web server),
 * the client half falls back to the same defaults.
 */

export const name = 'dsh-enter-remap'

const DEFAULTS = Object.freeze({
  enter: 'newline',
  ctrlEnter: 'send',
  shiftEnter: 'busySend',
})

const BEHAVIORS = new Set(['newline', 'send', 'busySend'])

function normalize(config) {
  const values = { ...DEFAULTS }
  if (config && typeof config === 'object') {
    for (const key of Object.keys(DEFAULTS)) {
      if (BEHAVIORS.has(config[key])) values[key] = config[key]
    }
  }
  return values
}

export function apply(ctx, config) {
  const values = normalize(config)
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: '__DSH_ENTER_REMAP__', value: values })
  })
}
