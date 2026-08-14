import { useSyncExternalStore } from 'react'

/**
 * The app follows the device, and only the device.
 *
 * There was a stored preference here, written by a toggle that nothing ever
 * rendered — so the branch that read it could never be reached, and the app
 * followed the device regardless. A setting that only looks like it does
 * something is worse than not having one, so the storage is gone and this is
 * the single source of the answer. A control to override it can come back
 * when there is a screen to put it on.
 */
const DARK_SCHEME = '(prefers-color-scheme: dark)'

/**
 * Puts the resolved scheme on `<html>`.
 *
 * Tailwind keys its dark styles off the `dark` class, and `colorScheme` is
 * what makes the browser's own furniture — scrollbars, date pickers, form
 * controls — match rather than staying stubbornly white.
 */
export function applyColourScheme(prefersDark: boolean): void {
  const root = document.documentElement

  root.classList.toggle('dark', prefersDark)
  root.classList.toggle('light', !prefersDark)
  root.style.colorScheme = prefersDark ? 'dark' : 'light'
}

/**
 * Runs in `<head>` before anything is painted, so the first frame is already
 * the right colour instead of a white flash on a dark phone.
 *
 * It repeats what `applyColourScheme` does because it has to run before the
 * bundle exists. The media query itself is shared, so the two cannot end up
 * asking different questions.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=window.matchMedia('${DARK_SCHEME}').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`

function subscribeToColourScheme(onSchemeChange: () => void): () => void {
  const media = window.matchMedia(DARK_SCHEME)

  media.addEventListener('change', onSchemeChange)

  return () => {
    media.removeEventListener('change', onSchemeChange)
  }
}

/**
 * True when the device is asking for dark.
 *
 * Read through `useSyncExternalStore` so a device that changes at sunset is
 * followed while the app is open, and so the prerendered HTML has a defined
 * answer to hydrate against rather than reaching for a `window` that is not
 * there yet.
 */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToColourScheme,
    () => window.matchMedia(DARK_SCHEME).matches,
    () => false
  )
}
