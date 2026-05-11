import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const { imageBase64, mimeType, lang, scanLang } = await req.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const systemPrompt =
      lang === "de"
        ? `Du analysierst handgeschriebene ${scanLang}-Klausuren. Antworte NUR mit JSON ohne Markdown.

Schritt 1: Transkribiere den Text ZEILE FÜR ZEILE wie er im Bild steht.
Schritt 2: Finde alle Fehler und gib die Zeile und Wortposition an.

Format:
{
  "lines": ["Zeile 1 text", "Zeile 2 text", ...],
  "errors": [
    {
      "type": "G|R|W|Z",
      "original": "falsches Wort",
      "correction": "richtig",
      "explanation": "kurz",
      "line": 0,
      "wordStart": 3,
      "wordEnd": 4
    }
  ],
  "summary": "1 Satz"
}

- "line": Zeilenindex (0-basiert)
- "wordStart": Index des ersten falschen Wortes in der Zeile (0-basiert)
- "wordEnd": Index des letzten falschen Wortes + 1
- G=Grammatik R=Rechtschreibung W=Wortstellung Z=Zeichensetzung
- Nur echte Fehler.`
        : `You analyze handwritten ${scanLang} exams. Respond ONLY with JSON, no Markdown.

Step 1: Transcribe the text LINE BY LINE as it appears in the image.
Step 2: Find all errors and give line and word position.

Format:
{
  "lines": ["Line 1 text", "Line 2 text", ...],
  "errors": [
    {
      "type": "G|R|W|Z",
      "original": "wrong word",
      "correction": "correct",
      "explanation": "brief",
      "line": 0,
      "wordStart": 3,
      "wordEnd": 4
    }
  ],
  "summary": "1 sentence"
}

- "line": line index (0-based)
- "wordStart": index of first wrong word in line (0-based)
- "wordEnd": index of last wrong word + 1
- G=Grammar R=Spelling W=Word order Z=Punctuation
- Only real errors.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2000,
        temperature: 0,
        seed: 42,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
              },
              {
                type: "text",
                text:
                  lang === "de"
                    ? `Analysiere diesen ${scanLang}-Schülertext.`
                    : `Analyze this ${scanLang} student text.`,
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || `OpenAI error: ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json\n?|```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      // Build transcription from lines for backwards compatibility
      parsed.transcription = (parsed.lines || []).join("\n");
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: clean }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
