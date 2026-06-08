import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resetDemoWorkflowOnPageLoad } from './utils/demoWorkflowReset'

resetDemoWorkflowOnPageLoad()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
