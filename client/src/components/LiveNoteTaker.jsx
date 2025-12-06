import { useState, useRef, useEffect } from 'react';

export default function LiveNoteTaker() {
  const [isActive, setIsActive] = useState(false);
  const [liveNotes, setLiveNotes] = useState([]);
  const [status, setStatus] = useState('Ready');
  const [finalNotes, setFinalNotes] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'video', 'notes'
  const [showOverlay, setShowOverlay] = useState(true);

  const mediaRecorder = useRef(null);
  const screenStream = useRef(null);
  const captureInterval = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const popoutWindow = useRef(null);
  
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
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream.current;
      }

      const audioTracks = screenStream.current.getAudioTracks();
      
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream(audioTracks);
        setupAudioRecording(audioStream);
        setStatus('🔴 Recording');
      } else {
        setStatus('🔴 Recording (no audio)');
      }

      captureInterval.current = setInterval(captureFrame, 4000);
      setTimeout(captureFrame, 500);

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
            if (data.notes?.length > 0) {
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

    mediaRecorder.current.start(4000);
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
        body: JSON.stringify({ 
          imageData, 
          context: visualNotesRef.current.slice(-500) 
        })
      });
      const data = await res.json();
      if (data.notes?.length > 0) {
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
    const newNote = { time, icon, text, type, id: Date.now() + Math.random() };
    setLiveNotes(prev => [...prev, newNote]);
    
    // Update popout window if open
    if (popoutWindow.current && !popoutWindow.current.closed) {
      popoutWindow.current.postMessage({ type: 'NEW_NOTE', note: newNote }, '*');
    }
  };

  const stopCapture = async () => {
    setStatus('Stopping...');
    setGenerating(true);

    if (captureInterval.current) clearInterval(captureInterval.current);
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    if (screenStream.current) screenStream.current.getTracks().forEach(t => t.stop());

    setIsActive(false);
    setStatus('Generating...');

    try {
      const res = await fetch('/api/live/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: transcriptRef.current, 
          visualNotes: visualNotesRef.current 
        })
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
          title: finalNotes.title || 'Lecture Notes ' + new Date().toLocaleDateString(),
          notes: finalNotes,
          transcript: transcriptRef.current,
          visualNotes: visualNotesRef.current
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus('✅ Saved: ' + data.filename);
      } else {
        setStatus('❌ Save failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setStatus('❌ Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Open notes in new window/tab
  const openPopout = () => {
    const width = 400;
    const height = 600;
    const left = window.screen.width - width - 20;
    const top = 20;
    
    popoutWindow.current = window.open(
      '',
      'NotesPopout',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes`
    );
    
    if (popoutWindow.current) {
      popoutWindow.current.document.write(getPopoutHTML());
      popoutWindow.current.document.close();
      
      // Send existing notes
      liveNotes.forEach(note => {
        popoutWindow.current.postMessage({ type: 'NEW_NOTE', note }, '*');
      });
    }
  };

  const getPopoutHTML = () => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>📝 Live Notes</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, sans-serif; 
          background: #0a0a0f; 
          color: #e4e4e7; 
          padding: 1rem;
        }
        h1 { font-size: 1rem; margin-bottom: 1rem; color: #6366f1; }
        .notes { display: flex; flex-direction: column; gap: 0.5rem; }
        .note { padding: 0.5rem; border-radius: 6px; font-size: 0.8rem; }
        .note.small { background: rgba(255,255,255,0.03); border-left: 2px solid #6366f1; }
        .note.big { background: rgba(139,92,246,0.15); border-left: 3px solid #8b5cf6; }
        .note .time { font-size: 0.65rem; color: #6366f1; }
        .note .text { margin-top: 0.25rem; line-height: 1.4; color: #a1a1aa; }
        .note.big .text { color: #fff; }
      </style>
    </head>
    <body>
      <h1>📝 Live Notes</h1>
      <div class="notes" id="notes"></div>
      <script>
        window.addEventListener('message', (e) => {
          if (e.data.type === 'NEW_NOTE') {
            const note = e.data.note;
            const div = document.createElement('div');
            div.className = 'note ' + note.type;
            div.innerHTML = '<div class="time">' + note.icon + ' ' + note.time + '</div><div class="text">' + note.text + '</div>';
            document.getElementById('notes').appendChild(div);
            div.scrollIntoView({ behavior: 'smooth' });
          }
        });
      </script>
    </body>
    </html>
  `;


  return (
    <div className="live-taker">
      {/* Control Bar */}
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
          <button className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')} title="Split">⬜⬜</button>
          <button className={viewMode === 'video' ? 'active' : ''} onClick={() => { setViewMode('video'); setShowOverlay(true); }} title="Video + Overlay">🖥️</button>
          <button className={viewMode === 'notes' ? 'active' : ''} onClick={() => setViewMode('notes')} title="Notes only">📝</button>
          <button onClick={openPopout} title="Pop out notes">🔗</button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`main-area ${viewMode}`}>
        {/* Video */}
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
            
            {/* Overlay notes when video is full */}
            {viewMode === 'video' && showOverlay && liveNotes.length > 0 && (
              <div className="notes-overlay">
                <div className="overlay-header">
                  <span>📝 {liveNotes.length}</span>
                  <button onClick={() => setShowOverlay(false)}>✕</button>
                </div>
                <div className="overlay-notes">
                  {liveNotes.slice(-6).map((note, i) => (
                    <div key={note.id} className={`overlay-note ${note.type}`}>
                      <span className="icon">{note.icon}</span>
                      <span className="text">{note.text.slice(0, note.type === 'big' ? 200 : 80)}{note.text.length > (note.type === 'big' ? 200 : 80) ? '...' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {viewMode === 'video' && !showOverlay && (
              <button className="show-overlay-btn" onClick={() => setShowOverlay(true)}>📝 Show Notes</button>
            )}
          </div>
        )}

        {/* Notes Panel */}
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

      {/* Final Notes */}
      {(finalNotes || generating) && (
        <div className="final-section">
          <div className="final-header">
            <h3>📋 Generated Notes</h3>
            {finalNotes && (
              <button className="btn-save" onClick={saveNotes} disabled={saving}>
                {saving ? '⏳ Saving...' : '💾 Save Notes'}
              </button>
            )}
          </div>
          
          {generating ? (
            <div className="generating">
              <div className="spinner"></div>
              <p>AI is generating your notes...</p>
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

              {finalNotes.bullet_points?.length > 0 && (
                <div className="final-block">
                  <h4>• Key Points</h4>
                  <ul>{finalNotes.bullet_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}

              {finalNotes.examples?.length > 0 && (
                <div className="final-block">
                  <h4>💡 Examples</h4>
                  <ul className="examples-list">{finalNotes.examples.map((ex, i) => <li key={i}>{ex}</li>)}</ul>
                </div>
              )}

              {finalNotes.key_terms?.length > 0 && (
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

              {finalNotes.flashcards?.length > 0 && (
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

              {finalNotes.questions?.length > 0 && (
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
