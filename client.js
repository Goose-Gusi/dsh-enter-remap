/**
 * Client half: a pure key remapper.
 *
 * DSH's composer already implements every action this plugin needs:
 *   - Enter          -> send (busy delivery comes from the Composer Enter setting)
 *   - Ctrl/Cmd+Enter -> send through the complementary delivery
 *   - Shift+Enter    -> line break
 *
 * The plugin therefore never sends, inserts, or touches the draft itself. It
 * only rewrites the pressed key into the native combination that performs the
 * configured action, then lets DSH's own keymap run. Attachments, references,
 * draft clearing, undo history, queueing and steering all stay native.
 */

window.__ModuleLoader__.load({
  id: 'dsh-enter-remap',
  factory(require) {
    const DEFAULTS = {
      enter: 'newline',
      ctrlEnter: 'send',
      shiftEnter: 'busySend',
    }
    const BEHAVIORS = new Set(['newline', 'send', 'busySend'])
    const GLOBAL_KEY = '__DSH_ENTER_REMAP__'
    const EDITOR_SELECTOR = '[data-lexical-editor="true"]'
    // DSH's trigger menu (slash commands, @ references, ...) marks its surface
    // with data-trigger-menu and owns Enter while it is open (see
    // dsh-client-ui-input-trigger: arbitrate("enter") picks the highlight).
    const TRIGGER_MENU_SELECTOR = '[data-trigger-menu]'
    // Mirrors DSH's own composingUntil window (registerComposerKeymap): an
    // Enter that lands shortly after compositionend still belongs to the IME.
    const COMPOSITION_GRACE_MS = 10

    function readConfig() {
      const values = { ...DEFAULTS }
      try {
        const raw = window[GLOBAL_KEY]
        if (raw && typeof raw === 'object') {
          for (const key of Object.keys(DEFAULTS)) {
            if (BEHAVIORS.has(raw[key])) values[key] = raw[key]
          }
        }
      } catch {}
      return values
    }

    // Action -> native combination that performs it.
    // send     = Enter: busy delivery follows the "Composer Enter" setting.
    // busySend = Ctrl+Enter: busy delivery is the other mode (queue <-> steer).
    function combinationFor(action) {
      if (action === 'newline') return 'shift'
      if (action === 'busySend') return 'ctrl'
      return 'plain'
    }

    function combinationOf(slot) {
      if (slot === 'shiftEnter') return 'shift'
      if (slot === 'ctrlEnter') return 'ctrl'
      return 'plain'
    }

    function dispatchEnter(editor, combination, repeat) {
      // Re-key the original press into the native combination and let it
      // bubble from the editor root, exactly where DSH listens. `repeat` is
      // forwarded so a held key is treated like the native one (DSH
      // suppresses auto-repeats after preventDefault).
      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
        composed: true,
        repeat,
        shiftKey: combination === 'shift',
        ctrlKey: combination === 'ctrl',
        altKey: false,
        metaKey: false,
      }))
    }

    return {
      apply(ctx) {
        let remapping = false
        // Composition bookkeeping, mirroring DSH's own guard (see
        // COMPOSITION_GRACE_MS above). `composingUntil` is only meaningful for
        // the short window right after compositionend.
        let composing = false
        let composingUntil = 0

        const onCompositionStart = () => {
          composing = true
        }
        const onCompositionEnd = () => {
          composing = false
          composingUntil = Date.now() + COMPOSITION_GRACE_MS
        }

        const onKeyDown = (event) => {
          if (remapping) return
          if (event.key !== 'Enter') return
          if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return

          // An Enter arriving right after compositionend (Safari delivers the
          // confirming Enter with isComposing === false) belongs to the IME:
          // let it through unchanged, exactly like DSH's recentlyComposing()
          // guard. Remapping it would turn a Chinese IME confirmation into an
          // extra line break.
          if (composing || Date.now() < composingUntil) return

          const target = event.target
          if (!target || typeof target.closest !== 'function') return
          const editor = target.closest(EDITOR_SELECTOR)
          if (!editor) return

          // Mirrors DSH's own Enter filter (registerComposerKeymap): Alt and the
          // AltGraph/AltGr combination pass through untouched, and native
          // swallows Ctrl+Meta+Enter and Shift+Ctrl/Meta+Enter, so keep those
          // native instead of turning them into a send.
          const altGraph = typeof event.getModifierState === 'function' && event.getModifierState('AltGraph')
          if (event.altKey || altGraph || (event.ctrlKey && event.metaKey)) return
          if (event.shiftKey && (event.ctrlKey || event.metaKey)) return

          // While the trigger menu is open, Enter belongs to the menu: it
          // picks the highlighted candidate and falls through to send only
          // when nothing is highlighted. Remapping it to Shift+Enter would
          // skip that arbitration and insert a line break instead.
          if (document.querySelector(TRIGGER_MENU_SELECTOR) !== null) return

          const shift = event.shiftKey
          const ctrl = event.ctrlKey || event.metaKey
          const slot = shift ? 'shiftEnter' : ctrl ? 'ctrlEnter' : 'enter'

          // Read on every press so a runtime update of the injected global
          // takes effect without reloading the page.
          const config = readConfig()
          const action = config[slot]
          if (!action) return

          const combination = combinationFor(action)
          if (combination === combinationOf(slot)) return

          event.preventDefault()
          event.stopImmediatePropagation()
          remapping = true
          try {
            dispatchEnter(editor, combination, event.repeat)
          } finally {
            remapping = false
          }
        }

        ctx.effect(() => {
          window.addEventListener('keydown', onKeyDown, true)
          window.addEventListener('compositionstart', onCompositionStart, true)
          window.addEventListener('compositionend', onCompositionEnd, true)
          return () => {
            window.removeEventListener('keydown', onKeyDown, true)
            window.removeEventListener('compositionstart', onCompositionStart, true)
            window.removeEventListener('compositionend', onCompositionEnd, true)
          }
        })
      },
    }
  },
})
