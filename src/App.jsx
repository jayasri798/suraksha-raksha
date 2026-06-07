import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import BottomNavigation from './components/BottomNavigation';
import HomeScreen from './screens/HomeScreen';
import ContactsScreen from './screens/ContactsScreen';
import LiveLocationScreen from './screens/LiveLocationScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import GenderSelectorScreen from './components/GenderSelectorScreen';
import LiveTrackingPublicScreen from './screens/LiveTrackingPublicScreen';
import './App.css';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gender, setGender] = useState(null);
  const [genderLoading, setGenderLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('safeher-darkmode');
    return saved === 'true';
  });

  const routerLocation = useLocation();
  const isPublicRoute = routerLocation.pathname.startsWith('/track');

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      setAuthLoading(false);
      
      if (authUser) {
        setGenderLoading(true);
        try {
          const userDoc = await getDoc(doc(db, "users", authUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.gender) {
              setGender(data.gender);
            } else {
              setGender(null);
            }
            // Load last known location from Firestore immediately
            if (data.location && data.location.lat && data.location.lng) {
              setLocation({
                lat: data.location.lat.toFixed(6),
                lng: data.location.lng.toFixed(6)
              });
            }
          } else {
            setGender(null);
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
        } finally {
          setGenderLoading(false);
        }
      } else {
        setGender(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Geolocation watch location listener (with low-accuracy fallback)
  useEffect(() => {
    if ("geolocation" in navigator) {
      let watchId;
      
      const startWatching = (highAccuracy = true) => {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude.toFixed(6),
              lng: position.coords.longitude.toFixed(6)
            });
          },
          (error) => {
            console.warn(`Error watching location (highAccuracy=${highAccuracy}):`, error);
            // If high accuracy times out/fails, fallback to standard accuracy
            if (highAccuracy) {
              navigator.geolocation.clearWatch(watchId);
              startWatching(false);
            }
          },
          { 
            enableHighAccuracy: highAccuracy, 
            timeout: highAccuracy ? 8000 : 20000, 
            maximumAge: highAccuracy ? 0 : 60000 
          }
        );
      };

      startWatching(true);
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Sync location to Firestore
  useEffect(() => {
    if (user && location) {
      const syncLocation = async () => {
        try {
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
            location: {
              lat: parseFloat(location.lat),
              lng: parseFloat(location.lng),
              updatedAt: new Date().toISOString()
            }
          }, { merge: true });

          const currentLocRef = doc(db, "users", user.uid, "location", "current");
          await setDoc(currentLocRef, {
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lng),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error syncing location to Firestore:", err);
        }
      };
      syncLocation();
    }
  }, [user, location]);

  const refreshLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6)
          });
        },
        (error) => {
          console.error("Error manual-refreshing location:", error);
          // Retry with low accuracy if manual refresh failed
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({
                lat: pos.coords.latitude.toFixed(6),
                lng: pos.coords.longitude.toFixed(6)
              });
            },
            (err) => console.error("Low accuracy refresh fallback failed:", err),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('safeher-darkmode', isDark);
  }, [isDark]);

  useEffect(() => {
    if (gender === 'male') {
      document.documentElement.setAttribute('data-gender-theme', 'blue');
    } else {
      document.documentElement.setAttribute('data-gender-theme', 'pink');
    }
  }, [gender]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  // Handle the public live tracking bypass route completely free of auth!
  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/track/:userId" element={<LiveTrackingPublicScreen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  if (authLoading || genderLoading) {
    return (
      <div className="loading-screen">
        <Loader2 className="spinner-large" size={48} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Enforce profile onboarding setup if gender is missing
  if (!gender) {
    return (
      <GenderSelectorScreen 
        user={user} 
        onGenderSelected={(selectedGender) => setGender(selectedGender)} 
      />
    );
  }

  return (
    <>
      <header className="app-top-bar">
        <div className="top-bar-left">
          <ShieldCheck size={22} className="icon-shield-check-apple" />
          <span className="brand-name-apple">SafeHer</span>
        </div>
        <div className="top-bar-right">
          <div className="connection-badge-apple">
            <div className="status-dot-apple pulse-green-apple" />
            <span className="protected-text-apple">Protected</span>
            <img 
              src="/girl_silhouette.png" 
              alt="Profile" 
              className="user-profile-nav-apple" 
            />
          </div>
        </div>
      </header>

      <div className="screen-container">
        <Routes>
          <Route path="/" element={<HomeScreen user={user} globalLocation={location} gender={gender} />} />
          <Route path="/contacts" element={<ContactsScreen user={user} />} />
          <Route path="/location" element={<LiveLocationScreen user={user} globalLocation={location} onRefreshLocation={refreshLocation} />} />
          <Route path="/settings" element={<SettingsScreen user={user} isDark={isDark} setIsDark={setIsDark} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <BottomNavigation />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

