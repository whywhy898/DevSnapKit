import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import AdminDashboard from './AdminDashboard.tsx';
import './index.css';

function RootRouter() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (currentPath.startsWith('/admin')) {
    return <AdminDashboard />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootRouter />
  </React.StrictMode>
);
