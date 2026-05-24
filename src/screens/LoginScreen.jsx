import { useState } from 'react';
import { auth, provider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { ShieldCheck, Loader2 } from 'lucide-react';
import './LoginScreen.css';

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen page-enter">
      <div className="login-header">
        <div className="apple-logo-wrapper">
          {/* Minimalist Solid Black Girl Silhouette avatar */}
          <div className="silhouette-logo-circle">
            <img 
              src="/girl_silhouette.png" 
              alt="SafeHer Logo" 
              className="login-silhouette-img" 
            />
          </div>
        </div>
        <h1 className="login-title-apple">SafeHer</h1>
        <p className="login-tagline-apple">Personal Safety & Protection</p>
      </div>

      <div className="login-card-container">
        <div className="login-glass-card-apple">
          <h2 className="welcome-text-apple">Sign in to stay protected</h2>
          
          <button 
            className="google-pill-btn-apple" 
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="spinner" size={22} />
            ) : (
              <>
                <svg className="google-logo" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {error && <p className="login-error">{error}</p>}

          <p className="privacy-text-apple">
            <ShieldCheck size={14} className="icon-shield-check-green" /> 100% Secure & Encrypted
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
