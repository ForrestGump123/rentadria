import { Route, Routes } from 'react-router-dom'
import './App.css'
import { CookieBanner } from './components/CookieBanner'
import { SiteVisitTracker } from './components/SiteVisitTracker'
import { FaqPage } from './pages/FaqPage'
import { HomePage } from './pages/HomePage'
import { ListingPage } from './pages/ListingPage'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { VerifyCodePage } from './pages/VerifyCodePage'
import { OwnerDashboardPage } from './pages/OwnerDashboardPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'

export default function App() {
  return (
    <>
      <SiteVisitTracker />
      <CookieBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/listing/:id" element={<ListingPage />} />
        <Route path="/verify" element={<VerifyCodePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/owner/*" element={<OwnerDashboardPage />} />
        <Route path="/admin/*" element={<AdminDashboardPage />} />
      </Routes>
    </>
  )
}
