import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Lock, MapPin, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './HomeScreen.css';

const HomeScreen = ({ user }) => {
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [location, setLocation] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user settings
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setSettings(userDoc.data());
        }

        // Fetch contacts
        const contactsSnap = await getDocs(collection(db, "users", user.uid, "contacts"));
        const contactsList = contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContacts(contactsList);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid]);

  useEffect(() => {
    if (isSOSActive) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }),
          null,
          { enableHighAccuracy: true }
        );
      }
    }
  }, [isSOSActive]);

  const openWhatsApp = () => {
    const msgTemplate = "EMERGENCY! [user.displayName] needs help!\nLocation: https://maps.google.com/?q=[LAT],[LNG]\nPlease call police immediately! - SafeHer";
    let message = msgTemplate
      .replace('[user.displayName]', user.displayName)
      .replace('[LAT]', location?.lat || '0')
      .replace('[LNG]', location?.lng || '0');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const triggerSOS = async () => {
    // Save to Firestore
    try {
      await addDoc(collection(db, "users", user.uid, "sos_alerts"), {
        location: location,
        timestamp: serverTimestamp(),
        userName: user.displayName,
        status: 'active'
      });
    } catch (err) {
      console.error("Error logging SOS:", err);
    }

    openWhatsApp();
  };

  useEffect(() => {
    let timer;
    if (isSOSActive && countdown > 0 && !showPinPrompt) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (isSOSActive && countdown === 0) {
      triggerSOS();
    }
    return () => clearInterval(timer);
  }, [isSOSActive, countdown, showPinPrompt]);

  const startHold = () => {
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      setCountdown(10);
      setIsSOSActive(true);
      setIsHolding(false);
    }, 3000);
  };

  const endHold = () => {
    clearTimeout(holdTimerRef.current);
    setIsHolding(false);
  };

  const handleCancelRequest = () => {
    if (settings?.pin) setShowPinPrompt(true);
    else setIsSOSActive(false);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === settings?.pin) {
      setIsSOSActive(false);
      setShowPinPrompt(false);
      setError('');
    } else {
      setError('Incorrect PIN');
      setPinInput('');
    }
  };

  if (loading) {
    return (
      <div className="home-screen-loading">
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  const firstName = user.displayName?.split(' ')[0] || 'User';

  return (
    <div className="home-screen">
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
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sos-popup-overlay">
            <div className="sos-popup-content">
              <AlertTriangle size={80} className="warning-icon-animate" />
              <h1 className="popup-title">ALERT SENT!</h1>
              <p className="popup-subtitle">Help is on the way</p>

              <div className="countdown-circle">
                <span>{countdown}</span>
              </div>

              <div className="notified-section">
                <p>Notified:</p>
                <div className="pills-container">
                  {contacts.length > 0 ? contacts.map((c, i) => (
                    <span key={i} className="contact-pill">{c.name}</span>
                  )) : (
                    <span className="contact-pill">Emergency Services</span>
                  )}
                </div>
              </div>

              <button className="btn-cancel-popup" onClick={handleCancelRequest}>
                CANCEL ALERT
              </button>

              {showPinPrompt && (
                <div className="pin-popup-overlay">
                  <div className="pin-popup-box">
                    <Lock size={32} />
                    <h3>Enter PIN</h3>
                    <form onSubmit={handlePinSubmit}>
                      <input type="password" maxLength="4" autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} />
                      {error && <p className="pin-error-text">{error}</p>}
                      <div className="pin-actions">
                        <button type="button" onClick={() => setShowPinPrompt(false)}>Back</button>
                        <button type="submit" className="confirm">Confirm</button>
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
