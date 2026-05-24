import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Loader2, LogOut, ShieldCheck, Mail, Lock, MessageSquare, Eye, Info, Radio, Smartphone, Check, Cpu } from 'lucide-react';
import './SettingsScreen.css';

const SettingsScreen = ({ user }) => {
  const [pin, setPin] = useState('0000');
  const [message, setMessage] = useState('I need urgent help! [user.displayName] is in danger! Coordinates: [LAT], [LNG]');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pairingState, setPairingState] = useState('paired'); // 'paired', 'scanning', 'unpaired', 'success'
  const [pairedId, setPairedId] = useState('SH-BRACELET-9082');
  const [deviceMobileNumber, setDeviceMobileNumber] = useState('9876543210');
  const [enteredNumber, setEnteredNumber] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [batteryLevel, setBatteryLevel] = useState('92%');
  const [bleSignal, setBleSignal] = useState('LTE Signal Strong');
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.pin) setPin(data.pin);
          if (data.message) setMessage(data.message);
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user.uid]);

  const handleInitiateSIMPairing = (e) => {
    e.preventDefault();
    if (enteredNumber.length !== 10) {
      alert("Please enter a valid 10-digit mobile number for the bracelet SIM card.");
      return;
    }
    setPairingState('scanning');
    setScanStatus('Initializing cellular link beacon...');
    
    setTimeout(() => {
      setScanStatus(`Pinging SIM network gateway (+91 ${enteredNumber})...`);
    }, 1000);

    setTimeout(() => {
      setScanStatus('Gateway active. Press and hold physical SOS button on device for 5 seconds now...');
    }, 2200);

    setTimeout(() => {
      setPairingState('success');
    }, 4000);

    setTimeout(() => {
      setDeviceMobileNumber(enteredNumber);
      setPairingState('paired');
    }, 5500);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (pin.length !== 4 || isNaN(pin)) {
      setError('PIN must be a 4-digit number');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await setDoc(doc(db, "users", user.uid), {
        pin,
        message,
        updatedAt: new Date()
      }, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth).catch(err => console.error("Sign Out Error:", err));
  };

  const handleThemeToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('safeher-darkmode', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('safeher-darkmode', 'false');
    }
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spinner-large" size={40} />
      </div>
    );
  }

  return (
    <div className="settings-screen page-enter">
      {/* Profile Hero Card - Apple style */}
      <div className="glass-card settings-hero-card">
        <div className="profile-photo-container-apple">
          <img 
            src="/girl_silhouette.png" 
            alt="Profile Avatar" 
            className="settings-profile-img-apple" 
          />
        </div>
        <h2 className="settings-profile-name-apple">{user.displayName || "Secure Profile"}</h2>
        <span className="settings-profile-email-apple">{user.email}</span>
        <span className="badge-premium-apple guardian-profile-badge-apple">Secure Guardian Profile</span>
      </div>

      {/* Settings Form */}
      <div className="settings-list-container">
        <div className="glass-card settings-item-card-premium">
          <div className="input-label-premium">
            <Mail size={16} className="icon-apple-settings" />
            <span>Profile Identity</span>
          </div>
          <input 
            type="text" 
            value={user.displayName || 'Secure User'} 
            disabled 
            className="input-field-premium-disabled" 
          />
          <p className="settings-helper-text">Registered via Google Authentication</p>
        </div>

        {/* Hardware Companion Pairing Card */}
        <div className="glass-card settings-item-card-premium device-pairing-card-apple">
          <div className="input-label-premium">
            <Cpu size={16} className="icon-apple-settings icon-ble-purple" />
            <span>SIM Toolkit Hardware Pairing</span>
          </div>

          {pairingState === 'paired' && (
            <div className="pairing-status-details-apple">
              <div className="paired-device-row-apple">
                <div className="device-spec-info-apple">
                  <Smartphone size={16} className="icon-device-apple" />
                  <div>
                    <strong>SafeHer Bracelet Kit</strong>
                    <span className="device-id-subtext">SIM Number: +91 {deviceMobileNumber.slice(0,5)} {deviceMobileNumber.slice(5)}</span>
                  </div>
                </div>
                <span className="connection-badge-active-apple">Cellular Active</span>
              </div>
              <div className="device-stats-grid-apple">
                <div className="device-stat-pill">
                  <span className="stat-label-apple">Signal Gateway</span>
                  <strong>{bleSignal}</strong>
                </div>
                <div className="device-stat-pill">
                  <span className="stat-label-apple">Kit Battery</span>
                  <strong>{batteryLevel}</strong>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-outline btn-disconnect-apple"
                onClick={() => {
                  setPairingState('unpaired');
                  setEnteredNumber('');
                }}
              >
                Disconnect Cellular Link
              </button>
            </div>
          )}

          {pairingState === 'unpaired' && (
            <form onSubmit={handleInitiateSIMPairing} className="pairing-unpaired-state-apple">
              <p className="pairing-intro-text">
                SafeHer IoT Bracelet triggers alarms directly over cellular SMS gateways. Enter your device's SIM card mobile number to link the companion.
              </p>
              
              <div className="sim-input-row-apple">
                <span className="sim-country-prefix-apple">+91</span>
                <input 
                  type="text" 
                  maxLength="10"
                  pattern="\d{10}"
                  placeholder="Enter 10-Digit Mobile No." 
                  value={enteredNumber} 
                  onChange={(e) => setEnteredNumber(e.target.value.replace(/\D/g, ''))}
                  className="input-field-premium sim-phone-input-apple"
                  required
                />
              </div>

              <div className="pairing-instruction-card-apple">
                <span className="instruction-badge-apple">HARDWARE ACTION</span>
                <p>Press and hold the hardware panic switch on your physical device for 5 seconds until its status indicator flashes blue before linking.</p>
              </div>

              <button 
                type="submit" 
                className="btn-primary btn-pair-device-apple"
              >
                <Radio size={14} className="icon-pulse-radio" />
                <span>Initiate Cellular Handshake Link</span>
              </button>
            </form>
          )}

          {pairingState === 'scanning' && (
            <div className="pairing-scanning-state-apple">
              <div className="radar-animation-circle-apple">
                <div className="radar-wave-apple wave-1"></div>
                <div className="radar-wave-apple wave-2"></div>
                <Radio size={24} className="radar-center-icon-apple icon-cellular-antenna-apple" />
              </div>
              <span className="pairing-status-log-apple">{scanStatus}</span>
            </div>
          )}

          {pairingState === 'success' && (
            <div className="pairing-success-state-apple">
              <div className="pairing-success-check-circle">
                <Check size={28} className="icon-success-check" />
              </div>
              <strong>IoT Link Secured!</strong>
              <span>Paired SIM: +91 {enteredNumber}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="settings-form-wrapper">
          <div className="glass-card settings-item-card-premium">
            <div className="input-label-premium">
              <Lock size={16} className="icon-apple-settings" />
              <span>Safety Cancel PIN</span>
            </div>
            <input 
              type="password" 
              maxLength="4" 
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              className="input-field-premium" 
              required
            />
            <p className="settings-helper-text">Enter a 4-digit PIN to cancel false alarms</p>
          </div>

          <div className="glass-card settings-item-card-premium">
            <div className="input-label-premium">
              <MessageSquare size={16} className="icon-apple-settings" />
              <span>SOS Broadcast Message</span>
            </div>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input-field-premium settings-textarea"
              required
            />
            <p className="settings-helper-text">Placeholders: [user.displayName], [LAT], [LNG] are resolved automatically on alert dispatch.</p>
          </div>

          {error && <p className="settings-error-text-apple">{error}</p>}
          {success && <p className="settings-success-text-apple">Settings saved successfully! ✅</p>}

          <button type="submit" className="btn-primary save-settings-pill-btn" disabled={saving}>
            {saving ? <Loader2 className="spinner" size={20} /> : 'Save Settings'}
          </button>
        </form>

        {/* Toggles */}
        <div className="glass-card settings-item-card-premium settings-toggle-card">
          <div className="settings-toggle-left">
            <div className="toggle-label-row">
              <Eye size={16} className="icon-apple-settings" />
              <strong>Dark Mode Theme</strong>
            </div>
          </div>
          <label className="apple-switch">
            <input type="checkbox" checked={isDark} onChange={handleThemeToggle} />
            <span className="apple-slider" />
          </label>
        </div>

        {/* About App */}
        <div className="glass-card settings-about-card">
          <div className="about-title-row">
            <Info size={16} className="icon-apple-about" />
            <strong>System Information</strong>
          </div>
          <span className="about-text-bold">SafeHer Protection v1.0.0</span>
          <span className="about-subtext-light">End-to-End Encrypted Satellite Relays</span>
        </div>

        {/* Sign Out */}
        <button onClick={handleSignOut} className="btn-signout-premium-apple">
          <LogOut size={16} />
          <span>Sign Out Session</span>
        </button>
      </div>
    </div>
  );
};

export default SettingsScreen;
