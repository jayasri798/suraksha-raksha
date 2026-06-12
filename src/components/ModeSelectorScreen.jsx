import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Crown, ShieldCheck, Heart, Sparkles, UserCheck, Baby } from 'lucide-react';
import './ModeSelectorScreen.css';

const ModeSelectorScreen = ({ user, onModeSelected }) => {
  const [selected, setSelected] = useState(''); // 'Woman' | 'Elderly' | 'Kid'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selected) {
      setError('Please select a profile mode to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        mode: selected,
        gender: selected === 'Woman' ? 'female' : 'male', // maintain compatibility
        displayName: user.displayName || 'Anonymous User',
        email: user.email || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      onModeSelected(selected);
    } catch (err) {
      console.error("Error saving profile mode:", err);
      setError('Failed to configure profile mode. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mode-selector-page">
      <div className="mode-background-gradient"></div>
      
      <div className="mode-card-wrapper page-enter">
        <div className="mode-header">
          <div className="mode-crown-wrapper">
            <Crown className="mode-crown-icon" size={42} />
            <Sparkles className="crown-sparkle" size={18} />
          </div>
          <h1 className="mode-title">Choose Your Mode 👑</h1>
          <p className="mode-subtitle">Help us personalize Suraksha for you</p>
        </div>

        <div className="mode-selection-card">
          <div className="mode-options-grid">
            
            {/* Card 1: Woman */}
            <button 
              className={`mode-large-card woman-card ${selected === 'Woman' ? 'selected-active' : ''}`}
              onClick={() => setSelected('Woman')}
              type="button"
            >
              <div className="card-emoji-container">
                <span className="card-emoji-large">👩</span>
                {selected === 'Woman' && <Heart className="card-heart-active" size={20} />}
              </div>
              <div className="card-details">
                <strong className="card-title-bold">Woman Mode</strong>
                <span className="card-sub-description">Standard SOS protection</span>
              </div>
            </button>

            {/* Card 2: Elderly */}
            <button 
              className={`mode-large-card elderly-card ${selected === 'Elderly' ? 'selected-active' : ''}`}
              onClick={() => setSelected('Elderly')}
              type="button"
            >
              <div className="card-emoji-container">
                <span className="card-emoji-large">👵</span>
                {selected === 'Elderly' && <UserCheck className="card-users-active" size={20} />}
              </div>
              <div className="card-details">
                <strong className="card-title-bold">Elderly Mode</strong>
                <span className="card-sub-description">SOS + Fall Detection</span>
              </div>
            </button>

            {/* Card 3: Kid */}
            <button 
              className={`mode-large-card kid-card ${selected === 'Kid' ? 'selected-active' : ''}`}
              onClick={() => setSelected('Kid')}
              type="button"
            >
              <div className="card-emoji-container">
                <span className="card-emoji-large">🧒</span>
                {selected === 'Kid' && <Baby className="card-users-active" size={20} />}
              </div>
              <div className="card-details">
                <strong className="card-title-bold">Kid Mode</strong>
                <span className="card-sub-description">SOS + Safe Zone & Sound level</span>
              </div>
            </button>

          </div>

          {error && <p className="mode-error-text">{error}</p>}

          <button 
            onClick={handleSubmit} 
            className="mode-submit-btn-premium"
            disabled={submitting}
          >
            {submitting ? (
              <span className="mode-loading-spinner">Personalizing Suraksha...</span>
            ) : (
              <span>Proceed to Home</span>
            )}
          </button>
        </div>

        <div className="onboarding-secure-badges">
          <ShieldCheck size={14} />
          <span>Encrypted Account Personalization</span>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectorScreen;
