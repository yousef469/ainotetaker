import { useState } from 'react';
import LiveNoteTaker from './components/LiveNoteTaker';
import SavedNotes from './components/SavedNotes';
import NotesDisplay from './components/NotesDisplay';

export default function App() {
  const [view, setView] = useState('live'); // 'live' | 'saved' | 'view'
  const [viewingNote, setViewingNote] = useState(null);

  return (
    <div className="app">
      <header>
        <h1>🧠 AI Note Taker</h1>
        <p>Real-time notes from video, audio & screen</p>
      </header>

      <div className="tabs">
        <button
          className={`tab-btn ${view === 'live' ? 'active' : ''}`}
          onClick={() => setView('live')}
        >
          🎬 Live Capture
        </button>
        <button
          className={`tab-btn ${view === 'saved' ? 'active' : ''}`}
          onClick={() => setView('saved')}
        >
          📚 Saved Notes
        </button>
      </div>

      <div className="panel">
        {view === 'live' && <LiveNoteTaker />}
        {view === 'saved' && (
          <SavedNotes onView={(note) => { setViewingNote(note); setView('view'); }} />
        )}
        {view === 'view' && viewingNote && (
          <div>
            <button className="back-btn" onClick={() => setView('saved')}>← Back</button>
            <h2>{viewingNote.title}</h2>
            <NotesDisplay notes={viewingNote.notes} />
          </div>
        )}
      </div>
    </div>
  );
}
