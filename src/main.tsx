import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import App from './App';
import { ToastProvider } from '@/hooks/useToast';
import { AuthProvider } from '@/hooks/useAuth';
import { AppProvider } from '@/hooks/useApp';
import { I18nProvider } from '@/i18n';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": transform animations are disabled when the OS asks for reduced motion */}
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <AppProvider>
                <App />
              </AppProvider>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </I18nProvider>
    </MotionConfig>
  </StrictMode>,
);
