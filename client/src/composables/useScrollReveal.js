/**
 * Page-entry scroll reveal. Triggers once when elements enter viewport.
 */
export function useScrollReveal() {
  let observer = null

  function setupObserver(containerRef, onReveal) {
    if (!containerRef) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            if (onReveal) onReveal(entry.target)
            observer.unobserve(entry.target)
          }
        }
      },
      { root: null, rootMargin: '0px 0px -80px 0px', threshold: 0.1 }
    )

    const targets = containerRef.querySelectorAll('.reveal-on-scroll')
    for (const el of targets) observer.observe(el)
  }

  function cleanup() {
    if (observer) { observer.disconnect(); observer = null }
  }

  return { setupObserver, cleanup }
}
