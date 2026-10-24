import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CartSession } from './features/buyer/api/BuyerSession'
import { AuthProvider } from './features/auth/context/AuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartSession>
        <App />
      </CartSession>
    </AuthProvider>
  </StrictMode>,
)
