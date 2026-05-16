import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext'
import { SessionProvider } from './context/SessionContext'
import { OnboardingPage } from './pages/OnboardingPage'
import { ChatPage } from './pages/ChatPage'

function AppRoutes() {
  const { onboardingComplete } = useAccessibility()

  return (
    <Routes>
      <Route
        path="/"
        element={
          onboardingComplete ? <Navigate to="/app" replace /> : <OnboardingPage />
        }
      />
      <Route
        path="/app"
        element={
          onboardingComplete ? <ChatPage /> : <Navigate to="/" replace />
        }
      />
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
