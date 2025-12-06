import express from "express";
import multer from "multer";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const flash = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

// Store for saved notes
const NOTES_DIR = './saved_notes';
if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR);

const STRUCTURED_OUTPUT_PROMPT = `Return output strictly in this JSON format:
{
  "topic": "",
  "summary": "",
  "bullet_points": [],
  "key_terms": [{"term": "", "definition": ""}],
  "flashcards": [{"q": "", "a": ""}],
  "questions": [],
  "mindmap": {}
}`;

// Audio → Structured Notes
app.post("/api/notes/audio", upload.single("audio"), async (req, res) => {
  try {
    const audioBuffer = req.file.buffer;
    
    const transcribeResult = await flash.generateContent({
      contents: [{
        parts: [{
          inlineData: {
            data: audioBuffer.toString("base64"),
            mimeType: req.file.mimetype
          }
        }, {
          text: "Transcribe this audio accurately."
        }]
      }]
    });
    
    const transcript = transcribeResult.response.text();
    
    const notesResult = await flash.generateContent({
      contents: [{
        parts: [{
          text: `You are an expert note generator. Input: raw lecture transcript.
          
Transcript:
${transcript}

Generate organized notes with summary, bullet points, key terms, flashcards, practice questions, and mindmap.
${STRUCTURED_OUTPUT_PROMPT}`
        }]
      }],
      generationConfig: { temperature: 0.3 }
    });
    
    const notesText = notesResult.response.text();
    const notes = parseJSON(notesText);
    
    res.json({ transcript, notes });
  } catch (error) {
    console.error("Audio processing error:", error);
    res.status(500).json({ error: error.message });
  }
});


// Image → Handwritten Note Digitizer
app.post("/api/notes/image", upload.single("image"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    
    const result = await flash.generateContent({
      contents: [{
        parts: [{
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: req.file.mimetype
          }
        }, {
          text: `You are an OCR + academic note generator. Extract all text from the image.
Fix handwriting errors. Organize content professionally.
For equations, use LaTeX format.
${STRUCTURED_OUTPUT_PROMPT}`
        }]
      }],
      generationConfig: { temperature: 0.2 }
    });
    
    const notesText = result.response.text();
    const notes = parseJSON(notesText);
    
    res.json({ notes });
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Screenshot → Smart Notes
app.post("/api/notes/screenshot", upload.single("screenshot"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    
    const result = await flash.generateContent({
      contents: [{
        parts: [{
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: req.file.mimetype
          }
        }, {
          text: `Extract key points from this slide/screenshot.
Convert into summary, bullet points, formulas, and examples.
${STRUCTURED_OUTPUT_PROMPT}`
        }]
      }],
      generationConfig: { temperature: 0.2 }
    });
    
    const notesText = result.response.text();
    const notes = parseJSON(notesText);
    
    res.json({ notes });
  } catch (error) {
    console.error("Screenshot processing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Text → Generate Flashcards & Questions
app.post("/api/notes/generate", async (req, res) => {
  try {
    const { text } = req.body;
    
    const result = await flash.generateContent({
      contents: [{
        parts: [{
          text: `Based on the following notes, generate comprehensive study materials:

${text}

${STRUCTURED_OUTPUT_PROMPT}`
        }]
      }],
      generationConfig: { temperature: 0.3 }
    });
    
    const notesText = result.response.text();
    const notes = parseJSON(notesText);
    
    res.json({ notes });
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Parse JSON from Gemini response
function parseJSON(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { raw: text };
  } catch {
    return { raw: text };
  }
}

// Helper: Parse notes with [SMALL] and [BIG] tags
function parseNotes(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const notes = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[SMALL]')) {
      notes.push({ type: 'small', text: trimmed.replace('[SMALL]', '').trim() });
    } else if (trimmed.startsWith('[BIG]')) {
      notes.push({ type: 'big', text: trimmed.replace('[BIG]', '').trim() });
    } else if (trimmed.length > 5) {
      // Default to small if no tag
      notes.push({ type: 'small', text: trimmed });
    }
  }
  
  return notes;
}

// Live chunk processing - audio
app.post("/api/live/audio", async (req, res) => {
  try {
    const { audioData, mimeType } = req.body;
    
    if (!audioData) {
      return res.json({ notes: [] });
    }
    
    const result = await flash.generateContent({
      contents: [{
        parts: [{
          inlineData: { data: audioData, mimeType: mimeType || 'audio/webm' }
        }, {
          text: `Extract lecture content as a LIST of separate notes.

OUTPUT FORMAT - Return multiple notes, each on its own line:
[SMALL] short fact or command (like "clang compiles C code")
[SMALL] another quick point
[BIG] longer explanation or important code block that needs detail

RULES:
- Most notes should be [SMALL] - quick facts, commands, definitions
- Use [BIG] only for: complex code, important concepts, things hard to remember
- Write directly, never "The speaker says..."
- Each note is independent

EXAMPLES:
[SMALL] printf() outputs text to terminal
[SMALL] \\n creates a new line
[BIG] for loop syntax: for(init; condition; update) { code } - init runs once, condition checked each loop, update runs after each iteration
[SMALL] gcc -o output input.c compiles the file
[BIG] Memory allocation: malloc(size) reserves bytes, must free() when done or memory leaks

If nothing educational, return empty.`
        }]
      }],
      generationConfig: { temperature: 0.1 }
    });
    
    const text = result.response.text().trim();
    const notes = parseNotes(text);
    res.json({ notes });
  } catch (error) {
    console.error("Live audio error:", error.message);
    res.json({ notes: [] });
  }
});

// Live chunk processing - screen/video frame
app.post("/api/live/frame", async (req, res) => {
  try {
    const { imageData, context } = req.body;
    
    if (!imageData) {
      return res.json({ notes: [] });
    }
    
    const result = await flash.generateContent({
      contents: [{
        parts: [{
          inlineData: { data: imageData, mimeType: 'image/jpeg' }
        }, {
          text: `Extract educational content from this screenshot as a LIST of notes.

OUTPUT FORMAT - Return multiple notes, each on its own line:
[SMALL] quick fact or short code
[BIG] important/complex content

RULES:
- Most notes = [SMALL]: commands, syntax, quick definitions
- [BIG] only for: full code blocks, complex explanations, diagrams
- IGNORE: YouTube UI, buttons, timestamps, menus, browser stuff
- Write directly, never "The screen shows..."

EXAMPLES from code screenshot:
[SMALL] #include <stdio.h> imports standard I/O
[SMALL] int main(void) is the entry point
[BIG] Full program: #include <stdio.h>
int main(void) { printf("hello\\n"); return 0; }
This prints "hello" and exits with code 0
[SMALL] return 0 means success

Previous notes: ${context || 'None'}
Only NEW content. If nothing new, return "NO_NEW_CONTENT".`
        }]
      }],
      generationConfig: { temperature: 0.1 }
    });
    
    const text = result.response.text().trim();
    if (text.includes("NO_NEW_CONTENT")) {
      return res.json({ notes: [] });
    }
    const notes = parseNotes(text);
    res.json({ notes });
  } catch (error) {
    console.error("Live frame error:", error.message);
    res.json({ notes: [] });
  }
});

// Generate final structured notes from accumulated content
app.post("/api/live/finalize", async (req, res) => {
  try {
    const { transcript, visualNotes } = req.body;
    
    // Handle empty content
    if (!transcript && !visualNotes) {
      return res.json({ 
        notes: { 
          title: "Empty Session", 
          summary: "No content was captured during this session.",
          bullet_points: [],
          key_terms: [],
          flashcards: [],
          questions: [],
          examples: []
        } 
      });
    }
    
    const result = await flash.generateContent({
      contents: [{
        parts: [{
          text: `You are creating the PERFECT study notes from a lecture. Think like a top student who wants to ace the exam.

RAW LECTURE CONTENT:
${transcript || ''}

VISUAL NOTES:
${visualNotes || ''}

Create comprehensive, well-organized notes that capture:
1. The main concepts and how they connect
2. Real-world examples and analogies used (like "3 lamps = 111 binary")
3. Code examples with clear explanations
4. Key terms a student MUST know
5. Flashcards that test understanding, not just memorization
6. Practice questions that could appear on an exam

Return valid JSON:
{
  "title": "Clear, descriptive topic title",
  "summary": "5-8 line summary explaining the core concepts in simple terms",
  "bullet_points": ["Key concept 1 with explanation", "Key concept 2..."],
  "examples": ["Real-world example or analogy 1", "Code example with explanation"],
  "key_terms": [{"term": "term", "definition": "clear definition with example"}],
  "flashcards": [{"q": "Question testing understanding", "a": "Clear answer"}],
  "questions": ["Exam-style practice question 1", "Question 2"]
}`
        }]
      }],
      generationConfig: { temperature: 0.3 }
    });
    
    const notesText = result.response.text();
    const notes = parseJSON(notesText);
    res.json({ notes });
  } catch (error) {
    console.error("Finalize error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save notes
app.post("/api/notes/save", (req, res) => {
  try {
    const { title, notes, transcript, visualNotes } = req.body;
    const filename = `${Date.now()}-${title.replace(/[^a-z0-9]/gi, '_')}.json`;
    const filepath = path.join(NOTES_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify({
      title,
      notes,
      transcript,
      visualNotes,
      createdAt: new Date().toISOString()
    }, null, 2));
    
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved notes list
app.get("/api/notes/saved", (req, res) => {
  try {
    const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.json'));
    const notes = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(NOTES_DIR, f)));
      return { filename: f, title: data.title, createdAt: data.createdAt };
    });
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single saved note
app.get("/api/notes/saved/:filename", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(NOTES_DIR, req.params.filename)));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
