/**
 * Client half: a pure key remapper plus the page that edits its mapping.
 *
 * DSH's composer already implements every action this plugin can offer:
 *   - Enter          -> send (busy delivery comes from the Composer Enter setting)
 *   - Ctrl/Cmd+Enter -> send through the complementary delivery
 *   - Shift+Enter    -> line break
 *
 * The plugin therefore never sends, inserts, or touches the draft itself. It
 * only rewrites the pressed key into the native combination that performs the
 * configured action, then lets DSH's own keymap run. Attachments, references,
 * draft clearing, undo history, queueing and steering all stay native.
 *
 * The mapping is edited on one shared page, registered both as the plugin
 * row's own configuration page and as a Settings section. Picking the action
 * another key already uses swaps the two, so the three keys always keep the
 * three native behaviours and a single click performs e.g. "Enter <-> Ctrl+
 * Enter".
 */

window.__ModuleLoader__.load({
  id: 'dsh-enter-remap',
  factory(require) {
    const React = require('react')

    const ENTRY_ID = 'dsh-enter-remap'
    const NS = 'dsh-enter-remap'
    const ROW_KEY = 'dsh-enter-remap#dsh-enter-remap'
    const DEFAULTS = {
      enter: 'newline',
      ctrlEnter: 'send',
      shiftEnter: 'busySend',
    }
    const BEHAVIORS = ['newline', 'send', 'busySend']
    const SLOT_KEYS = ['enter', 'ctrlEnter', 'shiftEnter']
    const GLOBAL_KEY = '__DSH_ENTER_REMAP__'
    const EDITOR_SELECTOR = '[data-lexical-editor="true"]'
    // DSH's trigger menu (slash commands, @ references, ...) marks its surface
    // with data-trigger-menu and owns Enter while it is open (see
    // dsh-client-ui-input-trigger: arbitrate("enter") picks the highlight).
    const TRIGGER_MENU_SELECTOR = '[data-trigger-menu]'
    // Mirrors DSH's own composingUntil window (registerComposerKeymap): an
    // Enter that lands shortly after compositionend still belongs to the IME.
    const COMPOSITION_GRACE_MS = 10

    const zh = {
      'nav': 'Enter键重映射',
      'slot.enter': 'Enter',
      'slot.shiftEnter': 'Shift + Enter',
      'slot.ctrlEnter': 'Ctrl / Cmd + Enter',
      'action.newline': '换行',
      'action.send': '发送（Enter 键语义）',
      'action.busySend': '发送（Ctrl+Enter 键语义）',
    }

    const en = {
      'nav': 'Enter remap',
      'slot.enter': 'Enter',
      'slot.shiftEnter': 'Shift + Enter',
      'slot.ctrlEnter': 'Ctrl / Cmd + Enter',
      'action.newline': 'Line break',
      'action.send': 'Send (Enter key semantics)',
      'action.busySend': 'Send (Ctrl+Enter key semantics)',
    }

    function normalizeValues(raw) {
      const values = { ...DEFAULTS }
      if (raw && typeof raw === 'object') {
        for (const key of SLOT_KEYS) {
          if (BEHAVIORS.includes(raw[key])) values[key] = raw[key]
        }
      }
      return values
    }

    function readGlobal() {
      try {
        return normalizeValues(window[GLOBAL_KEY])
      } catch {
        return { ...DEFAULTS }
      }
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

    /**
     * The live mapping: the settings namespace while the Host serves it, the
     * injected global on pages where it does not (and as the initial value).
     */
    function readConfig(form) {
      if (form) {
        try {
          const snapshot = form.getSnapshot()
          if (snapshot && snapshot.status === 'ready' && snapshot.value) {
            return normalizeValues(snapshot.value)
          }
        } catch {}
      }
      return readGlobal()
    }

    function installRemap(ctx, getForm) {
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

        // While the trigger menu is open, Enter belongs to the menu: it picks
        // the highlighted candidate and falls through to send only when
        // nothing is highlighted. Remapping it to Shift+Enter would skip that
        // arbitration and insert a line break instead.
        if (document.querySelector(TRIGGER_MENU_SELECTOR) !== null) return

        const shift = event.shiftKey
        const ctrl = event.ctrlKey || event.metaKey
        const slot = shift ? 'shiftEnter' : ctrl ? 'ctrlEnter' : 'enter'

        // Read on every press so a settings change applies to the next key
        // press without reloading the page.
        const action = readConfig(getForm())[slot]
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
    }

    // Chevrons match the ones the host draws on its own controls.
    const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"

    // Hover, focus, dividers and the open-menu animation cannot be expressed
    // inline, so one scoped rule set is rendered with the page; every class
    // carries the plugin prefix.
    const pageCss = [
      '.dsh-enter-remap-row { border-bottom: .5px solid var(--dsw-alias-border-l2); }',
      '.dsh-enter-remap-row:last-child { border-bottom: 0; }',
      '.dsh-enter-remap-trigger:hover:not(:disabled) { background-color: var(--dsw-alias-interactive-bg-hover); }',
      '.dsh-enter-remap-trigger:focus-visible { border-color: var(--dsw-alias-state-business-primary); outline: none; }',
      '.dsh-enter-remap-trigger[data-open="true"] { border-color: var(--dsw-alias-state-business-primary); }',
      '.dsh-enter-remap-trigger[data-open="true"] .dsh-enter-remap-chevron { transform: rotate(180deg); }',
      '.dsh-enter-remap-trigger:disabled { cursor: default; opacity: .6; }',
      '.dsh-enter-remap-option:hover, .dsh-enter-remap-option[data-active="true"] { background-color: var(--dsw-alias-interactive-bg-hover); }',
      '.dsh-enter-remap-option:focus-visible { outline: none; }',
    ].join('\n')

    const pageStyle = {
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '560px',
    }
    // One list line per key: label on the left, the rounded control on the right.
    const rowStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      boxSizing: 'border-box',
      padding: '10px 2px',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '14px',
      lineHeight: '22px',
    }
    const labelStyle = { flex: 'none' }
    // Closed state of the custom select: same size, stroke and radius as the
    // native one it replaces.
    const triggerStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      width: '240px',
      height: '32px',
      boxSizing: 'border-box',
      padding: '0 10px 0 12px',
      border: '.5px solid var(--dsw-alias-border-l4)',
      borderRadius: 'var(--dsw-radius-md)',
      backgroundColor: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)',
      fontFamily: 'inherit',
      fontSize: '14px',
      lineHeight: '22px',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'background-color .16s, border-color .16s',
    }
    const valueStyle = {
      flex: '1 1 auto',
      minWidth: '0',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }
    const chevronStyle = {
      flex: 'none',
      width: '12px',
      height: '12px',
      backgroundImage: CHEVRON,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: '12px 12px',
      transition: 'transform .16s',
    }
    // The open list is a real popup: own surface, radius, shadow and hover, so
    // it rounds like the rest of the page instead of the system's native menu.
    const menuStyle = {
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: '0',
      right: '0',
      zIndex: '40',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '4px',
      border: '.5px solid var(--dsw-alias-border-l3)',
      borderRadius: 'var(--dsw-radius-md)',
      backgroundColor: 'var(--dsw-alias-bg-layer-2)',
      boxShadow: 'var(--dsw-shadow-lv3)',
    }
    const optionStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      boxSizing: 'border-box',
      width: '100%',
      minHeight: '28px',
      margin: '0',
      padding: '3px 8px',
      border: '0',
      borderRadius: 'var(--dsw-radius-sm)',
      backgroundColor: 'transparent',
      color: 'var(--dsw-alias-label-primary)',
      fontFamily: 'inherit',
      fontSize: '14px',
      lineHeight: '20px',
      textAlign: 'left',
      cursor: 'pointer',
    }
    const optionLabelStyle = {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }
    const checkStyle = {
      flex: 'none',
      color: 'var(--dsw-alias-state-business-primary)',
      fontSize: '12px',
      lineHeight: '1',
    }

    /**
     * The one page both slots render.
     *
     * `props.form` is the row page's own form controller (`{state, mutate}`,
     * supplied by the Plugins page); the Settings section has none and reads
     * the shared `configForms` controller instead.
     */
    function makePage(t, getForm) {
      return function RemapSettingsPage(props) {
        const ownerForm = (props && props.form) || undefined
        const controller = ownerForm ? undefined : getForm()
        const source = ownerForm || controller
        const [, force] = React.useState(0)
        const [openSlot, setOpenSlot] = React.useState(null)
        const [activeIndex, setActiveIndex] = React.useState(-1)
        const openRef = React.useRef(null)

        React.useEffect(() => {
          if (!source || typeof source.subscribe !== 'function') return undefined
          const off = source.subscribe(() => force((value) => value + 1))
          return typeof off === 'function' ? off : undefined
        }, [source])

        // While a list is open: a press anywhere else closes it, Escape closes
        // it, and the row keeps the page's stacking order.
        React.useEffect(() => {
          if (!openSlot) return undefined
          const onPointerDown = (event) => {
            if (openRef.current && openRef.current.contains(event.target)) return
            setOpenSlot(null)
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpenSlot(null)
          }
          document.addEventListener('pointerdown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown, true)
          return () => {
            document.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown, true)
          }
        }, [openSlot])

        if (props && props.view === 'summary') return null

        const snapshot = ownerForm
          ? ownerForm.state
          : controller
            ? controller.getSnapshot()
            : undefined
        const values = normalizeValues(snapshot && snapshot.value)
        const writable = Boolean(source) && (!snapshot || snapshot.writable !== false)
        const mutate = ownerForm
          ? ownerForm.mutate
          : controller
            ? (operations, revision) => controller.mutate(operations, revision)
            : undefined

        const close = () => {
          setOpenSlot(null)
          setActiveIndex(-1)
        }

        const choose = (slot, action) => {
          if (!mutate || values[slot] === action) return
          // The three keys keep the three native behaviours: picking the action
          // another key currently owns hands that key this one's action.
          const other = SLOT_KEYS.find((key) => key !== slot && values[key] === action)
          const operations = [{ op: 'set', path: [slot], value: action }]
          if (other) operations.push({ op: 'set', path: [other], value: values[slot] })
          Promise.resolve(mutate(operations, snapshot && snapshot.revision)).catch(() => {})
        }

        const pick = (slot, action) => {
          choose(slot, action)
          close()
        }

        const open = (slot) => {
          setOpenSlot(slot)
          setActiveIndex(BEHAVIORS.indexOf(values[slot]))
        }

        const onTriggerKeyDown = (event, slot) => {
          if (!writable) return
          const isOpen = openSlot === slot
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!isOpen) {
              open(slot)
              return
            }
            const base = activeIndex < 0 ? BEHAVIORS.indexOf(values[slot]) : activeIndex
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActiveIndex((base + step + BEHAVIORS.length) % BEHAVIORS.length)
            return
          }
          if (!isOpen) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            const index = activeIndex < 0 ? BEHAVIORS.indexOf(values[slot]) : activeIndex
            pick(slot, BEHAVIORS[index])
          }
        }

        return React.createElement(
          'div',
          { style: pageStyle },
          React.createElement('style', { dangerouslySetInnerHTML: { __html: pageCss } }),
          ...SLOT_KEYS.map((slot) => {
            const isOpen = openSlot === slot
            return React.createElement(
              'div',
              { key: slot, className: 'dsh-enter-remap-row', style: rowStyle },
              React.createElement(
                'span',
                { id: `dsh-enter-remap-label-${slot}`, style: labelStyle },
                t(`slot.${slot}`),
              ),
              React.createElement(
                'div',
                {
                  className: 'dsh-enter-remap-field',
                  ref: isOpen ? openRef : undefined,
                  style: { position: 'relative', zIndex: isOpen ? '30' : undefined },
                },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-enter-remap-trigger',
                    'data-open': isOpen ? 'true' : 'false',
                    disabled: !writable,
                    'aria-haspopup': 'listbox',
                    'aria-expanded': isOpen,
                    'aria-labelledby': `dsh-enter-remap-label-${slot}`,
                    style: triggerStyle,
                    onClick: () => {
                      if (!writable) return
                      if (isOpen) close()
                      else open(slot)
                    },
                    onKeyDown: (event) => onTriggerKeyDown(event, slot),
                  },
                  React.createElement('span', { style: valueStyle }, t(`action.${values[slot]}`)),
                  React.createElement('span', {
                    className: 'dsh-enter-remap-chevron',
                    'aria-hidden': 'true',
                    style: chevronStyle,
                  }),
                ),
                isOpen && React.createElement(
                  'div',
                  {
                    className: 'dsh-enter-remap-menu',
                    role: 'listbox',
                    'aria-labelledby': `dsh-enter-remap-label-${slot}`,
                    style: menuStyle,
                  },
                  ...BEHAVIORS.map((action, index) => React.createElement(
                    'button',
                    {
                      key: action,
                      type: 'button',
                      role: 'option',
                      className: 'dsh-enter-remap-option',
                      'aria-selected': values[slot] === action,
                      'data-active': activeIndex === index ? 'true' : undefined,
                      style: optionStyle,
                      onMouseEnter: () => setActiveIndex(index),
                      onClick: () => pick(slot, action),
                    },
                    React.createElement(
                      'span',
                      { style: optionLabelStyle },
                      t(`action.${action}`),
                    ),
                    values[slot] === action && React.createElement(
                      'span',
                      { style: checkStyle, 'aria-hidden': 'true' },
                      '✓',
                    ),
                  )),
                ),
              ),
            )
          }),
        )
      }
    }

    return {
      name: 'dsh-enter-remap',
      inject: ['slots', 'locale'],

      apply(ctx) {
        let form = null

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-enter-remap: dictionaries')
        const t = ctx.locale.bind(NS)

        installRemap(ctx, () => form)

        // The page only makes sense while the Host serves the namespace, so it
        // is registered with the settings service in reach. A Host without it
        // still gets the remap from the injected global.
        ctx.inject(['configForms'], (child) => {
          form = child.configForms ? child.configForms.get(ENTRY_ID) : null
          if (!form) return
          const Page = makePage(t, () => form)

          // The plugin's own row on the Plugins page: the "Configure" control
          // that opens this page.
          child.slots.inject('plugins.row.config', () => child.slots.register({
            name: 'plugins.row.config',
            key: ROW_KEY,
            locale: NS,
          }, Page))

          // The same page as a Settings section, for people who look for the
          // mapping there first.
          child.slots.inject('settings.section', () => child.slots.register({
            name: 'settings.section',
            id: 'enter-remap',
            order: 45,
            label: () => t('nav'),
            locale: NS,
          }, Page))
        })
      },
    }
  },
})
