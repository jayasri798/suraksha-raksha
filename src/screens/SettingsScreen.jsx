import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, MessageSquare, Info, Save, LogOut, Loader2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import './SettingsScreen.css';

const SettingsScreen = ({ user, isDark, setIsDark }) => {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('EMERGENCY! [user.displayName] needs help!\nLocation: https://maps.google.com/?q=[LAT],[LNG]\nPlease call police immediately! - SafeHer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPin(data.pin || '');
          setMsg(data.emergencyMessage || msg);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user.uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        email: user.email,
        pin,
        emergencyMessage: msg,
        darkMode: isDark
      }, { merge: true });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="settings-screen">
      <div className="screen-header">
        <h1 className="title-large">Settings</h1>
        <p className="subtitle-muted">Personalize your app</p>
      </div>

      <div className="card profile-card">
        <img 
          src={user.photoURL} 
          alt={user.displayName} 
          className="profile-photo-img" 
        />
        <h3 className="profile-name">{user.displayName}</h3>
        <p className="profile-email">{user.email}</p>
      </div>

      <div className="settings-list">
        <div className="card settings-item-card">
          <label className="input-label"><Lock size={14} /> Cancel PIN (4 digits)</label>
          <input type="password" className="input-field" maxLength="4" value={pin} onChange={e => setPin(e.target.value)} placeholder="0000" />
          <p className="helper-text">Enter PIN to cancel false alarm</p>
        </div>

        <div className="card settings-item-card">
          <label className="input-label"><MessageSquare size={14} /> Emergency Message</label>
          <textarea className="input-field" rows="4" value={msg} onChange={e => setMsg(e.target.value)} />
          <p className="helper-text">Use [user.displayName] and [LAT], [LNG]</p>
        </div>

        <div className="card settings-item-card toggle-card">
          <div className="toggle-info">
            <strong>Dark Mode</strong>
            <p className="helper-text">Switch between light and dark</p>
          </div>
          <div className={`toggle-switch ${isDark ? 'active' : ''}`} onClick={() => setIsDark(!isDark)}>
            <div className="toggle-dot" />
          </div>
        </div>

        <div className="card about-card">
          <div className="about-row">
            <Info size={16} className="icon-purple" />
            <strong>SafeHer v1.0</strong>
          </div>
          <p>Women Safety Bracelet Project</p>
          <p className="small-helper">Diploma Project 2024</p>
        </div>
      </div>

      <button className="btn-primary save-settings-btn" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="spinner" size={20} /> : <><Save size={20} /> {saved ? 'Saved!' : 'Save Settings'}</>}
      </button>

      <button className="btn-signout" onClick={handleSignOut}>
        <LogOut size={20} /> Sign Out
      </button>
    </motion.div>
  );
};

export default SettingsScreen;
