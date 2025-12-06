import { useRef } from 'react';

export default function ImageUploader({ onNotesGenerated, setLoading, setError }) {
  const fileInput = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/notes/image', {
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
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Upload Image</h2>
      <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
        Upload handwritten notes, whiteboards, slides, or textbook pages
      </p>
      <div className="upload-zone" onClick={() => fileInput.current.click()}>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleUpload}
        />
        <p>📷 Click or drag to upload an image</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
          Supports JPG, PNG, WebP
        </p>
      </div>
    </div>
  );
}
