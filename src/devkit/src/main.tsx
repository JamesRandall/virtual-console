import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { VirtualConsoleProvider } from './consoleIntegration/virtualConsole.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VirtualConsoleProvider>
      <App />
    </VirtualConsoleProvider>
  </StrictMode>,
)
