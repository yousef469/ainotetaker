# 🧠 AI Note Taker

Real-time AI-powered note-taking from video lectures using Google Gemini Flash.

## Features

- 🎬 **Live Screen Capture** - Share your screen and watch notes appear in real-time
- 🎤 **Audio Transcription** - Captures system audio from videos (not mic)
- 📝 **Smart Notes** - Small quick facts + Big important concepts
- 🔗 **Pop-out Panel** - Open notes in separate window beside your video
- 📺 **Overlay Mode** - Notes in corner when video is fullscreen
- 💾 **Save & Review** - Save notes for later study
- 🃏 **Auto Flashcards** - AI generates flashcards and practice questions

## Quick Start (Local)

1. Get Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

2. Setup:
```bash
cp .env.example .env
# Add your GEMINI_API_KEY to .env

npm install
cd client && npm install
```

3. Run:
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend  
cd client && npm run dev
```

4. Open http://localhost:5173

## Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add Environment Variable: `GEMINI_API_KEY`
4. Deploy!

## Usage Tips

- **Share tab audio**: When selecting screen, check "Share tab audio" for video sound
- **Pop-out notes**: Click 🔗 to open notes in separate draggable window
- **View modes**: Split (⬜⬜), Video only (🖥️), Notes only (📝)

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express (local) / Vercel Functions (deployed)
- AI: Google Gemini 2.0 Flash
