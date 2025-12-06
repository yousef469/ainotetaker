export default function NotesDisplay({ notes }) {
  if (!notes || notes.raw) {
    return (
      <div className="notes-display">
        <div className="notes-section">
          <h3>📝 Raw Output</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{notes?.raw || JSON.stringify(notes, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-display">
      {notes.topic && (
        <div className="notes-section">
          <h3>📚 Topic</h3>
          <p>{notes.topic}</p>
        </div>
      )}

      {notes.summary && (
        <div className="notes-section">
          <h3>📋 Summary</h3>
          <p>{notes.summary}</p>
        </div>
      )}

      {notes.bullet_points?.length > 0 && (
        <div className="notes-section">
          <h3>• Key Points</h3>
          <ul>
            {notes.bullet_points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {notes.key_terms?.length > 0 && (
        <div className="notes-section">
          <h3>🔑 Key Terms</h3>
          <ul>
            {notes.key_terms.map((item, i) => (
              <li key={i}>
                <strong>{item.term}</strong>: {item.definition}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.flashcards?.length > 0 && (
        <div className="notes-section">
          <h3>🃏 Flashcards</h3>
          {notes.flashcards.map((card, i) => (
            <div key={i} className="flashcard">
              <div className="question">Q: {card.q}</div>
              <div className="answer">A: {card.a}</div>
            </div>
          ))}
        </div>
      )}

      {notes.questions?.length > 0 && (
        <div className="notes-section">
          <h3>❓ Practice Questions</h3>
          <ul>
            {notes.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {notes.mindmap && Object.keys(notes.mindmap).length > 0 && (
        <div className="notes-section">
          <h3>🗺️ Mindmap</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
            {JSON.stringify(notes.mindmap, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
