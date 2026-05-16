import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessibilityProvider } from './context/AccessibilityContext'
import { SessionProvider } from './context/SessionContext'
import { OnboardingPage } from './pages/OnboardingPage'
import { ChatPage } from './pages/ChatPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OnboardingPage />} />
      <Route path="/app" element={<ChatPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AccessibilityProvider>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </AccessibilityProvider>
  )
}
