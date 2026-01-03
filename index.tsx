import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Global error handlers to prevent crashes
window.addEventListener('error', (event) => {
  console.error('Global error (handled):', event.error);
  // Prevent default error handling that might crash the app
  event.preventDefault();
  return true; // Suppress error
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection (handled):', event.reason);
  // Prevent default error handling that might crash the app
  event.preventDefault();
  // Don't let it bubble up
  return true;
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
