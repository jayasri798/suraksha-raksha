import { useState, useEffect } from 'react';
import { MapPin, RefreshCw, MessageCircle } from 'lucide-react';
import './LiveLocationScreen.css';

const LiveLocationScreen = () => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) return setLoading(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setLoading(false);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          setAddress(data.display_name || 'Address not found');
        } catch (error) {
          console.error(error);
          setAddress('Failed to fetch address');
        }
      },
      () => setLoading(false),
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareLocation = () => {
    if (!location) return;
    const msg = `My live location: https://maps.google.com/?q=${location.lat},${location.lng}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="location-screen">
      <div className="screen-header">
        <h1 className="title-large">My Location</h1>
        <p className="subtitle-muted">Live GPS Tracking</p>
      </div>

      <div className="map-wrapper card">
        {location ? (
          <iframe
            title="Map"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
          ></iframe>
        ) : (
          <div className="map-placeholder">
            {loading ? <RefreshCw className="spin" /> : <p>Waiting for GPS...</p>}
          </div>
        )}
      </div>

      <div className="card location-info-card">
        <div className="address-row">
          <MapPin size={20} className="icon-purple" />
          <p className="address-text">{loading ? 'Locating...' : address || '---'}</p>
        </div>
        <div className="coords-row">
          <div className="coord-item">
            <span className="coord-label">Latitude</span>
            <span className="coord-value">{location ? location.lat.toFixed(6) : '---'}</span>
          </div>
          <div className="coord-item">
            <span className="coord-label">Longitude</span>
            <span className="coord-value">{location ? location.lng.toFixed(6) : '---'}</span>
          </div>
        </div>
        <p className="updated-text">Updated just now</p>
      </div>

      <div className="location-actions">
        <button className="btn-outline" onClick={fetchLocation} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh Location
        </button>
        <button className="btn-whatsapp" onClick={shareLocation}>
          <MessageCircle size={18} /> Share on WhatsApp
        </button>
      </div>
    </div>
  );
};

export default LiveLocationScreen;
