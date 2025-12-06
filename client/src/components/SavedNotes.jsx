import { useState, useEffect } from 'react';

export default function SavedNotes({ onView }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes/saved');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewNote = async (filename) => {
    try {
      const res = await fetch(`/api/notes/saved/${filename}`);
      const data = await res.json();
      onView(data);
    } catch (err) {
      console.error('Error loading note:', err);
    }
  };

  if (loading) return <p>Loading saved notes...</p>;

  if (notes.length === 0) {
    return (
      <div className="empty-state">
        <p>📭 No saved notes yet</p>
        <p>Start a live capture to create your first notes!</p>
      </div>
    );
  }

  return (
    <div className="saved-notes">
      <h2>📚 Your Saved Notes</h2>
      <div className="notes-grid">
        {notes.map((note) => (
          <div key={note.filename} className="note-card" onClick={() => viewNote(note.filename)}>
            <h3>{note.title}</h3>
            <p className="date">{new Date(note.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
