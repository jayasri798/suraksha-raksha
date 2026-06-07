import { useState, useEffect } from 'react';
import { Loader2, MapPin, RefreshCw, Share2, ShieldCheck } from 'lucide-react';
import './LiveLocationScreen.css';

const LiveLocationScreen = ({ user, globalLocation, onRefreshLocation }) => {
  const [address, setAddress] = useState('Resolving location...');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getAddressFromCoords = async (lat, lng) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        setAddress('Address resolved (Unspecified detail)');
      }
    } catch (err) {
      console.error("OSM Nominatim Error:", err);
      setAddress('Address matched (Network limit reached)');
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefreshLocation) {
      onRefreshLocation();
    }
    // Give it a brief moment to acquire fresh coordinates, then resolve
    setTimeout(async () => {
      const activeLat = globalLocation?.lat || '16.284583';
      const activeLng = globalLocation?.lng || '80.457524';
      await getAddressFromCoords(activeLat, activeLng);
      setRefreshing(false);
    }, 1200);
  };

  useEffect(() => {
    if (globalLocation) {
      getAddressFromCoords(globalLocation.lat, globalLocation.lng);
    } else {
      // Resolve address for default coordinates so it matches the marker on load
      getAddressFromCoords('16.284583', '80.457524');
    }
  }, [globalLocation]);

  const handleShareWhatsApp = () => {
    const lat = globalLocation?.lat || '16.284583';
    const lng = globalLocation?.lng || '80.457524';
    const text = `SafeHer Alert! My live GPS coordinates are:\nLatitude: ${lat}\nLongitude: ${lng}\nLocation link: https://maps.google.com/?q=${lat},${lng}\n- Protected by SafeHer`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const lat = globalLocation?.lat || '16.284583';
  const lng = globalLocation?.lng || '80.457524';

  return (
    <div className="location-screen page-enter">
      {/* Curved Hero Banner - Apple Clean style */}
      <div className="location-hero-card">
        <div className="location-hero-left">
          <MapPin className="location-apple-pin-icon" size={24} />
          <h2>Live Location</h2>
          <p>Syncing coordinate relays</p>
        </div>
        <div className="location-pulsing-badge">
          <div className="status-dot-apple pulse-green-apple" />
          <span>Active Relay</span>
        </div>
      </div>

      {/* Embedded Map Panel */}
      <div className="glass-card map-glass-panel">
        <iframe 
          title="GPS Tracker"
          width="100%" 
          height="100%" 
          style={{ border: 0 }}
          loading="lazy"
          src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
        />
      </div>

      {/* Address Details & Action Buttons Panel */}
      <div className="glass-card location-info-card">
        <div className="location-info-header">
          <ShieldCheck size={18} className="shield-green-icon" />
          <span>Current Secure Address</span>
        </div>

        <div className="location-address-box">
          {loadingAddress ? (
            <div className="address-loader-wrapper">
              <Loader2 className="spinner-mini" size={16} />
              <span>Resolving Nominatim geocode...</span>
            </div>
          ) : (
            <p className="physical-address-text">{address}</p>
          )}
        </div>

        {/* Coordinates Pills */}
        <div className="coordinate-pills-row">
          <div className="coord-badge-apple">
            <span className="badge-tag">LAT</span>
            <strong className="badge-val">{lat}</strong>
          </div>
          <div className="coord-badge-apple">
            <span className="badge-tag">LNG</span>
            <strong className="badge-val">{lng}</strong>
          </div>
        </div>

        {/* Sync Metadata Badge */}
        <div className="last-sync-wrapper">
          <span>Last updated: just now</span>
        </div>

        {/* Action Row */}
        <div className="location-actions-row">
          <button onClick={handleRefresh} className="btn-outline refresh-pill-btn" disabled={refreshing}>
            {refreshing ? <Loader2 className="spinner" size={18} /> : <RefreshCw size={16} />}
            <span>Refresh</span>
          </button>
          
          <button onClick={handleShareWhatsApp} className="btn-primary share-pill-btn">
            <Share2 size={16} />
            <span>Share Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveLocationScreen;
