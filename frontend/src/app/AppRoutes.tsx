import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'

import { GuestOnly, RequireAuth } from '../components/auth/RouteGuards'
import { AppLayout } from '../components/layout/AppLayout'
import { AuthLayout } from '../components/layout/AuthLayout'
import { PageSpinner } from '../components/ui/feedback'

const LandingPage = lazy(() => import('../pages/LandingPage'))
const LoginPage = lazy(() => import('../pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('../pages/DashboardPage'))
const TutorPage = lazy(() => import('../pages/TutorPage'))
const LanguageLearningPage = lazy(() => import('../pages/LanguageLearningPage'))
const VoiceTutorPage = lazy(() => import('../pages/VoiceTutorPage'))
const VideoStudioPage = lazy(() => import('../pages/VideoStudioPage'))
const MindMapPage = lazy(() => import('../pages/MindMapPage'))
const WhiteboardPage = lazy(() => import('../pages/WhiteboardPage'))
const QuizPage = lazy(() => import('../pages/QuizPage'))
const ProgressPage = lazy(() => import('../pages/ProgressPage'))
const HistoryPage = lazy(() => import('../pages/HistoryPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

export function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AuthLayout />}>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tutor" element={<TutorPage />} />
          <Route path="languages" element={<LanguageLearningPage />} />
          <Route path="voice" element={<VoiceTutorPage />} />
          <Route path="videos" element={<VideoStudioPage />} />
          <Route path="mind-maps" element={<MindMapPage />} />
          <Route path="whiteboard" element={<WhiteboardPage />} />
          <Route path="quizzes" element={<QuizPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
