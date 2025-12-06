import { useState, useRef, useEffect } from 'react';

export default function LiveNoteTaker() {
  const [isActive, setIsActive] = useState(false);
  const [liveNotes, setLiveNotes] = useState([]);
  const [status, setStatus] = useState('Ready');
  const [finalNotes, setFinalNotes] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('split');
  const [showOverlay, setShowOverlay] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [captureMode, setCaptureMode] = useState('screen'); // 'screen', 'audio', 'image'

  const mediaRecorder = useRef(null);
  const screenStream = useRef(null);
  const captureInterval = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const popoutWindow = useRef(null);
  
  const transcriptRef = useRef('');
  const visualNotesRef = useRef('');

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const startCapture = async () => {
    if (captureMode === 'screen') {
      await startScreenCapture();
    } else if (captureMode === 'audio') {
      await startAudioOnly();
    }
  };

  const startScreenCapture = async () => {
    try {
      setStatus('Starting...');
      resetSession();

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

      captureInterval.current = setInterval(captureFrame, 4000);
      setTimeout(captureFrame, 500);

      setIsActive(true);
      screenStream.current.getVideoTracks()[0].onended = stopCapture;
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  const startAudioOnly = async () => {
    try {
      setStatus('Starting mic...');
      resetSession();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setupAudioRecording(stream);
      screenStream.current = stream;
      
      setIsActive(true);
      setStatus('🔴 Recording audio...');
    } catch (error) {
      setStatus('Mic error: ' + error.message);
    }
  };

  const resetSession = () => {
    setLiveNotes([]);
    setFinalNotes(null);
    transcriptRef.current = '';
    visualNotesRef.current = '';
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

    await processImage(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
  };

  const processImage = async (imageData) => {
    try {
      const res = await fetch('/api/live/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, context: visualNotesRef.current.slice(-500) })
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

  // Mobile: Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('Processing image...');
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(',')[1];
      await processImage(base64);
      setStatus('✅ Image processed');
    };
    reader.readAsDataURL(file);
  };

  const addNote = (icon, text, type = 'small') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newNote = { time, icon, text, type, id: Date.now() + Math.random() };
    setLiveNotes(prev => [...prev, newNote]);
    
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

  const openPopout = () => {
    const w = window.open('', 'Notes', 'width=350,height=500,right=20,top=20');
    if (w) {
      popoutWindow.current = w;
      w.document.write(getPopoutHTML());
      w.document.close();
      liveNotes.forEach(note => w.postMessage({ type: 'NEW_NOTE', note }, '*'));
    }
  };

  const getPopoutHTML = () => `<!DOCTYPE html><html><head><title>📝 Notes</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#0a0a0f;color:#e4e4e7;padding:.75rem}
h1{font-size:.9rem;margin-bottom:.75rem;color:#6366f1}.notes{display:flex;flex-direction:column;gap:.4rem}
.note{padding:.4rem;border-radius:5px;font-size:.75rem}.note.small{background:rgba(255,255,255,.03);border-left:2px solid #6366f1}
.note.big{background:rgba(139,92,246,.15);border-left:3px solid #8b5cf6}.time{font-size:.6rem;color:#6366f1}
.text{margin-top:.2rem;line-height:1.3;color:#a1a1aa}.big .text{color:#fff}</style></head>
<body><h1>📝 Live Notes</h1><div class="notes" id="n"></div>
<script>window.onmessage=e=>{if(e.data.type==='NEW_NOTE'){const n=e.data.note,d=document.createElement('div');
d.className='note '+n.type;d.innerHTML='<div class="time">'+n.icon+' '+n.time+'</div><div class="text">'+n.text+'</div>';
document.getElementById('n').appendChild(d);d.scrollIntoView({behavior:'smooth'})}}</script></body></html>`;
