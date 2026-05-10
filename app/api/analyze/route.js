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
        ? `Du bist ein erfahrener Lehrer. Lies den Text im Bild vollständig und analysiere ihn auf Fehler. Der Text ist auf ${scanLang}. Antworte NUR mit einem JSON-Objekt ohne Markdown-Formatierung. Format: {"transcription":"vollständiger transkribierter Text","errors":[{"type":"G|R|W|Z","original":"falsches Wort oder Phrase","correction":"korrekte Form","explanation":"kurze Erklärung auf Deutsch"}],"summary":"Ein Satz Gesamteindruck"}. Fehlertypen: G=Grammatikfehler R=Rechtschreibfehler W=Wortstellungsfehler Z=Zeichensetzungsfehler. Nur eindeutige Fehler markieren, keine stilistischen Hinweise.`
        : `You are an experienced teacher. Read the text in the image completely and analyze it for errors. The text is in ${scanLang}. Respond ONLY with a JSON object without any Markdown formatting. Format: {"transcription":"complete transcribed text","errors":[{"type":"G|R|W|Z","original":"incorrect word or phrase","correction":"correct form","explanation":"short explanation in English"}],"summary":"One sentence overall impression"}. Error types: G=Grammar R=Spelling W=Word order Z=Punctuation. Only mark clear errors, no stylistic suggestions.`;

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
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
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
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: clean }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
