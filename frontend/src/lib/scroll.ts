/**
 * React Router calls the first history entry of every page load "default", so <ScrollRestoration> would carry
 * one page's scroll position over to the next freshly opened URL. Give that entry a real key before the router
 * starts: new page loads then open at the top, while reloads and back/forward (same entry, same key) still restore.
 */
export function ensureHistoryKey() {
  const state = window.history.state as { key?: string } | null
  if (!state?.key) window.history.replaceState({ ...state, key: Math.random().toString(36).slice(2, 10) }, '')
}
