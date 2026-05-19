import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.jsx'

// Import FontAwesome core and icon sets
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'

// Add all icons to the library so they can be referenced by string names
library.add(fas, far, fab)

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <App />
  // </StrictMode>,
)
