'use client';

import { useEffect, useState } from 'react';

export default function PWAProvider({ children }) {
  const [offline, setOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setReconnected(true);
      setTimeout(() => setReconnected(false), 3000);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // Check initial state
    if (!navigator.onLine) setOffline(true);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const showBanner = offline || reconnected;

  return (
    <>
      {offline && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#f97316',
            color: 'white',
            textAlign: 'center',
            padding: '8px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          📡 Offline — data saving locally
        </div>
      )}
      {reconnected && !offline && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#22c55e',
            color: 'white',
            textAlign: 'center',
            padding: '8px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          ✅ Back online — syncing
        </div>
      )}
      <div style={showBanner ? { marginTop: '36px' } : undefined}>
        {children}
      </div>
    </>
  );
}
