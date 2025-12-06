import { useState, useRef } from 'react';

export default function LiveNoteTaker() {
  const [isActive, setIsActive] = useState(false);
  const [liveNotes, setLiveNotes] = useState([]);
  const [status, setStatus] = useState('Ready');
  const [finalNotes, setFinalNotes] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('split');
  const [showOverlay, setShowOverlay] = useState(true);

  const mediaRecorder = useRef(null);
  const screenStream = useRef(null);
  const captureInterval = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const transcriptRef = useRef('');
  const visualNotesRef = useRef('');

  const startCapture = async () => {
    try {
      setStatus('Starting...');
      setLiveNotes([]);
      setFinalNotes(null);
      transcriptRef.current = '';
      visualNotesRef.current = '';

      screenStream.current = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: { echoCancellation: false, noiseSuppression: false }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream.current;
      }

      const audioTracks = screenStream.current.getAudioTracks();
      if (audioTracks.length > 0) {
        setupAudioRecording(new MediaStream(audioTracks));
        setStatus('🔴 Recording');
      } else {
        setStatus('🔴 Recording (no audio)');
      }

      // Capture every 10 seconds to avoid rate limits
      captureInterval.current = setInterval(captureFrame, 10000);
      setTimeout(captureFrame, 2000);

      setIsActive(true);
      screenStream.current.getVideoTracks()[0].onended = stopCapture;
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  const setupAudioRecording = (stream) => {
    mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.current.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const blob = new Blob([e.data], { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          try {
            const res = await fetch('/api/live/audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64, mimeType: 'audio/webm' })
            });
            const data = await res.json();
            if (data.notes && data.notes.length > 0) {
              data.notes.forEach(note => {
                transcriptRef.current += ' ' + note.text;
                addNote('🎤', note.text, note.type);
              });
            }
          } catch (err) {
            console.error('Audio error:', err);
          }
        };
        reader.readAsDataURL(blob);
      }
    };

    // Audio chunks every 10 seconds to avoid rate limits
    mediaRecorder.current.start(10000);
  };

  const captureFrame = async () => {
    if (!screenStream.current || !canvasRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    try {
      const res = await fetch('/api/live/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, context: visualNotesRef.current.slice(-500) })
      });
      const data = await res.json();
      if (data.notes && data.notes.length > 0) {
        data.notes.forEach(note => {
          visualNotesRef.current += '\n' + note.text;
          addNote('📷', note.text, note.type);
        });
      }
    } catch (err) {
      console.error('Frame error:', err);
    }
  };

  const addNote = (icon, text, type = 'small') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLiveNotes(prev => [...prev, { time, icon, text, type, id: Date.now() }]);
  };

  const stopCapture = async () => {
    setStatus('Stopping...');
    setGenerating(true);

    if (captureInterval.current) clearInterval(captureInterval.current);
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') mediaRecorder.current.stop();
    if (screenStream.current) screenStream.current.getTracks().forEach(t => t.stop());

    setIsActive(false);
    setStatus('Generating...');

    try {
      const res = await fetch('/api/live/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptRef.current, visualNotes: visualNotesRef.current })
      });
      const data = await res.json();
      setFinalNotes(data.notes);
      setStatus('✅ Done!');
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveNotes = async () => {
    if (!finalNotes) return;
    setSaving(true);
    setStatus('Saving...');

    try {
      const res = await fetch('/api/notes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalNotes.title || 'Lecture Notes',
          notes: finalNotes,
          transcript: transcriptRef.current,
          visualNotes: visualNotesRef.current
        })
      });
      const data = await res.json();
      setStatus(data.success ? '✅ Saved!' : '❌ Failed');
    } catch (err) {
      setStatus('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="live-taker">
      <div className="control-bar">
        <div className="control-left">
          {!isActive ? (
            <button className="btn-start" onClick={startCapture}>▶ Start</button>
          ) : (
            <button className="btn-stop" onClick={stopCapture}>⏹ Stop</button>
          )}
          <span className="status-text">{status}</span>
        </div>
        
        <div className="view-modes">
          <button className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')}>⬜⬜</button>
          <button className={viewMode === 'video' ? 'active' : ''} onClick={() => { setViewMode('video'); setShowOverlay(true); }}>🖥️</button>
          <button className={viewMode === 'notes' ? 'active' : ''} onClick={() => setViewMode('notes')}>📝</button>
        </div>
      </div>

      <div className={`main-area ${viewMode}`}>
        {(viewMode === 'split' || viewMode === 'video') && (
          <div className={`video-section ${viewMode === 'video' ? 'full' : ''}`}>
            <div className="video-container">
              <video ref={videoRef} autoPlay muted playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {!isActive && (
                <div className="video-placeholder">
                  <span>📺</span>
                  <p>Click Start to share screen</p>
                  <small>💡 Check "Share tab audio" for video sound</small>
                </div>
              )}
            </div>
            
            {viewMode === 'video' && showOverlay && liveNotes.length > 0 && (
              <div className="notes-overlay">
                <div className="overlay-header">
                  <span>📝 {liveNotes.length}</span>
                  <button onClick={() => setShowOverlay(false)}>✕</button>
                </div>
                <div className="overlay-notes">
                  {liveNotes.slice(-6).map((note) => (
                    <div key={note.id} className={`overlay-note ${note.type}`}>
                      <span className="icon">{note.icon}</span>
                      <span className="text">{note.text.slice(0, 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {viewMode === 'video' && !showOverlay && (
              <button className="show-overlay-btn" onClick={() => setShowOverlay(true)}>📝</button>
            )}
          </div>
        )}

        {(viewMode === 'split' || viewMode === 'notes') && (
          <div className={`notes-section ${viewMode === 'notes' ? 'full' : ''}`}>
            <div className="notes-header">
              <h3>📝 Live Notes</h3>
              <span className="note-count">{liveNotes.length}</span>
            </div>
            <div className="notes-list">
              {liveNotes.length === 0 ? (
                <p className="empty-msg">Notes appear here...</p>
              ) : (
                liveNotes.map((note) => (
                  <div key={note.id} className={`note-item ${note.type}`}>
                    <span className="note-icon">{note.icon}</span>
                    <div className="note-content">
                      <span className="note-time">{note.time}</span>
                      <p className="note-text">{note.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {(finalNotes || generating) && (
        <div className="final-section">
          <div className="final-header">
            <h3>📋 Generated Notes</h3>
            {finalNotes && (
              <button className="btn-save" onClick={saveNotes} disabled={saving}>
                {saving ? '⏳...' : '💾 Save'}
              </button>
            )}
          </div>
          
          {generating ? (
            <div className="generating">
              <div className="spinner"></div>
              <p>Generating notes...</p>
            </div>
          ) : finalNotes && (
            <div className="final-content">
              {finalNotes.title && <h2 className="final-title">{finalNotes.title}</h2>}
              
              {finalNotes.summary && (
                <div className="final-block">
                  <h4>📋 Summary</h4>
                  <p>{finalNotes.summary}</p>
                </div>
              )}

              {finalNotes.bullet_points && finalNotes.bullet_points.length > 0 && (
                <div className="final-block">
                  <h4>• Key Points</h4>
                  <ul>{finalNotes.bullet_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}

              {finalNotes.key_terms && finalNotes.key_terms.length > 0 && (
                <div className="final-block">
                  <h4>🔑 Key Terms</h4>
                  <div className="terms-grid">
                    {finalNotes.key_terms.map((t, i) => (
                      <div key={i} className="term-card">
                        <span className="term-name">{t.term}</span>
                        <span className="term-def">{t.definition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {finalNotes.flashcards && finalNotes.flashcards.length > 0 && (
                <div className="final-block">
                  <h4>🃏 Flashcards</h4>
                  <div className="flashcards-grid">
                    {finalNotes.flashcards.map((f, i) => (
                      <div key={i} className="flashcard">
                        <div className="fc-q">Q: {f.q}</div>
                        <div className="fc-a">A: {f.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {finalNotes.questions && finalNotes.questions.length > 0 && (
                <div className="final-block">
                  <h4>❓ Practice Questions</h4>
                  <ol className="questions-list">{finalNotes.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
