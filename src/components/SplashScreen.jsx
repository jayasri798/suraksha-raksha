import { motion } from 'framer-motion';
import './SplashScreen.css';

const SplashScreen = () => {
  // Pure Apple elegant light floating stars for a high-end feel
  const sparkles = Array.from({ length: 15 }).map((_, idx) => ({
    id: idx,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${Math.random() * 6 + 2}px`
  }));

  return (
    <div className="splash-screen">
      {/* Sleek Sparkles Background */}
      <div className="splash-sparkle-container">
        {sparkles.map((sp) => (
          <span
            key={sp.id}
            className="splash-apple-star"
            style={{
              left: sp.left,
              top: sp.top,
              animationDelay: sp.delay,
              animationDuration: sp.duration,
              width: sp.size,
              height: sp.size
            }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="splash-content"
      >
        <div className="splash-logo-container">
          <div className="splash-apple-glow" />
          <motion.div 
            animate={{ 
              y: [0, -6, 0]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 3, 
              ease: "easeInOut" 
            }}
            className="splash-logo-circle-apple"
          >
            {/* Minimalist Solid Black Girl Silhouette centerpiece */}
            <img 
              src="/girl_silhouette.png" 
              alt="SafeHer Logo" 
              className="splash-silhouette-img" 
            />
          </motion.div>
        </div>

        <h1 className="splash-title-apple">SafeHer</h1>
        <p className="splash-tagline-apple">Personal Safety Companion</p>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
