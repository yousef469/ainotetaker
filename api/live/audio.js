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
}
