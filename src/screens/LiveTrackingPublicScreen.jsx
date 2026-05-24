import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { Shield, Navigation, Compass, AlertCircle, Radio, Loader2, Award, Heart } from 'lucide-react';
import './LiveTrackingPublicScreen.css';

const LiveTrackingPublicScreen = () => {
  const { userId } = useParams();
  
  // States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
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

  // Refs for tracking map/marker objects
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const guardianMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const lastLocationRef = useRef(null);
  const guardianWatchId = useRef(null);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
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
      // Cleanup guardian sharing on unmount
      if (guardianWatchId.current) {
        navigator.geolocation.clearWatch(guardianWatchId.current);
      }
    };
  }, []);

  // Listen to User Profile Data (name, gender)
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.snapshot ? snapshot.snapshot.data() : snapshot.data();
        setUserData(data);
        
        // Check for active SOS alert from last 1 hour
        if (data.sos_alerts) {
          // If Firestore includes SOS flag in user root
          setIsSOSActive(!!data.isSOSActive);
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

  // Listen to Tracked Location updates
  useEffect(() => {
    if (!userId) return;

    // Listen to users/{userId}/location/current
    const currentLocRef = doc(db, "users", userId, "location", "current");
    const unsubscribe = onSnapshot(currentLocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
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
            const timeDiff = (newLoc.updatedAt.getTime() - prev.updatedAt.getTime()) / 1000; // secs
            
            if (timeDiff > 0) {
              const speed = dist / timeDiff; // m/s
              // Threshold 0.8 m/s (~2.9 km/h) to classify as moving
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

          // Append to trail
          setTrail(prev => {
            // Avoid inserting identical successive points
            if (prev.length > 0) {
              const lastPoint = prev[prev.length - 1];
              if (lastPoint[0] === newLoc.lat && lastPoint[1] === newLoc.lng) {
                return prev;
              }
            }
            return [...prev, [newLoc.lat, newLoc.lng]];
          });
        }
      } else {
        // Fallback: Check if location is embedded directly inside users/{userId}
        const userRef = doc(db, "users", userId);
        getDocFallback(userRef);
      }
    }, (err) => {
      console.error("Firestore location current sub:", err);
    });

    const getDocFallback = async (ref) => {
      const unsubFallback = onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.location && data.location.lat && data.location.lng) {
            const newLoc = {
              lat: parseFloat(data.location.lat),
              lng: parseFloat(data.location.lng),
              updatedAt: data.location.updatedAt ? new Date(data.location.updatedAt) : new Date()
            };
            setTrackedLocation(newLoc);
            setLoading(false);
          }
        }
      });
      return () => unsubFallback();
    };

    return () => unsubscribe();
  }, [userId]);

  // Listen to Guardian's Shared Location
  useEffect(() => {
    if (!userId) return;

    const guardianLocRef = doc(db, "users", userId, "location", "guardian");
    const unsubscribe = onSnapshot(guardianLocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
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

  // Handle live updating ticker for relative update time
  useEffect(() => {
    const interval = setInterval(() => {
      if (trackedLocation) {
        const diff = Math.floor((new Date().getTime() - trackedLocation.updatedAt.getTime()) / 1000);
        if (diff < 5) {
          setLastUpdatedText('just now');
        } else if (diff < 60) {
          setLastUpdatedText(`${diff} seconds ago`);
        } else {
          const mins = Math.floor(diff / 60);
          setLastUpdatedText(`${mins} min ${diff % 60}s ago`);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [trackedLocation]);

  // Set up Map, Markers and Paths when Leaflet and coordinates load
  useEffect(() => {
    if (!leafletLoaded || !trackedLocation) return;

    const L = window.L;

    // 1. Initialize Map
    if (!mapRef.current) {
      const map = L.map('live-map', {
        zoomControl: false,
        attributionControl: false
      }).setView([trackedLocation.lat, trackedLocation.lng], 16);

      // Official Google Maps Cartography Tile Layer
      const googleTiles = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
      googleTiles.addTo(map);

      // Fallback OSM layer in case of referrer locks
      googleTiles.on('tileerror', () => {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
      });

      mapRef.current = map;
    } else {
      // Pan smoothly to tracked user
      mapRef.current.panTo([trackedLocation.lat, trackedLocation.lng]);
    }

    const map = mapRef.current;

    // 2. Draw/Update Girl Pin with Pulsing Red Ring
    const isFemale = userData?.gender === 'female';
    const pinColor = isFemale ? '#FF375F' : '#007AFF';
    const pinEmoji = isFemale ? '👧' : '👨';

    const girlIconHtml = `
      <div class="custom-map-marker-wrapper">
        <div class="pulsing-marker-ring"></div>
        <div class="marker-avatar-core" style="background-color: ${pinColor};">
          <span>${pinEmoji}</span>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: girlIconHtml,
      className: 'leaflet-custom-div-icon',
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([trackedLocation.lat, trackedLocation.lng], { icon: userIcon }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([trackedLocation.lat, trackedLocation.lng]);
    }

    // 3. Draw/Update Path Trail (Dotted Polyline)
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

    // 4. Draw/Update Guardian Pin (if sharing active)
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

  }, [leafletLoaded, trackedLocation, userData, trail, guardianLocation]);

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

  // Toggle Geolocation for Guardian
  const handleToggleGuardianLocation = async () => {
    if (guardianSharing) {
      // Turn Off Location Sharing
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
      // Turn On Location Sharing
      if (!("geolocation" in navigator)) {
        alert("Geolocation is not supported by your browser.");
        return;
      }

      setGuardianSharing(true);
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
          console.error("Guardian GPS Error:", err);
          alert("Failed to acquire GPS lock. Please enable location services.");
          setGuardianSharing(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Recenter map on tracked user coordinates
  const handleRecenter = () => {
    if (mapRef.current && trackedLocation) {
      mapRef.current.setView([trackedLocation.lat, trackedLocation.lng], 17);
    }
  };

  // Route in Apple Maps / Google Maps for driving instructions
  const handleNavigateToHer = () => {
    if (!trackedLocation) return;
    const url = `https://maps.google.com/?daddr=${trackedLocation.lat},${trackedLocation.lng}&dirflg=d`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="public-loading-screen-apple">
        <div className="loading-content-apple">
          <div className="pulsing-shield-icon">
            <Shield className="logo-shield" size={40} />
          </div>
          <h2>Accessing SafeHer Live Relay...</h2>
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

  return (
    <div className="public-tracker-container">
      {/* Full Screen Interactive Map Canvas */}
      <div id="live-map" className="full-screen-map-element"></div>

      {/* Flashing SOS Header Overlay if active */}
      {isSOSActive && (
        <div className="sos-emergency-flasher-bar">
          <span>🚨 EMERGENCY SOS ACTIVE — ACTIVE DISPATCH SIGNAL</span>
        </div>
      )}

      {/* Floating Status Badges Top Right */}
      <div className="top-badges-panel">
        <div className="live-status-pill blink-live">
          <span className="live-dot">🔴</span>
          <span className="live-text">LIVE</span>
        </div>
      </div>

      {/* Cupertino Top Header Card */}
      <div className="floating-header-panel page-enter">
        <div className="header-avatar-circle">
          <span>{userData?.gender === 'female' ? '👧' : '👨'}</span>
        </div>
        <div className="header-details-col">
          <h1 className="header-title-text">Tracking {nameText}</h1>
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
            <span className="telemetry-value">{trackedLocation?.lat.toFixed(6)}</span>
          </div>
          <div className="telemetry-coord-pill">
            <span className="telemetry-label">LONGITUDE</span>
            <span className="telemetry-value">{trackedLocation?.lng.toFixed(6)}</span>
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
            <span>Navigate to Her</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingPublicScreen;
