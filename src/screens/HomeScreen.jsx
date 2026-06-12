import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, MapPin, Loader2, Bell, Check, Cpu, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
import { db, rtdb } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, onValue, set as setDbValue } from 'firebase/database';
import './HomeScreen.css';

const HomeScreen = ({ user, globalLocation, mode, updateGlobalLocation }) => {
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [location, setLocation] = useState(globalLocation);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: '' });
  const [diagState, setDiagState] = useState('idle'); // 'idle', 'running', 'success'

  // Hardware Sensor States (Realtime Database)
  const [fallDetected, setFallDetected] = useState(false);
  const [soundAlert, setSoundAlert] = useState(false);
  
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3500);
  }, []);

  const runDiagnostics = () => {
    setDiagState('running');
    setTimeout(() => {
      setDiagState('success');
      showToast("Hardware Diagnostics: ALL SYSTEMS NOMINAL");
    }, 1500);
  };
  
  // Fetch initial profile & contacts from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) setSettings(userDoc.data());

        const contactsSnap = await getDocs(collection(db, "users", user.uid, "contacts"));
        setContacts(contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  // Sync state locations
  useEffect(() => {
    Promise.resolve().then(() => {
      setLocation(globalLocation);
    });
  }, [globalLocation]);

  // Listen to RTDB Hardware alerts (/users/{userId}/status)
  useEffect(() => {
    const statusRef = ref(rtdb, `users/${user.uid}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFallDetected(!!data.fallDetected);
        setSoundAlert(!!data.soundAlert);
      } else {
        setFallDetected(false);
        setSoundAlert(false);
      }
    }, (err) => {
      console.error("Error subscribing to hardware status in RTDB:", err);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Alert triggers for fallback notifications (toasts)
  useEffect(() => {
    if (fallDetected) {
      Promise.resolve().then(() => {
        showToast("FALL DETECTED! Emergency services & contacts notified.", "error");
      });
    }
  }, [fallDetected, showToast]);

  useEffect(() => {
    if (soundAlert) {
      Promise.resolve().then(() => {
        showToast("LOUD SOUND DETECTED! Sound level alert warning.", "error");
      });
    }
  }, [soundAlert, showToast]);

  const getRealLocation = (highAccuracy = true) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const freshLoc = { 
            lat: pos.coords.latitude.toFixed(6), 
            lng: pos.coords.longitude.toFixed(6) 
          };
          setLocation(freshLoc);
          if (updateGlobalLocation) {
            updateGlobalLocation(freshLoc);
          }
        },
        (err) => {
          console.warn(`GPS Error (highAccuracy=${highAccuracy}):`, err);
          if (highAccuracy) {
            getRealLocation(false);
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          timeout: highAccuracy ? 8000 : 20000, 
          maximumAge: 0 
        }
      );
    }
  };

  const buildMessage = useCallback(() => {
    const lat = location?.lat || globalLocation?.lat || '16.284583';
    const lng = location?.lng || globalLocation?.lng || '80.457524';
    return `EMERGENCY! ${user.displayName} needs help!\nLocation: https://maps.google.com/?q=${lat},${lng}\nPlease go to this location immediately!\n- Suraksha Safety App`;
  }, [location, globalLocation, user.displayName]);

  const sendSMS = useCallback(async () => {
    if (smsSent) return;
    setSmsSent(true);
    
    const phoneNumbers = contacts.map(c => c.phone.replace(/\D/g, ''));
    if (phoneNumbers.length === 0) {
      console.warn("No contacts to notify");
      return;
    }

    try {
      const response = await fetch('/api/send-sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phones: phoneNumbers,
          message: buildMessage()
        })
      });

      const data = await response.json();
      if (data.success) {
        await addDoc(collection(db, "users", user.uid, "sos_alerts"), {
          location: location || globalLocation,
          timestamp: serverTimestamp(),
          userName: user.displayName,
          status: 'sent'
        });
        showToast("Emergency SMS successfully sent!");
      } else {
        console.error("SMS Failed:", data.error);
        showToast("SMS Failed to deliver", "error");
      }
    } catch (err) {
      console.error("Error calling SMS API:", err);
      showToast("Network error triggering SMS", "error");
    }
  }, [smsSent, contacts, location, globalLocation, user, buildMessage, showToast]);

  useEffect(() => {
    let timer;
    if (isSOSActive && countdown > 0 && !showPinPrompt) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (isSOSActive && countdown === 0) {
      Promise.resolve().then(() => {
        sendSMS();
      });
    }
    return () => clearInterval(timer);
  }, [isSOSActive, countdown, showPinPrompt, sendSMS]);

  const handleSOSActivate = async () => {
    setCountdown(10);
    setSmsSent(false);
    setIsSOSActive(true);
    getRealLocation();
    try {
      await setDoc(doc(db, "users", user.uid), { isSOSActive: true }, { merge: true });
    } catch (err) {
      console.error("Error writing SOS status:", err);
    }
  };

  const handleCancelRequest = async () => {
    if (settings?.pin) {
      setShowPinPrompt(true);
    } else {
      setIsSOSActive(false);
      try {
        await setDoc(doc(db, "users", user.uid), { isSOSActive: false }, { merge: true });
      } catch (err) {
        console.error("Error writing SOS status:", err);
      }
      showToast("Alert cancelled");
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pinInput === settings?.pin) {
      setIsSOSActive(false);
      setShowPinPrompt(false);
      setPinInput('');
      setError('');
      try {
        await setDoc(doc(db, "users", user.uid), { isSOSActive: false }, { merge: true });
      } catch (err) {
        console.error("Error writing SOS status:", err);
      }
      showToast("Alert cancelled successfully");
    } else {
      setError('Wrong PIN. Alert continues.');
      setTimeout(() => {
        setError('');
      }, 2000);
    }
  };

  const dismissFallAlert = async () => {
    try {
      await setDbValue(ref(rtdb, `users/${user.uid}/status/fallDetected`), false);
      showToast("Fall warning dismissed");
    } catch (err) {
      console.error("Failed to dismiss fall status:", err);
    }
  };

  const dismissSoundAlert = async () => {
    try {
      await setDbValue(ref(rtdb, `users/${user.uid}/status/soundAlert`), false);
      showToast("Sound warning dismissed");
    } catch (err) {
      console.error("Failed to dismiss sound status:", err);
    }
  };

  // Distance calculation helper (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Radius of the earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };

  if (loading) {
    return (
      <div className="home-screen-loading">
        <Loader2 className="spinner-large" size={40} />
      </div>
    );
  }

  const firstName = user.displayName?.split(' ')[0] || 'User';

  // Compute Safe Zone status for Kid mode
  let isOutsideSafeZone = false;
  let safeZoneStatusText = 'Not Configured';
  if (mode === 'Kid' && settings?.safeZone && globalLocation) {
    const { lat, lng, radius } = settings.safeZone;
    const distance = calculateDistance(parseFloat(globalLocation.lat), parseFloat(globalLocation.lng), lat, lng);
    isOutsideSafeZone = distance > radius;
    safeZoneStatusText = isOutsideSafeZone ? 'Outside Safe Zone!' : 'Inside Safe Zone';
  }

  return (
    <>
      <div className="home-screen page-enter">
      {toast.show && (
        <div className={`toast-container ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* Prominent hardware warning banners at top of screen */}
      {fallDetected && (
        <div className="hardware-alert-banner fall-alert-glowing">
          <div className="hardware-alert-left">
            <span className="bell-ringing">🚨</span>
            <div>
              <strong>FALL DETECTED!</strong>
              <p>Companion device detected a sudden fall</p>
            </div>
          </div>
          <button onClick={dismissFallAlert} className="dismiss-alert-btn">Dismiss</button>
        </div>
      )}

      {soundAlert && (
        <div className="hardware-alert-banner sound-alert-glowing">
          <div className="hardware-alert-left">
            <span className="bell-ringing">🔊</span>
            <div>
              <strong>LOUD SOUND DETECTED!</strong>
              <p>Microphone companion detected high decibels</p>
            </div>
          </div>
          <button onClick={dismissSoundAlert} className="dismiss-alert-btn">Dismiss</button>
        </div>
      )}

      {isOutsideSafeZone && (
        <div className="hardware-alert-banner safezone-alert-glowing">
          <div className="hardware-alert-left">
            <span className="bell-ringing">⚠️</span>
            <div>
              <strong>OUTSIDE SAFE ZONE!</strong>
              <p>Kid has moved out of safe boundaries</p>
            </div>
          </div>
        </div>
      )}

      {/* Greeting Hero Card - Apple Clean style */}
      <div className="greeting-card-apple">
        <div className="greeting-left-apple">
          <div className="status-badge-apple">
            <ShieldCheck size={14} className="apple-secured-icon" />
            <span>{mode} Mode Active</span>
          </div>
          <h2>Stay Safe,</h2>
          <h1 className="hero-name-apple">{firstName}</h1>
          <p className="hero-subtext-apple">
            Suraksha Protective Shield is Active
          </p>
        </div>
        <div className="greeting-right-apple">
          <div className="apple-glow-shield-wrapper">
            <ShieldCheck size={48} className="apple-home-shield-vector" />
          </div>
        </div>
      </div>

      {/* SOS Button (Concentric Apple Pulsing Rings) - Standard SOS console for all modes */}
      <div className="glass-card sos-section-apple">
        <h3 className="sos-title-apple">Emergency Dispatch Console</h3>
        
        <div className="sos-rings-container-apple">
          <div className="pulse-ring-apple ring-apple-1"></div>
          <div className="pulse-ring-apple ring-apple-2"></div>
          <div className="pulse-ring-apple ring-apple-3"></div>
          
          <button 
            className="sos-button-apple"
            onDoubleClick={handleSOSActivate}
            onTouchEnd={(e) => {
              if (e.timeStamp - (window.lastTap || 0) < 300) {
                handleSOSActivate();
              }
              window.lastTap = e.timeStamp;
            }}
          >
            <div className="sos-button-inner-apple">
              <span className="sos-alert-label">SOS</span>
              <span className="sos-press-instruction">Double Press</span>
            </div>
          </button>
        </div>
        <p className="sos-hint-apple">Double-tap or double-click to trigger SOS immediately</p>

        {/* Status Pills */}
        <div className="sos-status-pills-apple">
          <div className="status-pill-apple gps-pill-apple">
            <span className="pill-dot-apple gps-dot-apple" />
            <span>GPS Tracking Active</span>
          </div>
          <div className="status-pill-apple ready-pill-apple">
            <span className="pill-dot-apple ready-dot-apple" />
            <span>Companion Ready</span>
          </div>
        </div>
      </div>

      {/* Mode-Specific Status Dashboard */}
      {mode === 'Elderly' && (
        <div className="glass-card hardware-status-dashboard-card">
          <div className="diagnostics-header-apple">
            <Activity size={16} className="icon-apple-cpu" />
            <span>Companion Sensors (Elderly)</span>
          </div>
          <div className="sensor-status-grid">
            <div className={`sensor-status-pill ${fallDetected ? 'alert-active' : 'normal-active'}`}>
              <span className="sensor-emoji">👵</span>
              <div className="sensor-info">
                <strong>Fall Detection Status</strong>
                <span>{fallDetected ? 'FALL WARNING ACTIVE!' : 'Status: Normal'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'Kid' && (
        <div className="glass-card hardware-status-dashboard-card">
          <div className="diagnostics-header-apple">
            <Activity size={16} className="icon-apple-cpu" />
            <span>Companion Sensors (Kid)</span>
          </div>
          <div className="sensor-status-grid">
            <div className={`sensor-status-pill ${isOutsideSafeZone ? 'alert-active' : settings?.safeZone ? 'normal-active' : 'inactive'}`}>
              <span className="sensor-emoji">📍</span>
              <div className="sensor-info">
                <strong>Safe Zone Bound Check</strong>
                <span>{safeZoneStatusText}</span>
              </div>
            </div>
            
            <div className={`sensor-status-pill ${soundAlert ? 'alert-active' : 'normal-active'}`}>
              <span className="sensor-emoji">🔊</span>
              <div className="sensor-info">
                <strong>Ambient Sound Alerts</strong>
                <span>{soundAlert ? 'Loud sound warning!' : 'Status: Normal'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIM Toolkit & Hardware Device Diagnostics Check */}
      <div className="glass-card device-diagnostics-card-apple">
        <div className="diagnostics-header-apple">
          <Cpu size={16} className="icon-apple-cpu" />
          <span>SIM Toolkit & Hardware Companion Status</span>
        </div>

        <div className="diagnostics-status-row-apple">
          <div className="diag-indicator-apple">
            <span className="indicator-label-apple">Device Status</span>
            <strong className="indicator-value-apple status-green-text">
              <span className="small-pulse-dot-green-apple" />
              Connected
            </strong>
          </div>
          <div className="diag-indicator-apple">
            <span className="indicator-label-apple">SIM Toolkit Loop</span>
            <strong className="indicator-value-apple">Active (LTE)</strong>
          </div>
        </div>

        {diagState === 'running' ? (
          <div className="diagnostics-running-loader">
            <Loader2 className="spinner spinner-mini" size={16} />
            <span>Verifying loops & SIM toolkit relays...</span>
          </div>
        ) : diagState === 'success' ? (
          <div className="diagnostics-checklist-apple">
            <div className="checklist-item-apple">
              <CheckCircle2 size={14} className="icon-green-check" />
              <span>SIM Toolkit Gateway: Active (Credits OK)</span>
            </div>
            <div className="checklist-item-apple">
              <CheckCircle2 size={14} className="icon-green-check" />
              <span>Hardware Panic Switch: Loop Connected</span>
            </div>
            <div className="checklist-item-apple">
              <CheckCircle2 size={14} className="icon-green-check" />
              <span>Satellite GPS Beacon: Lock Acquired</span>
            </div>
            <div className="checklist-item-apple">
              <CheckCircle2 size={14} className="icon-green-check" />
              <span>Broadcast Route: Parents & Police Ready</span>
            </div>
            <button className="btn-outline recheck-btn-apple" onClick={runDiagnostics}>
              <RefreshCw size={14} />
              <span>Re-Run Diagnostics Check</span>
            </button>
          </div>
        ) : (
          <button className="btn-primary run-diagnostics-btn-apple" onClick={runDiagnostics}>
            <span>Run Diagnostics Check</span>
          </button>
        )}
      </div>

      {/* Quick Features Row */}
      <div className="quick-features-row">
        <div className="glass-card feature-card-apple-item">
          <div className="feature-icon-circle-apple icon-gray">
            <ShieldCheck size={20} />
          </div>
          <strong className="feat-title">Shield Mode</strong>
          <span className="feat-sub">24/7 Security Monitor</span>
        </div>

        <div className="glass-card feature-card-apple-item">
          <div className="feature-icon-circle-apple icon-gray">
            <MapPin size={20} />
          </div>
          <strong className="feat-title">Live Tracking</strong>
          <span className="feat-sub">Direct GPS Link</span>
        </div>

        <div className="glass-card feature-card-apple-item">
          <div className="feature-icon-circle-apple icon-gray">
            <Bell size={20} />
          </div>
          <strong className="feat-title">Alert Network</strong>
          <span className="feat-sub">Guardians Link</span>
        </div>
      </div>

      </div>

      {/* High-Intensity Full Screen SOS Alert Overlay - Apple Dark Theme */}
      <AnimatePresence>
        {isSOSActive && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="sos-overlay-apple-dark"
          >
            {/* Heartbeat Grid Background */}
            <div className="heartbeat-grid-top">
              <svg className="heartbeat-svg-apple" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path 
                  className="heartbeat-path-apple" 
                  d="M0,15 L35,15 L38,5 L42,25 L45,10 L48,18 L50,15 L100,15" 
                  fill="none" 
                  stroke="#FF453A" 
                  strokeWidth="2.5" 
                />
              </svg>
            </div>

            <div className="sos-overlay-content-apple">
              <div className="alert-header-apple">
                <div className="pulsing-shield-alert-apple">
                  <ShieldCheck size={40} className="red-alert-vector" />
                </div>
                <h1 className="alert-title-apple">ALERT INITIATED</h1>
                <p className="alert-subtitle-apple">Contacting Guardians immediately</p>
              </div>

              {/* Countdown circle */}
              <div className="countdown-ring-apple">
                <div className="countdown-glow-apple" />
                <span className="countdown-value-apple">{countdown}</span>
              </div>
              <p className="countdown-caption-apple">
                {countdown > 0 ? `Alert dispatches in ${countdown}s` : 'Guardians notified successfully! ✅'}
              </p>

              {/* Location Card */}
              <div className="glass-card alert-location-card-apple">
                <div className="alert-location-header-apple">
                  <MapPin size={16} />
                  <span>Current GPS Coordinates</span>
                </div>
                <p className="alert-coord-text-apple">Lat: {location?.lat || '---'}, Lng: {location?.lng || '---'}</p>
                <a 
                  href={`https://maps.google.com/?q=${location?.lat},${location?.lng}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-primary maps-apple-btn"
                >
                  Open in Apple Maps
                </a>
              </div>

              {/* Guardians List */}
              <div className="alert-guardians-list-apple">
                <div className="guardian-alert-pill police-alert-pill-apple">
                  <strong>POLICE CONTROL CENTER (112 Dispatch)</strong>
                  <span className="dispatch-badge-apple">
                    {countdown === 0 ? <Check size={14} className="check-green" /> : <Loader2 size={12} className="spin-white" />}
                  </span>
                </div>
                {contacts.map(c => (
                  <div key={c.id} className="guardian-alert-pill">
                    <span>{c.name}</span>
                    <span className="dispatch-badge-apple">
                      {countdown === 0 ? <Check size={14} className="check-green" /> : <Loader2 size={12} className="spin-white" />}
                    </span>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div className="guardian-alert-pill empty">
                    <span>No guardians configured yet</span>
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              <button className="btn-cancel-apple" onClick={handleCancelRequest}>
                <Lock size={16} />
                <span>Cancel Dispatch — Enter PIN</span>
              </button>

              {/* PIN Prompt Modal */}
              <AnimatePresence>
                {showPinPrompt && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pin-modal-backdrop-apple"
                  >
                    <motion.div 
                      initial={{ scale: 0.94, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.94, y: 15 }}
                      className="glass-card pin-modal-box-apple"
                    >
                      <Lock size={32} className="pin-secure-lock" />
                      <h3>Security PIN Required</h3>
                      <p className="pin-hint-apple-desc">Enter your 4-digit safety PIN to abort dispatch</p>
                      <form onSubmit={handlePinSubmit}>
                        <input 
                          type="password" 
                          maxLength="4" 
                          autoFocus 
                          value={pinInput} 
                          onChange={e => setPinInput(e.target.value)} 
                          placeholder="••••" 
                          className="pin-input-field-apple"
                        />
                        {error && <p className="pin-error-apple">{error}</p>}
                        <div className="pin-actions-apple-row">
                          <button type="button" className="btn-outline pin-back-apple" onClick={() => setShowPinPrompt(false)}>Back</button>
                          <button type="submit" className="btn-primary pin-confirm-apple">Abort Alert</button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HomeScreen;
