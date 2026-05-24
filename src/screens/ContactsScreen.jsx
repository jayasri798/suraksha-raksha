import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Users, Phone, Trash2, Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import './ContactsScreen.css';

const ContactsScreen = ({ user }) => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState('');

  const fetchContacts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users", user.uid, "contacts"));
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContacts(list);
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user.uid]);

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!name || !phone) {
      setError('Please fill in all fields');
      return;
    }
    if (contacts.length >= 5) {
      setError('You can add up to 5 guardians only');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, "users", user.uid, "contacts"), {
        name,
        phone,
        createdAt: new Date()
      });
      setName('');
      setPhone('');
      fetchContacts();
    } catch (err) {
      console.error(err);
      setError('Failed to add contact. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "contacts", id));
      fetchContacts();
    } catch (err) {
      console.error("Error deleting contact:", err);
    }
  };

  if (loading) {
    return (
      <div className="contacts-screen-loading">
        <Loader2 className="spinner-large" size={40} />
      </div>
    );
  }

  return (
    <div className="contacts-screen page-enter">
      {/* Curved Hero Banner - Apple Clean style */}
      <div className="contacts-hero-card">
        <div className="contacts-hero-left">
          <ShieldCheck className="contacts-apple-shield-icon" size={24} />
          <h2>Emergency Network</h2>
          <p>Trusted guardians who protect you</p>
        </div>
        <div className="contacts-capacity-badge">
          {contacts.length} OF 5 CONFIGURED
        </div>
      </div>

      {/* Grid columns handle responsive web automatically */}
      <div className="glass-card contacts-input-card">
        <div className="form-title-row">
          <UserPlus size={16} className="icon-apple-form" />
          <span>Add Guardian Guardian</span>
        </div>

        <form onSubmit={handleAddContact} className="contacts-form">
          <div className={`input-group-premium ${focusedField === 'name' ? 'focused' : ''}`}>
            <label className="floating-label">Name</label>
            <div className="input-wrapper-inner">
              <Users size={18} className="input-icon" />
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField('')}
                placeholder="Guardian Name" 
                className="input-field-premium"
                required
              />
            </div>
          </div>

          <div className={`input-group-premium ${focusedField === 'phone' ? 'focused' : ''}`}>
            <label className="floating-label">Phone Number</label>
            <div className="input-wrapper-inner">
              <Phone size={18} className="input-icon" />
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField('')}
                placeholder="+91 XXXXX XXXXX" 
                className="input-field-premium"
                required
              />
            </div>
          </div>

          {error && <p className="contacts-form-error">{error}</p>}

          <button type="submit" className="btn-primary contacts-submit-pill" disabled={submitting}>
            {submitting ? <Loader2 className="spinner" size={20} /> : 'Save Guardian'}
          </button>
        </form>
      </div>

      <div className="contacts-list-wrapper">
        <h3 className="section-title-apple">Configured Guardians</h3>
        
        <div className="contacts-list-container">
          {contacts.map((contact) => {
            const initial = contact.name ? contact.name.charAt(0).toUpperCase() : 'G';
            return (
              <div key={contact.id} className="glass-card contact-item-card-premium">
                <div className="contact-avatar-badge">
                  <span>{initial}</span>
                </div>
                <div className="contact-details-premium">
                  <strong>{contact.name}</strong>
                  <span>{contact.phone}</span>
                </div>
                <div className="contact-actions-premium">
                  <a href={`tel:${contact.phone}`} className="contact-action-btn dial-btn-apple">
                    <Phone size={16} />
                  </a>
                  <button onClick={() => handleDeleteContact(contact.id)} className="contact-action-btn delete-btn-apple">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {contacts.length === 0 && (
            <div className="glass-card contact-item-card-premium empty-list-apple">
              <span>No guardians configured yet. Add trusted contacts above to secure your emergency dispatch circle.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactsScreen;
