import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { I18nextProvider } from 'react-i18next'
import './index.css'
import 'leaflet/dist/leaflet.css'
import i18n from './i18n'
import App from './App.tsx'
import { CurrencyProvider } from './context/CurrencyContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </I18nextProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
