import { useCallback, useSyncExternalStore } from 'react'

// Three states, not two. Following the phone is what the app does unless somebody says otherwise, and it is right nearly always -- the overrides exist for standing on a site in daylight with a phone stuck in dark mode.
export const HOW_IT_LOOKS = ['follow', 'light', 'dark'] as const
export type HowItLooks = (typeof HOW_IT_LOOKS)[number]

const DARK_SCHEME = '(prefers-color-scheme: dark)'
const REMEMBERED = 'howItLooks'

function isHowItLooks(value: string | null): value is HowItLooks {
  return value !== null && HOW_IT_LOOKS.some((how) => how === value)
}

export function howItLooksNow(): HowItLooks {
  try {
    const remembered = window.localStorage.getItem(REMEMBERED)
    return isHowItLooks(remembered) ? remembered : 'follow'
  } catch {
    // A phone with storage turned off follows the device, which is what it would have done anyway.
    return 'follow'
  }
}

// Following stamps nothing, so the media query in the stylesheet decides. A choice stamps the attribute, which beats the device in both directions.
export function applyHowItLooks(chosen: HowItLooks, prefersDark: boolean): void {
  const root = document.documentElement
  const dark = chosen === 'dark' || (chosen === 'follow' && prefersDark)

  if (chosen === 'follow') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', chosen)
  }

  // What stops scrollbars, date pickers and form controls staying the other mode's colour.
  root.style.colorScheme = dark ? 'dark' : 'light'

  // Clerk's own screens are styled from JavaScript rather than from these tokens, and this is what they read.
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
}

export function rememberHowItLooks(chosen: HowItLooks): void {
  try {
    window.localStorage.setItem(REMEMBERED, chosen)
  } catch {
    // Nothing to do: the choice holds for this sitting and the app follows the phone next time.
  }
}

// Runs in `<head>` before first paint, repeating what the module does because the bundle does not exist yet. Without it the page is drawn in one mode and repainted in the other.
export const THEME_INIT_SCRIPT = `(function(){try{var c=window.localStorage.getItem('${REMEMBERED}');var d=window.matchMedia('${DARK_SCHEME}').matches;var r=document.documentElement;if(c==='light'||c==='dark'){r.setAttribute('data-theme',c);d=c==='dark';}else{r.removeAttribute('data-theme');}r.style.colorScheme=d?'dark':'light';r.classList.toggle('dark',d);r.classList.toggle('light',!d);}catch(e){}})();`

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

const listeners = new Set<() => void>()

function subscribeToTheChoice(onChoiceChange: () => void): () => void {
  listeners.add(onChoiceChange)

  // Another tab of the same app, changed by the same person.
  window.addEventListener('storage', onChoiceChange)

  return () => {
    listeners.delete(onChoiceChange)
    window.removeEventListener('storage', onChoiceChange)
  }
}

export function useHowItLooks(): { chosen: HowItLooks; choose: (chosen: HowItLooks) => void; dark: boolean } {
  const prefersDark = usePrefersDark()
  const chosen = useSyncExternalStore(subscribeToTheChoice, howItLooksNow, () => 'follow' as HowItLooks)

  const choose = useCallback((choice: HowItLooks) => {
    rememberHowItLooks(choice)
    applyHowItLooks(choice, window.matchMedia(DARK_SCHEME).matches)

    // Told to every screen reading the choice, because `localStorage` says nothing on the tab that wrote it.
    for (const listener of listeners) {
      listener()
    }
  }, [])

  return { chosen, choose, dark: chosen === 'dark' || (chosen === 'follow' && prefersDark) }
}
