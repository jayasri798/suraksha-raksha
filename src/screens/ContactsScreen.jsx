import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Phone, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import './ContactsScreen.css';

const ContactsScreen = ({ user }) => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchContacts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users", user.uid, "contacts"));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContacts(data);
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
  }, [user.uid]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return setError('Fill all fields');
    if (contacts.length >= 5) return setError('Max 5 contacts allowed');
    
    setAdding(true);
    try {
      const docRef = await addDoc(collection(db, "users", user.uid, "contacts"), {
        name: name.trim(),
        phone: phone.trim(),
        createdAt: serverTimestamp()
      });
      
      setContacts([...contacts, { id: docRef.id, name: name.trim(), phone: phone.trim() }]);
      setName('');
      setPhone('');
      setError('');
    } catch (err) {
      console.error("Error adding contact:", err);
      setError('Failed to add contact');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "contacts", id));
      setContacts(contacts.filter(c => c.id !== id));
    } catch (err) {
      console.error("Error deleting contact:", err);
    }
  };

  if (loading) {
    return (
      <div className="contacts-loading">
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  return (
    <div className="contacts-screen">
      <div className="screen-header">
        <h1 className="title-large">Emergency Contacts</h1>
        <p className="subtitle-muted">Added {contacts.length}/5 contacts</p>
      </div>

      <div className="add-contact-section">
        <div className="card add-card">
          <form onSubmit={handleAdd}>
            <div className="input-group">
              <label className="input-label">Contact Name</label>
              <input type="text" className="input-field" placeholder="e.g. Jane Doe" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Phone Number</label>
              <input type="tel" className="input-field" placeholder="e.g. +1 234 567 890" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? <Loader2 className="spinner" size={18} /> : <><UserPlus size={18} /> Add Contact</>}
            </button>
          </form>
        </div>
      </div>

      <div className="contacts-list-section">
        <h3 className="section-title">Saved Contacts</h3>
        <div className="contacts-list">
          {contacts.map(c => (
            <div key={c.id} className="card contact-row-card">
              <div className="contact-avatar">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="contact-info">
                <strong>{c.name}</strong>
                <span>{c.phone}</span>
              </div>
              <div className="contact-actions">
                <a href={`tel:${c.phone}`} className="call-btn-circle">
                  <Phone size={16} />
                </a>
                <button onClick={() => handleDelete(c.id)} className="delete-btn-circle">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {contacts.length === 0 && <p className="empty-msg">No contacts added yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default ContactsScreen;
