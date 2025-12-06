# 🧠 AI Note Taker

AI-powered note-taking app using Google Gemini Flash for audio transcription, image OCR, and smart note generation.

## Features

- 🎤 **Audio Recording** → Transcribe lectures and generate structured notes
- 📷 **Image Upload** → Extract text from handwritten notes, whiteboards, slides
- 📝 **Text Input** → Generate flashcards and summaries from any text
- 🃏 **Auto Flashcards** → Q&A format for studying
- 🗺️ **Mindmaps** → Nested JSON structure for visualization

## Setup

### 1. Get Gemini API Key

Get your free API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Install Dependencies

```bash
npm install
cd client && npm install
```

### 4. Run the App

Terminal 1 (Backend):
```bash
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client && npm run dev
```

Open http://localhost:5173

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notes/audio` | POST | Upload audio file → get transcription + notes |
| `/api/notes/image` | POST | Upload image → OCR + structured notes |
| `/api/notes/screenshot` | POST | Upload screenshot → extract key points |
| `/api/notes/generate` | POST | Send text → generate flashcards & notes |

## Output Format

All endpoints return structured JSON:

```json
{
  "topic": "Physics - Newton's Laws",
  "summary": "...",
  "bullet_points": ["..."],
  "key_terms": [{"term": "...", "definition": "..."}],
  "flashcards": [{"q": "...", "a": "..."}],
  "questions": ["..."],
  "mindmap": {}
}
```
