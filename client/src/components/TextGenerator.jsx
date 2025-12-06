import { useState } from 'react';

export default function TextGenerator({ onNotesGenerated, setLoading, setError }) {
  const [text, setText] = useState('');

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onNotesGenerated(data.notes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Generate from Text</h2>
      <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
        Paste your notes or lecture content to generate flashcards and summaries
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your notes, lecture transcript, or any text content here..."
      />
      <button
        className="generate-btn"
        onClick={handleGenerate}
        disabled={!text.trim()}
      >
        ✨ Generate Notes & Flashcards
      </button>
    </div>
  );
}
