import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Crown, ShieldCheck, Heart, Users, Sparkles } from 'lucide-react';
import './GenderSelectorScreen.css';

const GenderSelectorScreen = ({ user, onGenderSelected }) => {
  const [selected, setSelected] = useState(''); // 'female' or 'male'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selected) {
      setError('Please select your profile type to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Save gender to Firestore: users/{uid}/gender = "female" or "male"
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        gender: selected,
        displayName: user.displayName || 'Anonymous User',
        email: user.email || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      onGenderSelected(selected);
    } catch (err) {
      console.error("Error saving profile type:", err);
      setError('Failed to configure profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gender-selector-page">
      <div className="gender-background-gradient"></div>
      
      <div className="gender-card-wrapper page-enter">
        {/* Crown Icon and Title */}
        <div className="gender-header">
          <div className="gender-crown-wrapper">
            <Crown className="gender-crown-icon" size={42} />
            <Sparkles className="crown-sparkle" size={18} />
          </div>
          <h1 className="gender-title">One last step 👑</h1>
          <p className="gender-subtitle">Help us personalize Suraksha for you</p>
        </div>

        {/* Dynamic Selector Box */}
        <div className="gender-selection-card">
          <div className="gender-options-grid">
            
            {/* Card 1: Female Selection */}
            <button 
              className={`gender-large-card female-card ${selected === 'female' ? 'selected-active' : ''}`}
              onClick={() => setSelected('female')}
              type="button"
            >
              <div className="card-emoji-container">
                <span className="card-emoji-large">👧</span>
                {selected === 'female' && <Heart className="card-heart-active" size={20} />}
              </div>
              <div className="card-details">
                <strong className="card-title-bold">I am Female</strong>
                <span className="card-sub-description">Get full safety features</span>
              </div>
            </button>

            {/* Card 2: Male Guardian Selection */}
            <button 
              className={`gender-large-card male-card ${selected === 'male' ? 'selected-active' : ''}`}
              onClick={() => setSelected('male')}
              type="button"
            >
              <div className="card-emoji-container">
                <span className="card-emoji-large">👦</span>
                {selected === 'male' && <Users className="card-users-active" size={20} />}
              </div>
              <div className="card-details">
                <strong className="card-title-bold">I am Male / Guardian</strong>
                <span className="card-sub-description">I will protect someone</span>
              </div>
            </button>

          </div>

          {error && <p className="gender-error-text">{error}</p>}

          <button 
            onClick={handleSubmit} 
            className="gender-submit-btn-premium"
            disabled={submitting}
          >
            {submitting ? (
              <span className="gender-loading-spinner">Personalizing Suraksha...</span>
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

export default GenderSelectorScreen;
