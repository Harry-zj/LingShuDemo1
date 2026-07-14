import { ref, onBeforeUnmount } from 'vue'

/**
 * Typewriter text effect.
 * Usage: const { displayText, startTyping } = useTypewriter({ speed: 40 })
 * Call startTyping('full text to type out') when the element becomes visible.
 */
export function useTypewriter(opts = {}) {
  const { speed = 45, startDelay = 200 } = opts
  const displayText = ref('')
  let timer = null
  let cancelled = false

  function startTyping(fullText) {
    cancelled = false
    displayText.value = ''
    let i = 0
    const text = fullText || ''

    function type() {
      if (cancelled) return
      if (i <= text.length) {
        displayText.value = text.slice(0, i)
        i++
        const delay = i === 1 ? startDelay : speed
        timer = setTimeout(type, delay)
      }
    }
    type()
  }

  function stop() {
    cancelled = true
    if (timer) clearTimeout(timer)
  }

  onBeforeUnmount(stop)

  return { displayText, startTyping, stop }
}
