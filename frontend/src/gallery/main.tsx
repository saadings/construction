import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { applyHowItLooks, howItLooksNow } from '../lib/theme'
import '../styles.css'
import { Gallery } from './Gallery'

// The app's own stylesheet and the app's own way of deciding light or dark, not copies of either. A gallery styled by anything else is a picture of a screen that does not exist.
applyHowItLooks(howItLooksNow(), window.matchMedia('(prefers-color-scheme: dark)').matches)

const where = document.getElementById('gallery')

if (where === null) {
  throw new Error('No gallery to draw into. `gallery.html` has lost its root.')
}

createRoot(where).render(
  <StrictMode>
    <Gallery />
  </StrictMode>
)
