import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const flash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcript, visualNotes } = req.body;
    
    if (!transcript && !visualNotes) {
      return res.json({ 
        notes: { 
          title: "Empty Session", 
          summary: "No content was captured.",
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
          text: `Create PERFECT study notes from this lecture.

RAW CONTENT:
${transcript || ''}

VISUAL NOTES:
${visualNotes || ''}

Return valid JSON:
{
  "title": "Clear topic title",
  "summary": "5-8 line summary",
  "bullet_points": ["Key point 1", "Key point 2"],
  "examples": ["Example 1", "Code example"],
  "key_terms": [{"term": "term", "definition": "definition"}],
  "flashcards": [{"q": "Question", "a": "Answer"}],
  "questions": ["Practice question 1"]
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
}
