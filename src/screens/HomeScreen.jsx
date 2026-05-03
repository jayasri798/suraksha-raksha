import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Lock, MapPin, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './HomeScreen.css';

const HomeScreen = ({ user, globalLocation }) => {
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
  
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef(null);

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

  const getRealLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ 
            lat: pos.coords.latitude.toFixed(6), 
            lng: pos.coords.longitude.toFixed(6) 
          });
        },
        (err) => console.error("GPS Error:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const buildMessage = () => {
    const lat = location?.lat || globalLocation?.lat || '0';
    const lng = location?.lng || globalLocation?.lng || '0';
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
        // Log to Firestore
        await addDoc(collection(db, "users", user.uid, "sos_alerts"), {
          location: location || globalLocation,
          timestamp: serverTimestamp(),
          userName: user.displayName,
          status: 'sent'
        });
      } else {
        console.error("SMS Failed:", data.error);
      }
    } catch (err) {
      console.error("Error calling SMS API:", err);
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

  const startHold = () => {
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      setCountdown(10);
      setSmsSent(false);
      setIsSOSActive(true);
      setIsHolding(false);
      getRealLocation();
    }, 3000);
  };

  const endHold = () => {
    clearTimeout(holdTimerRef.current);
    setIsHolding(false);
  };

  const handleCancelRequest = () => {
    if (settings?.pin) setShowPinPrompt(true);
    else {
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
        setShowPinPrompt(false);
        setPinInput('');
        setError('');
      }, 2000);
    }
  };

  if (loading) {
    return <div className="home-screen-loading"><Loader2 className="spinner" size={40} /></div>;
  }

  const firstName = user.displayName?.split(' ')[0] || 'User';

  return (
    <div className="home-screen">
      {toast.show && (
        <div className={`toast-container ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      <div className="greeting-card">
        <h2>Stay Safe, {firstName}</h2>
        <p>Help is one press away</p>
      </div>

      <div className="sos-section">
        <div className="sos-rings-container">
          <div className="pulse-ring ring-1"></div>
          <div className="pulse-ring ring-2"></div>
          <div className="pulse-ring ring-3"></div>
          <button 
            className={`sos-button ${isHolding ? 'holding' : ''}`}
            onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
            onTouchStart={startHold} onTouchEnd={endHold}
          >
            <span>PRESS FOR<br/>HELP</span>
          </button>
        </div>
        <p className="sos-hint">Hold 3 seconds to send SOS alert</p>
      </div>

      <div className="quick-info-grid">
        <div className="card info-mini-card">
          <Shield size={20} className="icon-purple" />
          <div className="info-mini-text">
            <strong>Protected</strong>
            <span>3 layer alert system</span>
          </div>
        </div>
        <div className="card info-mini-card">
          <MapPin size={20} className="icon-purple" />
          <div className="info-mini-text">
            <strong>GPS Active</strong>
            <span>Location tracking on</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSOSActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sos-alert-overlay">
            <div className="sos-alert-content">
              <div className="alert-header">
                <span className="large-emoji">🚨</span>
                <h1>ALERT SENT!</h1>
                <p>SMS sent to all contacts</p>
              </div>

              <div className="alert-countdown-section">
                <div className="alert-countdown-circle">
                  <span>{countdown}</span>
                </div>
                <p>{countdown > 0 ? `SMS will send in ${countdown} seconds` : 'Sending help your way...'}</p>
              </div>

              <div className="alert-location-section">
                <h3>📍 Your Location:</h3>
                <p className="coord-text">Lat: {location?.lat}, Lng: {location?.lng}</p>
                <a href={`https://maps.google.com/?q=${location?.lat},${location?.lng}`} target="_blank" rel="noreferrer" className="alert-maps-link">
                  Open in Google Maps
                </a>
              </div>

              <div className="alert-status-section">
                {contacts.map(c => (
                  <div key={c.id} className="status-row">
                    <span className="tick">✅</span>
                    <span>SMS delivered to {c.name}</span>
                  </div>
                ))}
              </div>

              <button className="btn-cancel-alarm" onClick={handleCancelRequest}>
                CANCEL — False Alarm
              </button>

              {showPinPrompt && (
                <div className="pin-modal-overlay">
                  <div className="pin-modal-box">
                    <h3>Enter your 4-digit PIN to cancel</h3>
                    <form onSubmit={handlePinSubmit}>
                      <input type="password" maxLength="4" autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="****" />
                      {error && <p className="pin-error">{error}</p>}
                      <div className="pin-modal-actions">
                        <button type="button" className="btn-back" onClick={() => setShowPinPrompt(false)}>Go Back</button>
                        <button type="submit" className="btn-confirm">Confirm Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
