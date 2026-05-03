import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import BottomNavigation from './components/BottomNavigation';
import HomeScreen from './screens/HomeScreen';
import ContactsScreen from './screens/ContactsScreen';
import LiveLocationScreen from './screens/LiveLocationScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isConnected] = useState(true);
  const [location, setLocation] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('safeher-darkmode');
    return saved === 'true';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Request permission and watch position
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6)
          });
        },
        (error) => console.error("Error watching location:", error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    // Apply theme
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('safeher-darkmode', isDark);
  }, [isDark]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <Loader2 className="spinner-large" size={48} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <Router>
      <header className="app-top-bar">
        <div className="top-bar-left">
          <Shield size={24} className="icon-purple" fill="currentColor" />
          <span className="brand-name">SafeHer</span>
        </div>
        <div className="top-bar-right">
          <div className="connection-badge">
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      <div className="screen-container">
        <Routes>
          <Route path="/" element={<HomeScreen user={user} globalLocation={location} />} />
          <Route path="/contacts" element={<ContactsScreen user={user} />} />
          <Route path="/location" element={<LiveLocationScreen user={user} globalLocation={location} />} />
          <Route path="/settings" element={<SettingsScreen user={user} isDark={isDark} setIsDark={setIsDark} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <BottomNavigation />
    </Router>
  );
}

export default App;
