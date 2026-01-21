import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/i18n'; // Initialize i18n

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { PointsProvider } from './context/PointsContext';
import { SettingsProvider } from './context/SettingsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || "";

if (!clientId) {
  console.warn("Missing VITE_GOOGLE_CLIENT_ID in .env file. Google Login will not work.");
}

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <PointsProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </PointsProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
