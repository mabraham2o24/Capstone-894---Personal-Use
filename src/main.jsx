import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Provides routing/navigation functionality to the entire application */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)