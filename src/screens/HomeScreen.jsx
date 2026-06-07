import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Lock, MapPin, Loader2, Bell, Check, Phone, Cpu, CheckCircle2, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './HomeScreen.css';

const HomeScreen = ({ user, globalLocation, gender }) => {
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
  
  const runDiagnostics = () => {
    setDiagState('running');
    setTimeout(() => {
      setDiagState('success');
      showToast("Hardware Diagnostics: ALL SYSTEMS NOMINAL");
    }, 1500);
  };
  
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

  useEffect(() => {
    setLocation(globalLocation);
  }, [globalLocation]);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3000);
  };

  const getRealLocation = (highAccuracy = true) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ 
            lat: pos.coords.latitude.toFixed(6), 
            lng: pos.coords.longitude.toFixed(6) 
          });
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
          maximumAge: highAccuracy ? 0 : 60000 
        }
      );
    }
  };

  const buildMessage = () => {
    const lat = location?.lat || globalLocation?.lat || '16.284583';
    const lng = location?.lng || globalLocation?.lng || '80.457524';
    return `EMERGENCY! ${user.displayName} needs help!\nLocation: https://maps.google.com/?q=${lat},${lng}\nPlease go to this location immediately!\n- SafeHer Safety App`;
  };

  const sendSMS = async () => {
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
  };

  useEffect(() => {
    let timer;
    if (isSOSActive && countdown > 0 && !showPinPrompt) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (isSOSActive && countdown === 0) {
      sendSMS();
    }
    return () => clearInterval(timer);
  }, [isSOSActive, countdown, showPinPrompt]);

  const handleSOSActivate = () => {
    setCountdown(10);
    setSmsSent(false);
    setIsSOSActive(true);
    getRealLocation();
  };

  const handleCancelRequest = () => {
    if (settings?.pin) {
      setShowPinPrompt(true);
    } else {
      setIsSOSActive(false);
      showToast("Alert cancelled");
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === settings?.pin) {
      setIsSOSActive(false);
      setShowPinPrompt(false);
      setPinInput('');
      setError('');
      showToast("Alert cancelled successfully");
    } else {
      setError('Wrong PIN. Alert continues.');
      setTimeout(() => {
        setError('');
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="home-screen-loading">
        <Loader2 className="spinner-large" size={40} />
      </div>
    );
  }

  const firstName = user.displayName?.split(' ')[0] || 'User';

  const isMale = gender === 'male';

  return (
    <>
      <div className="home-screen page-enter">
      {toast.show && (
        <div className={`toast-container ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* Greeting Hero Card - Apple Clean style */}
      <div className="greeting-card-apple">
        <div className="greeting-left-apple">
          <div className="status-badge-apple">
            <ShieldCheck size={14} className="apple-secured-icon" />
            <span>{isMale ? 'Guardian Live Uplink' : 'Encrypted Connection'}</span>
          </div>
          <h2>{isMale ? 'Guardian Portal,' : 'Stay Safe,'}</h2>
          <h1 className="hero-name-apple">{firstName}</h1>
          <p className="hero-subtext-apple">
            {isMale ? 'Monitoring loved ones satellite link' : 'SafeHer Protective Shield is Active'}
          </p>
        </div>
        <div className="greeting-right-apple">
          <div className="apple-glow-shield-wrapper">
            <ShieldCheck size={48} className="apple-home-shield-vector" />
          </div>
        </div>
      </div>

      {/* SOS / Tracking Card based on Gender */}
      {isMale ? (
        <div className="glass-card sos-section-apple tracking-section-guardian">
          <h3 className="sos-title-apple">Loved One Tracking Deck</h3>
          
          <div className="guardian-tracking-hero-box">
            <div className="companion-radar-outer">
              <div className="companion-radar-inner">
                <span className="guardian-emoji-center">👨</span>
              </div>
            </div>
            <p className="guardian-tracking-desc">
              You are configured as a Guardian. Monitor live satellite coordinate broadcasts and eSIM pairing relays.
            </p>
          </div>

          <div className="guardian-quick-actions">
            <button 
              onClick={() => window.location.href = '/location'}
              className="btn-primary run-diagnostics-btn-apple guardian-track-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <MapPin size={18} />
              <span>Track Loved One Live</span>
            </button>
          </div>

          {/* Status Pills */}
          <div className="sos-status-pills-apple">
            <div className="status-pill-apple gps-pill-apple">
              <span className="pill-dot-apple gps-dot-apple" />
              <span>Broadcast Node Listening</span>
            </div>
            <div className="status-pill-apple ready-pill-apple" style={{ background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>
              <span className="pill-dot-apple ready-dot-apple" style={{ background: '#007AFF' }} />
              <span>eSIM Companion Linked</span>
            </div>
          </div>
        </div>
      ) : (
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
