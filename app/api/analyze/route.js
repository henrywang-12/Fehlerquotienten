import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  try {
    const { images, lang, scanLang } = await req.json();
    if (!images || !images.length) return NextResponse.json({ error: "No images provided" }, { status: 400 });

    const systemPrompt = lang === "de"
      ? `Du analysierst einen handgeschriebenen ${scanLang}-Schüleraufsatz der über mehrere Seiten geht. Lies alle Seiten in der richtigen Reihenfolge als einen zusammenhängenden Text. Antworte NUR mit JSON ohne Markdown. Format: {"transcription":"vollständiger Text aller Seiten","errors":[{"type":"G|R|W|Z","original":"falsches Wort","correction":"richtig","explanation":"kurze Erklärung"}],"summary":"1 Satz Gesamteindruck"}. G=Grammatik R=Rechtschreibung W=Wortstellung Z=Zeichensetzung. Nur eindeutige Fehler.`
      : `You analyze a handwritten ${scanLang} student essay spread across multiple pages. Read all pages in order as one continuous text. Respond ONLY with JSON, no Markdown. Format: {"transcription":"complete text from all pages","errors":[{"type":"G|R|W|Z","original":"wrong word","correction":"correct","explanation":"brief explanation"}],"summary":"1 sentence overall impression"}. G=Grammar R=Spelling W=Word order Z=Punctuation. Only clear errors.`;

    const content = [
      ...images.map((img) => ({
        type: "image_url",
        image_url: { url: `data:${img.mime};base64,${img.data}`, detail: "low" },
      })),
      {
        type: "text",
        text: lang === "de"
          ? `Analysiere diesen ${scanLang}-Schüleraufsatz (${images.length} Seite${images.length > 1 ? "n" : ""}, Reihenfolge wie oben).`
          : `Analyze this ${scanLang} student essay (${images.length} page${images.length > 1 ? "s" : ""}, in order above).`,
      },
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        temperature: 0,
        seed: 42,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return NextResponse.json({ error: err.error?.message || `OpenAI error: ${resp.status}` }, { status: resp.status });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json\n?|```/g, "").trim();

    try {
      return NextResponse.json(JSON.parse(clean));
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: clean }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
