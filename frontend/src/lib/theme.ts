import { useSyncExternalStore } from 'react'

// The app follows the device and only the device; an override can return when there is a screen to put it on.
const DARK_SCHEME = '(prefers-color-scheme: dark)'

// Tailwind keys dark styles off the class; `colorScheme` is what stops scrollbars and date pickers staying white.
export function applyColourScheme(prefersDark: boolean): void {
  const root = document.documentElement

  root.classList.toggle('dark', prefersDark)
  root.classList.toggle('light', !prefersDark)
  root.style.colorScheme = prefersDark ? 'dark' : 'light'
}

// Runs in `<head>` before first paint, repeating applyColourScheme because the bundle does not exist yet.
export const THEME_INIT_SCRIPT = `(function(){try{var d=window.matchMedia('${DARK_SCHEME}').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`

function subscribeToColourScheme(onSchemeChange: () => void): () => void {
  const media = window.matchMedia(DARK_SCHEME)

  media.addEventListener('change', onSchemeChange)

  return () => {
    media.removeEventListener('change', onSchemeChange)
  }
}

// Through `useSyncExternalStore` so sunset is followed live, and so prerendered HTML has something to hydrate against.
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToColourScheme,
    () => window.matchMedia(DARK_SCHEME).matches,
    () => false
  )
}
