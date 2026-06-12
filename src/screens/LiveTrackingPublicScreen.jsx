import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db, rtdb } from '../firebase';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, onValue, set as setDbValue } from 'firebase/database';
import { Shield, Navigation, Compass, AlertCircle, Radio, Loader2 } from 'lucide-react';
import './LiveTrackingPublicScreen.css';

const LiveTrackingPublicScreen = () => {
  const { userId } = useParams();
  
  // States
  const [leafletLoaded, setLeafletLoaded] = useState(!!window.L);
  const [userData, setUserData] = useState(null);
  const [trackedLocation, setTrackedLocation] = useState(null);
  const [guardianLocation, setGuardianLocation] = useState(null);
  const [trail, setTrail] = useState([]);
  
  const [lastUpdatedText, setLastUpdatedText] = useState('just now');
  const [speedState, setSpeedState] = useState('Stationary ⚠️');
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [guardianSharing, setGuardianSharing] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Hardware Sensor States (RTDB)
  const [fallDetected, setFallDetected] = useState(false);
  const [soundAlert, setSoundAlert] = useState(false);

  // Geofencing state (Kid mode)
  const [isOutsideSafeZone, setIsOutsideSafeZone] = useState(false);

  // Inactivity warning state (no update for 5 minutes)
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityMinutes, setInactivityMinutes] = useState(0);

  // Refs for tracking map/marker objects
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const guardianMarkerRef = useRef(null);
  const safeZoneCircleRef = useRef(null);
  const polylineRef = useRef(null);
  const lastLocationRef = useRef(null);
  const guardianWatchId = useRef(null);

  // Haversine distance calculator
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.id = 'leaflet-css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.id = 'leaflet-js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (guardianWatchId.current) {
        navigator.geolocation.clearWatch(guardianWatchId.current);
      }
    };
  }, []);

  // Listen to User Profile Data (name, mode, safeZone, and SOS flag)
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData(data);
        setIsSOSActive(!!data.isSOSActive);
        
        // Fallback: If RTDB has not loaded location coordinates yet, parse from root profile map
        if (data.location && data.location.lat && data.location.lng) {
          const newLoc = {
            lat: parseFloat(data.location.lat),
            lng: parseFloat(data.location.lng),
            updatedAt: data.location.updatedAt ? new Date(data.location.updatedAt) : new Date()
          };
          setTrackedLocation(prev => prev ? prev : newLoc);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } else {
        setError('User profile not found. The link may have expired.');
      }
    }, (err) => {
      console.error("Firestore user sub:", err);
      setError('Connection to security relay lost. Retrying...');
    });

    return () => unsubscribe();
  }, [userId]);

  // Listen to live tracked location from Realtime Database (/users/{userId}/location)
  useEffect(() => {
    if (!userId) return;

    const locRef = ref(rtdb, `users/${userId}/location`);
    const unsubscribe = onValue(locRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.lat && data.lng) {
          const newLoc = {
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
          };

          // Calculate speed based on delta
          if (lastLocationRef.current) {
            const prev = lastLocationRef.current;
            const dist = calculateDistance(prev.lat, prev.lng, newLoc.lat, newLoc.lng);
            const timeDiff = (newLoc.updatedAt.getTime() - prev.updatedAt.getTime()) / 1000;
            
            if (timeDiff > 0) {
              const speed = dist / timeDiff;
              if (speed > 0.8) {
                setSpeedState('Moving 🚶');
              } else {
                setSpeedState('Stationary ⚠️');
              }
            }
          }

          lastLocationRef.current = newLoc;
          setTrackedLocation(newLoc);
          setLoading(false);
        }
      }
    }, (err) => {
      console.error("RTDB live location sub:", err);
    });

    return () => unsubscribe();
  }, [userId]);

  // Listen to SOS Trail from Realtime Database (/users/{userId}/sosTrail)
  useEffect(() => {
    if (!userId) return;

    const trailRef = ref(rtdb, `users/${userId}/sosTrail`);
    const unsubscribe = onValue(trailRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Chronological sort of pushed objects
        const points = Object.values(data)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .map(pt => [pt.lat, pt.lng]);
        setTrail(points);
      } else {
        setTrail([]);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Listen to Companion status flags from RTDB (/users/{userId}/status)
  useEffect(() => {
    if (!userId) return;

    const statusRef = ref(rtdb, `users/${userId}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFallDetected(!!data.fallDetected);
        setSoundAlert(!!data.soundAlert);
      } else {
        setFallDetected(false);
        setSoundAlert(false);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Listen to Guardian's Shared Location (Firestore fallback)
  useEffect(() => {
    if (!userId) return;

    const guardianLocRef = doc(db, "users", userId, "location", "guardian");
    const unsubscribe = onSnapshot(guardianLocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val ? snapshot.val() : snapshot.data();
        if (data.active !== false && data.lat && data.lng) {
          setGuardianLocation({
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
            updatedAt: new Date(data.updatedAt || new Date())
          });
        } else {
          setGuardianLocation(null);
        }
      } else {
        setGuardianLocation(null);
      }
    }, (err) => console.error("Firestore guardian location sub:", err));

    return () => unsubscribe();
  }, [userId]);

  // Handle live updating ticker for relative update time & 5 minute inactivity warning
  useEffect(() => {
    const interval = setInterval(() => {
      if (trackedLocation && trackedLocation.updatedAt) {
        const diffSeconds = Math.floor((new Date().getTime() - trackedLocation.updatedAt.getTime()) / 1000);
        
        // Relative text ticker
        if (diffSeconds < 5) {
          setLastUpdatedText('just now');
        } else if (diffSeconds < 60) {
          setLastUpdatedText(`${diffSeconds} seconds ago`);
        } else {
          const mins = Math.floor(diffSeconds / 60);
          setLastUpdatedText(`${mins} min ${diffSeconds % 60}s ago`);
        }

        // 5-minute inactivity warning banner
        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes >= 5) {
          setShowInactivityWarning(true);
          setInactivityMinutes(diffMinutes);
        } else {
          setShowInactivityWarning(false);
        }
      } else {
        setLastUpdatedText('awaiting GPS signal');
        setShowInactivityWarning(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [trackedLocation]);

  // Geofence alert check (Kid mode)
  useEffect(() => {
    Promise.resolve().then(() => {
      if (userData?.mode === 'Kid' && userData?.safeZone && trackedLocation) {
        const { lat, lng, radius } = userData.safeZone;
        const dist = calculateDistance(trackedLocation.lat, trackedLocation.lng, lat, lng);
        setIsOutsideSafeZone(dist > radius);
      } else {
        setIsOutsideSafeZone(false);
      }
    });
  }, [userData, trackedLocation]);

  // Set up Map, Markers and Paths when Leaflet loads
  useEffect(() => {
    if (!leafletLoaded) return;

    const L = window.L;
    const activeLat = trackedLocation?.lat || 16.284583;
    const activeLng = trackedLocation?.lng || 80.457524;

    // 1. Initialize Map
    if (!mapRef.current) {
      const map = L.map('live-map', {
        zoomControl: false,
        attributionControl: false
      }).setView([activeLat, activeLng], trackedLocation ? 16 : 14);

      const googleTiles = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
      googleTiles.addTo(map);

      googleTiles.on('tileerror', () => {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
      });

      mapRef.current = map;
    } else if (trackedLocation) {
      mapRef.current.panTo([trackedLocation.lat, trackedLocation.lng]);
    }

    const map = mapRef.current;

    // 2. Draw/Update user marker
    if (trackedLocation) {
      const modeVal = userData?.mode || 'Woman';
      let pinColor = '#FF375F'; // Woman (Pink)
      let pinEmoji = '👩';
      if (modeVal === 'Elderly') {
        pinColor = '#FF9500'; // Elderly (Amber)
        pinEmoji = '👵';
      } else if (modeVal === 'Kid') {
        pinColor = '#5856D6'; // Kid (Purple/Blue)
        pinEmoji = '🧒';
      }

      const userIconHtml = `
        <div class="custom-map-marker-wrapper">
          <div class="pulsing-marker-ring" style="border-color: ${pinColor}; background-color: ${pinColor}25;"></div>
          <div class="marker-avatar-core" style="background-color: ${pinColor}; border: 2px solid white;">
            <span>${pinEmoji}</span>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'leaflet-custom-div-icon',
        iconSize: [46, 46],
        iconAnchor: [23, 23]
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([trackedLocation.lat, trackedLocation.lng], { icon: userIcon }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([trackedLocation.lat, trackedLocation.lng]);
      }
    }

    // 3. Draw/Update Trail Path Polyline
    if (trail.length > 1) {
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(trail, {
          color: '#FF375F',
          weight: 4,
          dashArray: '8, 12',
          lineCap: 'round',
          lineJoin: 'round',
          opacity: 0.8
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(trail);
      }
    }

    // 4. Draw/Update Guardian Pin
    if (guardianLocation) {
      const guardianIconHtml = `
        <div class="custom-map-marker-wrapper">
          <div class="marker-avatar-core" style="background-color: #007AFF; border: 2px solid white;">
            <span>👨</span>
          </div>
        </div>
      `;
      const guardianIcon = L.divIcon({
        html: guardianIconHtml,
        className: 'leaflet-custom-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      if (!guardianMarkerRef.current) {
        guardianMarkerRef.current = L.marker([guardianLocation.lat, guardianLocation.lng], { icon: guardianIcon }).addTo(map);
      } else {
        guardianMarkerRef.current.setLatLng([guardianLocation.lat, guardianLocation.lng]);
      }
    } else if (guardianMarkerRef.current) {
      map.removeLayer(guardianMarkerRef.current);
      guardianMarkerRef.current = null;
    }

    // 5. Draw/Update Safe Zone Circle (Kid mode only)
    if (userData?.mode === 'Kid' && userData?.safeZone) {
      const { lat, lng, radius } = userData.safeZone;
      
      if (!safeZoneCircleRef.current) {
        safeZoneCircleRef.current = L.circle([lat, lng], {
          color: '#5856D6',
          fillColor: '#5856D6',
          fillOpacity: 0.1,
          radius: radius,
          weight: 1.5,
          dashArray: '4, 6'
        }).addTo(map);
      } else {
        safeZoneCircleRef.current.setLatLng([lat, lng]);
        safeZoneCircleRef.current.setRadius(radius);
      }
    } else if (safeZoneCircleRef.current) {
      map.removeLayer(safeZoneCircleRef.current);
      safeZoneCircleRef.current = null;
    }

  }, [leafletLoaded, trackedLocation, userData, trail, guardianLocation]);

  // Toggle Geolocation for Guardian
  const handleToggleGuardianLocation = async () => {
    if (guardianSharing) {
      setGuardianSharing(false);
      if (guardianWatchId.current) {
        navigator.geolocation.clearWatch(guardianWatchId.current);
        guardianWatchId.current = null;
      }
      try {
        const guardianLocRef = doc(db, "users", userId, "location", "guardian");
        await deleteDoc(guardianLocRef);
      } catch (err) {
        console.error("Error removing guardian profile:", err);
      }
      setGuardianLocation(null);
    } else {
      if (!("geolocation" in navigator)) {
        alert("Geolocation is not supported by your browser.");
        return;
      }

      setGuardianSharing(true);
      
      const startWatchingGuardian = (highAccuracy = true) => {
        guardianWatchId.current = navigator.geolocation.watchPosition(
          async (position) => {
            const lat = parseFloat(position.coords.latitude.toFixed(6));
            const lng = parseFloat(position.coords.longitude.toFixed(6));
            
            try {
              const guardianLocRef = doc(db, "users", userId, "location", "guardian");
              await setDoc(guardianLocRef, {
                lat,
                lng,
                updatedAt: new Date().toISOString(),
                active: true
              });
            } catch (err) {
              console.error("Error writing guardian coordinates:", err);
            }
          },
          (err) => {
            console.warn(`Guardian GPS Error (highAccuracy=${highAccuracy}):`, err);
            if (highAccuracy) {
              navigator.geolocation.clearWatch(guardianWatchId.current);
              startWatchingGuardian(false);
            } else {
              alert("Failed to acquire GPS lock. Please enable location services.");
              setGuardianSharing(false);
            }
          },
          { 
            enableHighAccuracy: highAccuracy, 
            timeout: highAccuracy ? 8000 : 20000, 
            maximumAge: highAccuracy ? 0 : 60000 
          }
        );
      };

      startWatchingGuardian(true);
    }
  };

  // Recenter map on tracked user coordinates
  const handleRecenter = () => {
    if (mapRef.current && trackedLocation) {
      mapRef.current.setView([trackedLocation.lat, trackedLocation.lng], 17);
    }
  };

  const handleNavigateToHer = () => {
    if (!trackedLocation) return;
    const url = `https://maps.google.com/?daddr=${trackedLocation.lat},${trackedLocation.lng}&dirflg=d`;
    window.open(url, '_blank');
  };

  // Clear hardware alerts
  const handleClearFallAlert = async () => {
    try {
      await setDbValue(ref(rtdb, `users/${userId}/status/fallDetected`), false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearSoundAlert = async () => {
    try {
      await setDbValue(ref(rtdb, `users/${userId}/status/soundAlert`), false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="public-loading-screen-apple">
        <div className="loading-content-apple">
          <div className="pulsing-shield-icon">
            <Shield className="logo-shield" size={40} />
          </div>
          <h2>Accessing Suraksha Live Relay...</h2>
          <p>Handshaking secured satellite beacon connection</p>
          <Loader2 className="spinner-large public-spinner" size={32} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-loading-screen-apple error-screen">
        <div className="loading-content-apple">
          <AlertCircle className="error-shield" size={48} />
          <h2>Connection Failed</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-btn-apple">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const nameText = userData?.displayName ? userData.displayName.split(' ')[0] : 'User';
  const modeVal = userData?.mode || 'Woman';

  // Calculate top offset dynamically for overlap prevention
  const bannersCount = (isSOSActive ? 1 : 0) + (showInactivityWarning ? 1 : 0) + (isOutsideSafeZone ? 1 : 0) + (fallDetected ? 1 : 0) + (soundAlert ? 1 : 0);
  const headerTopOffset = 16 + bannersCount * 52; // spacing calculation

  const getModeEmoji = () => {
    if (modeVal === 'Woman') return '👧';
    if (modeVal === 'Elderly') return '👵';
    if (modeVal === 'Kid') return '🧒';
    return '👤';
  };

  return (
    <div className="public-tracker-container">
      {/* Full Screen Interactive Map Canvas */}
      <div id="live-map" className="full-screen-map-element"></div>

      {/* Real-time Warning Banners Stack */}
      <div className="tracking-banners-container">
        {isSOSActive && (
          <div className="tracking-alert-banner danger">
            <div className="banner-content">
              <span>🚨</span>
              <strong>EMERGENCY SOS ACTIVE — ACTIVE DISPATCH SIGNAL</strong>
            </div>
          </div>
        )}
        
        {fallDetected && (
          <div className="tracking-alert-banner danger">
            <div className="banner-content">
              <span>👵</span>
              <strong>FALL DETECTED ALERT!</strong>
            </div>
            <button onClick={handleClearFallAlert} className="dismiss-banner-btn">Dismiss</button>
          </div>
        )}

        {soundAlert && (
          <div className="tracking-alert-banner danger">
            <div className="banner-content">
              <span>🔊</span>
              <strong>LOUD SOUND DETECTED ALERT!</strong>
            </div>
            <button onClick={handleClearSoundAlert} className="dismiss-banner-btn">Dismiss</button>
          </div>
        )}

        {isOutsideSafeZone && (
          <div className="tracking-alert-banner danger">
            <div className="banner-content">
              <span>⚠️</span>
              <strong>OUTSIDE SAFE ZONE BOUNDARY!</strong>
            </div>
          </div>
        )}

        {showInactivityWarning && (
          <div className="tracking-alert-banner warning">
            <div className="banner-content">
              <span>⏱️</span>
              <span>Last seen {inactivityMinutes} minutes ago — possibly stationary</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Status Badges Top Right */}
      <div className="top-badges-panel" style={{ top: `${headerTopOffset}px`, transition: 'top 0.3s ease' }}>
        <div className="live-status-pill blink-live">
          <span className="live-dot">🔴</span>
          <span className="live-text">LIVE</span>
        </div>
      </div>

      {/* Cupertino Top Header Card */}
      <div className="floating-header-panel page-enter" style={{ top: `${headerTopOffset}px`, transition: 'top 0.3s ease' }}>
        <div className="header-avatar-circle">
          <span>{getModeEmoji()}</span>
        </div>
        <div className="header-details-col">
          <h1 className="header-title-text">Tracking {nameText} ({modeVal})</h1>
          <div className="header-subtitle-row">
            <span className="subtitle-tag last-updated-tag">Updated {lastUpdatedText}</span>
            <span className="subtitle-tag speed-tag" data-moving={speedState.startsWith('Moving')}>
              {speedState}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Bottom Telemetry Controls */}
      <div className="floating-bottom-controls page-enter">
        {/* Coordinates Details */}
        <div className="telemetry-coordinates-grid">
          <div className="telemetry-coord-pill">
            <span className="telemetry-label">LATITUDE</span>
            <span className="telemetry-value">{trackedLocation ? trackedLocation.lat.toFixed(6) : '---'}</span>
          </div>
          <div className="telemetry-coord-pill">
            <span className="telemetry-label">LONGITUDE</span>
            <span className="telemetry-value">{trackedLocation ? trackedLocation.lng.toFixed(6) : '---'}</span>
          </div>
        </div>

        {/* Action Controls Panel */}
        <div className="telemetry-actions-panel">
          <button 
            onClick={handleToggleGuardianLocation} 
            className={`btn-control guardian-share-btn ${guardianSharing ? 'active-sharing' : ''}`}
          >
            <Radio size={18} className={guardianSharing ? 'pulse-green' : ''} />
            <span>{guardianSharing ? 'Sharing Location 👨' : 'Share My Location 👨'}</span>
          </button>

          <button onClick={handleRecenter} className="btn-control recenter-btn">
            <Compass size={18} />
            <span>Recenter Map</span>
          </button>
          
          <button onClick={handleNavigateToHer} className="btn-control navigate-btn">
            <Navigation size={18} />
            <span>Navigate to {nameText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingPublicScreen;
