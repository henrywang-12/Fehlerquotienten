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
        ? `Lies den ${scanLang}-Text im Bild. Antworte NUR mit JSON: {"transcription":"text","errors":[{"type":"G|R|W|Z","original":"falsch","correction":"richtig","explanation":"kurz"}],"summary":"1 Satz"}. G=Grammatik R=Rechtschreibung W=Wortstellung Z=Zeichensetzung. Nur echte Fehler, kurze Erklärungen.`
        : `Read the ${scanLang} text in the image. Respond ONLY with JSON: {"transcription":"text","errors":[{"type":"G|R|W|Z","original":"wrong","correction":"right","explanation":"brief"}],"summary":"1 sentence"}. G=Grammar R=Spelling W=Word order Z=Punctuation. Only real errors, brief explanations.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
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
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: clean }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
