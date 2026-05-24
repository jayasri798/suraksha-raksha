import { NavLink } from 'react-router-dom';
import { Home, Users, MapPin, Settings } from 'lucide-react';
import './BottomNavigation.css';

const BottomNavigation = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        <div className="nav-tab-pill">
          <Home className="nav-icon" />
          <span className="nav-label">Home</span>
        </div>
      </NavLink>
      
      <NavLink to="/contacts" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        <div className="nav-tab-pill">
          <Users className="nav-icon" />
          <span className="nav-label">Contacts</span>
        </div>
      </NavLink>
      
      <NavLink to="/location" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        <div className="nav-tab-pill">
          <MapPin className="nav-icon" />
          <span className="nav-label">Location</span>
        </div>
      </NavLink>

      <NavLink to="/settings" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        <div className="nav-tab-pill">
          <Settings className="nav-icon" />
          <span className="nav-label">Settings</span>
        </div>
      </NavLink>
    </nav>
  );
};

export default BottomNavigation;
