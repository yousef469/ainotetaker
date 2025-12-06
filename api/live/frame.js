import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const flash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
      notes.push({ type: 'small', text: trimmed });
    }
  }
  return notes;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
