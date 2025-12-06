import { useState, useRef } from 'react';

export default function AudioRecorder({ onNotesGenerated, setLoading, setError }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(blob);
      };

      mediaRecorder.current.start();
      setRecording(true);
    } catch (err) {
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  const processAudio = async (blob) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    try {
      const res = await fetch('/api/notes/audio', {
        method: 'POST',
        body: formData
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
    <div style={{ textAlign: 'center' }}>
      <h2>Record Audio</h2>
      <p>Click to start/stop recording your lecture or notes</p>
      <button
        className={`record-btn ${recording ? 'recording' : ''}`}
        onClick={recording ? stopRecording : startRecording}
      >
        {recording ? '⏹ Stop' : '🎤 Record'}
      </button>
      {recording && <p>Recording in progress...</p>}
    </div>
  );
}
