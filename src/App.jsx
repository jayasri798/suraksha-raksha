import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { auth, db, rtdb } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, set, push } from 'firebase/database';
import BottomNavigation from './components/BottomNavigation';
import HomeScreen from './screens/HomeScreen';
import ContactsScreen from './screens/ContactsScreen';
import LiveLocationScreen from './screens/LiveLocationScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import ModeSelectorScreen from './components/ModeSelectorScreen';
import LiveTrackingPublicScreen from './screens/LiveTrackingPublicScreen';
import './App.css';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState(null);
  const [modeLoading, setModeLoading] = useState(true);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('suraksha-darkmode') || localStorage.getItem('safeher-darkmode');
    return saved === 'true';
  });

  const routerLocation = useLocation();
  const isPublicRoute = routerLocation.pathname.startsWith('/track');

  // Auth listener & real-time profile listener
  useEffect(() => {
    let unsubscribeSnapshot = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        setModeLoading(true);
        const userRef = doc(db, "users", authUser.uid);
        unsubscribeSnapshot = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.mode) {
              setMode(data.mode);
            } else if (data.gender) {
              // Backward compatibility mapping
              setMode(data.gender === 'female' ? 'Woman' : 'Woman');
            } else {
              setMode(null);
            }
            setIsSOSActive(!!data.isSOSActive);

            // Only load fallback location from Firestore if we don't have a live GPS lock yet
            if (data.location && data.location.lat && data.location.lng) {
              setLocation(prev => {
                if (prev) return prev;
                return {
                  lat: data.location.lat.toFixed(6),
                  lng: data.location.lng.toFixed(6)
                };
              });
            }
          } else {
            setMode(null);
            setIsSOSActive(false);
          }
          setModeLoading(false);
        }, (err) => {
          console.error("Error listening to user profile:", err);
          setModeLoading(false);
        });
      } else {
        setMode(null);
        setIsSOSActive(false);
        setModeLoading(false);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Geolocation watch location listener (optimized with immediate cached location)
  useEffect(() => {
    if ("geolocation" in navigator) {
      // 1. Get fast approximate/cached location immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation((prev) => {
            if (prev) return prev;
            return {
              lat: position.coords.latitude.toFixed(6),
              lng: position.coords.longitude.toFixed(6)
            };
          });
        },
        (error) => {
          console.warn("Error getting fast cached location:", error);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );

      // 2. Watch for highly accurate live updates
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6)
          });
        },
        (error) => {
          console.warn("Error watching location:", error);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 15000, 
          maximumAge: 0 
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Sync location to Firestore & RTDB
  useEffect(() => {
    if (user && location) {
      const syncLocation = async () => {
        try {
          const latVal = parseFloat(location.lat);
          const lngVal = parseFloat(location.lng);
          const isoTime = new Date().toISOString();

          // 1. Sync to Firestore root
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
            location: {
              lat: latVal,
              lng: lngVal,
              updatedAt: isoTime
            }
          }, { merge: true });

          // 2. Sync to Firestore location subcollection
          const currentLocRef = doc(db, "users", user.uid, "location", "current");
          await setDoc(currentLocRef, {
            lat: latVal,
            lng: lngVal,
            updatedAt: isoTime
          });

          // 3. Sync to RTDB live location (for real-time tracking)
          await set(ref(rtdb, `users/${user.uid}/location`), {
            lat: latVal,
            lng: lngVal,
            updatedAt: isoTime
          });

          // 4. Append to RTDB sosTrail if SOS is active
          if (isSOSActive) {
            const trailRef = ref(rtdb, `users/${user.uid}/sosTrail`);
            await push(trailRef, {
              lat: latVal,
              lng: lngVal,
              timestamp: isoTime
            });
          }
        } catch (err) {
          console.error("Error syncing location to Firebase:", err);
        }
      };
      syncLocation();
    }
  }, [user, location, isSOSActive]);

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
    localStorage.setItem('suraksha-darkmode', isDark);
  }, [isDark]);

  // Set the theme color to pink/purple default for the app
  useEffect(() => {
    document.documentElement.setAttribute('data-gender-theme', 'pink');
  }, []);

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

  if (authLoading || modeLoading) {
    return (
      <div className="loading-screen">
        <Loader2 className="spinner-large" size={48} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Enforce profile onboarding setup if mode is missing
  if (!mode) {
    return (
      <ModeSelectorScreen 
        user={user} 
        onModeSelected={(selectedMode) => setMode(selectedMode)} 
      />
    );
  }

  return (
    <>
      <header className="app-top-bar">
        <div className="top-bar-left">
          <ShieldCheck size={22} className="icon-shield-check-apple" />
          <span className="brand-name-apple">Suraksha</span>
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
          <Route path="/" element={<HomeScreen user={user} globalLocation={location} mode={mode} updateGlobalLocation={setLocation} />} />
          <Route path="/contacts" element={<ContactsScreen user={user} />} />
          <Route path="/location" element={<LiveLocationScreen user={user} globalLocation={location} onRefreshLocation={refreshLocation} />} />
          <Route path="/settings" element={<SettingsScreen user={user} isDark={isDark} setIsDark={setIsDark} globalLocation={location} />} />
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
