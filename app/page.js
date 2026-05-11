"use client";
import { useState, useCallback, useRef } from "react";

const T = {
  de: {
    title: "Fehlerquotient", subtitle: "KI-gestützte Klausuranalyse",
    uploadTitle: "Klausur hochladen", uploadDesc: "Bild hochladen oder Foto direkt aufnehmen",
    takePhoto: "Foto aufnehmen", uploadFile: "Datei auswählen",
    analyze: "Analysieren", analyzing: "Text wird erkannt und analysiert…",
    words: "Wörter", errors: "Fehler", fq: "FQ", grade: "Bewertung",
    recognized: "Erkannter Text", errorList: "Fehlerliste",
    accept: "Bestätigen", reject: "Verwerfen",
    addError: "Fehler hinzufügen", addErrorTitle: "Fehler manuell hinzufügen",
    original: "Originaltext", correction: "Korrektur", explanation: "Erklärung", type: "Typ",
    save: "Hinzufügen", cancel: "Abbrechen", download: "Herunterladen", print: "Drucken",
    newAnalysis: "Neue Analyse", good: "Gut", sufficient: "Ausreichend", insufficient: "Mangelhaft",
    noErrors: "Keine Fehler gefunden", accepted: "bestätigt", rejected: "verworfen", manual: "manuell",
    privacy: "Datenschutz",
    privacyText: "Alle Daten werden nur in deinem Browser verarbeitet. Klausurtexte werden zur Analyse an OpenAI gesendet — dort nicht gespeichert und nicht für KI-Training verwendet. Es werden keine Schülernamen übertragen.",
    close: "Schließen", err: "Fehler aufgetreten", scanLang: "Textsprache",
    back: "Zurück", step1: "Hochladen", step2: "Überprüfen", step3: "Exportieren",
    deutsch: "Deutsch", englisch: "Englisch", remove: "Entfernen",
  },
  en: {
    title: "Error Quotient", subtitle: "AI-powered exam analysis",
    uploadTitle: "Upload exam", uploadDesc: "Upload image or take a photo",
    takePhoto: "Take photo", uploadFile: "Choose file",
    analyze: "Analyze", analyzing: "Recognizing and analyzing text…",
    words: "Words", errors: "Errors", fq: "EQ", grade: "Grade",
    recognized: "Recognized text", errorList: "Error list",
    accept: "Accept", reject: "Reject",
    addError: "Add error", addErrorTitle: "Add error manually",
    original: "Original", correction: "Correction", explanation: "Explanation", type: "Type",
    save: "Add", cancel: "Cancel", download: "Download", print: "Print",
    newAnalysis: "New analysis", good: "Good", sufficient: "Sufficient", insufficient: "Insufficient",
    noErrors: "No errors found", accepted: "accepted", rejected: "rejected", manual: "manual",
    privacy: "Privacy",
    privacyText: "All data is processed in your browser. Exam texts are sent to OpenAI for analysis — not stored or used for training. No student names are transmitted.",
    close: "Close", err: "An error occurred", scanLang: "Text language",
    back: "Back", step1: "Upload", step2: "Review", step3: "Export",
    deutsch: "German", englisch: "English", remove: "Remove",
  },
};

const ECOLORS = {
  G: { bg: "#FFF1ED", border: "#D85A30", badge: "#F0997B", text: "#4A1B0C" },
  R: { bg: "#FFF0F0", border: "#E24B4A", badge: "#F09595", text: "#501313" },
  W: { bg: "#FFF8E6", border: "#BA7517", badge: "#FAC775", text: "#412402" },
  Z: { bg: "#EEF5FC", border: "#378ADD", badge: "#85B7EB", text: "#042C53" },
};

const ELABELS = {
  de: { G: "Grammatik", R: "Rechtschreibung", W: "Wortstellung", Z: "Zeichensetzung" },
  en: { G: "Grammar", R: "Spelling", W: "Word order", Z: "Punctuation" },
};

const cw = (s) => s.trim().split(/\s+/).filter((w) => w.length > 0).length;

const fqGrade = (fq, t) => {
  if (fq <= 3) return { label: t.good, c: "#1a7a3a", bg: "#eef7f0" };
  if (fq <= 6) return { label: t.sufficient, c: "#8a6d1b", bg: "#fdf8ec" };
  return { label: t.insufficient, c: "#b33030", bg: "#fdf0f0" };
};

export default function Page() {
  const [lang, setLang] = useState("de");
  const [step, setStep] = useState(1);
  const [imgSrc, setImgSrc] = useState(null);
  const [imgData, setImgData] = useState(null);
  const [imgMime, setImgMime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showImg, setShowImg] = useState(true);
  const [highlightId, setHighlightId] = useState(null);
  const [scanLang, setScanLang] = useState("Deutsch");
  const fileRef = useRef(null);
  const camRef = useRef(null);

  const t = T[lang];

  const compressImage = (dataUrl, maxWidth = 1000) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.5);
        resolve(compressed);
      };
      img.src = dataUrl;
    });
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = async (e) => {
      const raw = e.target.result;
      const compressed = await compressImage(raw);
      setImgSrc(compressed);
      setImgData(compressed.split(",")[1]);
      setImgMime("image/jpeg");
    };
    r.readAsDataURL(file);
  }, []);

  const analyze = async () => {
    if (!imgData) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imgData, mimeType: imgMime, lang, scanLang }),
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(lang === "de" ? "Server-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen." : "Could not process server response. Please try again."); }
      if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);
      setTranscription(data.transcription || "");
      setErrors((data.errors || []).map((e, i) => ({ ...e, id: i, status: "pending" })));
      setSummary(data.summary || "");
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const active = errors.filter((e) => e.status !== "rejected");
  const wc = cw(transcription);
  const fq = wc > 0 ? Math.round((active.length / wc) * 1000) / 10 : 0;
  const gr = fqGrade(fq, t);
  const tc = { G: 0, R: 0, W: 0, Z: 0 };
  active.forEach((e) => { if (tc[e.type] !== undefined) tc[e.type]++; });

  const updateErr = (id, status) => setErrors((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));

  const addErr = (err) => {
    setErrors((p) => [...p, { ...err, id: Date.now(), status: "manual" }]);
    setShowAdd(false);
  };

  const printContent = () => {
    const el = ELABELS[lang];
    const rows = active.map((e) =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:12px;color:${ECOLORS[e.type].text};background:${ECOLORS[e.type].bg}">${el[e.type]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px"><strong>${e.original}</strong></td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px">${e.correction}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;color:#666">${e.explanation}</td></tr>`
    ).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t.title}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:2rem;color:#1a1a18;max-width:800px;margin:0 auto}@media print{body{padding:1rem}}</style></head><body><h1 style="font-size:20px;font-weight:600;margin-bottom:4px">${t.title}</h1><p style="font-size:12px;color:#888;margin-bottom:1.5rem">${new Date().toLocaleDateString(lang==="de"?"de-DE":"en-GB")}</p><div style="display:flex;gap:2rem;margin-bottom:1.5rem"><div><span style="font-size:11px;color:#888">${t.words}</span><div style="font-size:24px;font-weight:600">${wc}</div></div><div><span style="font-size:11px;color:#888">${t.errors}</span><div style="font-size:24px;font-weight:600">${active.length}</div></div><div><span style="font-size:11px;color:#888">${t.fq}</span><div style="font-size:24px;font-weight:600;color:${gr.c}">${fq}</div></div><div><span style="font-size:11px;color:#888">${t.grade}</span><div style="font-size:24px;font-weight:600;color:${gr.c}">${gr.label}</div></div></div>${summary?`<p style="font-size:13px;color:#555;margin-bottom:1.5rem;padding:10px;background:#f5f5f2;border-radius:6px">${summary}</p>`:""}<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f5f5f2"><th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500">${t.type}</th><th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500">${t.original}</th><th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500">${t.correction}</th><th style="padding:8px 10px;text-align:left;font-size:11px;color:#888;font-weight:500">${t.explanation}</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  };

  const doPrint = () => { const w = window.open("","_blank"); w.document.write(printContent()); w.document.close(); setTimeout(() => w.print(), 300); };
  const doDownload = () => { const b = new Blob([printContent()],{type:"text/html"}); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href=u; a.download=`fehlerquotient_${new Date().toISOString().slice(0,10)}.html`; a.click(); URL.revokeObjectURL(u); };
  const reset = () => { setStep(1); setImgSrc(null); setImgData(null); setImgMime(null); setTranscription(""); setErrors([]); setSummary(""); setError(null); };

  const s = {
    page: { minHeight: "100vh", background: "#fafaf8", fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif" },
    header: { borderBottom: "1px solid #eeede8", background: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
    logo: { width: 28, height: 28, borderRadius: 6, background: "#1a1a18", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 600 },
    main: { maxWidth: 720, margin: "0 auto", padding: "24px 16px" },
    card: { background: "#fff", border: "1px solid #eeede8", borderRadius: 10, padding: "14px 16px", marginBottom: 16 },
    btn: { padding: "10px 24px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", transition: "all 0.15s" },
    btnPrimary: { background: "#1a1a18", color: "#fff" },
    btnSecondary: { background: "#fff", color: "#666", border: "1px solid #e5e4df" },
    btnDisabled: { background: "#e5e4df", color: "#bbb", cursor: "not-allowed" },
    select: { fontSize: 12, border: "1px solid #e5e4df", borderRadius: 6, padding: "6px 8px", background: "#fff", color: "#1a1a18" },
    label: { fontSize: 10, fontWeight: 500, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 },
    input: { width: "100%", border: "1px solid #e5e4df", borderRadius: 6, padding: "8px 10px", fontSize: 13, background: "#fafaf8", color: "#1a1a18", outline: "none", marginBottom: 10 },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
    modal: { background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" },
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.logo}>fq</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a18", letterSpacing: "-0.3px" }}>{t.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowPrivacy(true)} style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer" }}>{t.privacy}</button>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={s.select}>
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
        </div>
      </header>

      <main style={s.main}>
        {/* Steps */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, justifyContent: "center", alignItems: "center" }}>
          {[1,2,3].map((n) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, background: step >= n ? "#1a1a18" : "#e5e4df", color: step >= n ? "#fff" : "#999" }}>{n}</div>
              <span style={{ fontSize: 11, color: step >= n ? "#1a1a18" : "#bbb", marginRight: 12 }}>{t[`step${n}`]}</span>
              {n < 3 && <div style={{ width: 32, height: 1, background: step > n ? "#1a1a18" : "#e5e4df", marginRight: 12 }} />}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div
              style={{ background: "#fff", border: imgSrc ? "2px solid #1a7a3a" : "2px dashed #ddd", borderRadius: 12, padding: imgSrc ? 16 : "48px 16px", textAlign: "center", cursor: imgSrc ? "default" : "pointer" }}
              onClick={() => !imgSrc && fileRef.current?.click()}
            >
              {imgSrc ? (
                <div>
                  <img src={imgSrc} style={{ maxHeight: 280, maxWidth: "100%", borderRadius: 8, display: "block", margin: "0 auto" }} alt="" />
                  <button onClick={() => { setImgSrc(null); setImgData(null); }} style={{ marginTop: 10, fontSize: 12, color: "#b33030", background: "none", border: "none", cursor: "pointer" }}>{t.remove}</button>
                </div>
              ) : (
                <div>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: "#f5f5f2", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#bbb" }}>&#9634;</div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "#1a1a18", marginBottom: 4 }}>{t.uploadTitle}</p>
                  <p style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>{t.uploadDesc}</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={(e) => { e.stopPropagation(); camRef.current?.click(); }} style={{ ...s.btn, ...s.btnSecondary, padding: "8px 16px", fontSize: 12, fontWeight: 500 }}>{t.takePhoto}</button>
                    <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ ...s.btn, ...s.btnPrimary, padding: "8px 16px", fontSize: 12 }}>{t.uploadFile}</button>
                  </div>
                </div>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />

            <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "#888" }}>{t.scanLang}</label>
              <select value={scanLang} onChange={(e) => setScanLang(e.target.value)} style={s.select}>
                <option>{t.deutsch}</option>
                <option>{t.englisch}</option>
              </select>
              <div style={{ flex: 1 }} />
              <button onClick={analyze} disabled={!imgData || loading} style={{ ...s.btn, ...(imgData && !loading ? s.btnPrimary : s.btnDisabled) }}>
                {loading ? t.analyzing : t.analyze}
              </button>
            </div>

            {error && <div style={{ marginTop: 12, background: "#fdf0f0", border: "1px solid #f5c4c4", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#501313" }}>{t.err}: {error}</div>}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            {/* Metrics bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
              {[{ l: t.words, v: wc }, { l: t.errors, v: active.length }, { l: t.fq, v: fq, c: gr.c }, { l: t.grade, v: gr.label, c: gr.c }].map((m, i) => (
                <div key={i} style={s.card}>
                  <div style={{ fontSize: 10, color: "#999", marginBottom: 2 }}>{m.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: m.c || "#1a1a18" }}>{m.v}</div>
                </div>
              ))}
            </div>

            {/* Type count badges */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(tc).map(([type, count]) => (
                <span key={type} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: ECOLORS[type].bg, color: ECOLORS[type].text, border: `1px solid ${ECOLORS[type].border}20` }}>
                  {ELABELS[lang][type]}: {count}
                </span>
              ))}
            </div>

            {/* Original image - collapsible */}
            {imgSrc && (
              <div style={{ ...s.card, padding: 0, overflow: "hidden", marginBottom: 16 }}>
                <button
                  onClick={() => setShowImg(!showImg)}
                  style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderBottom: showImg ? "1px solid #eeede8" : "none", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#666" }}
                >
                  <span>{lang === "de" ? "Originalbild" : "Original image"}</span>
                  <span style={{ fontSize: 16, transition: "transform 0.2s", transform: showImg ? "rotate(180deg)" : "rotate(0)" }}>&#9662;</span>
                </button>
                {showImg && (
                  <div style={{ padding: 12, background: "#f9f9f6", textAlign: "center" }}>
                    <img src={imgSrc} style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 6, border: "1px solid #eee" }} alt="" />
                  </div>
                )}
              </div>
            )}

            {/* Recognized text with highlighted errors */}
            {transcription && (
              <div style={{ ...s.card, marginBottom: 16 }}>
                <div style={{ ...s.label, marginBottom: 10 }}>{t.recognized}</div>
                <div style={{ fontSize: 14, lineHeight: 2, color: "#1a1a18" }}>
                  <HighlightedText
                    text={transcription}
                    errors={errors}
                    highlightId={highlightId}
                    onHover={setHighlightId}
                    lang={lang}
                  />
                </div>
              </div>
            )}

            {/* AI Summary */}
            {summary && <div style={{ background: "#f5f5f2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#555", lineHeight: 1.6 }}>{summary}</div>}

            {/* Error list */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={s.label}>{t.errorList}</span>
              <button onClick={() => setShowAdd(true)} style={{ fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 6, border: "1px dashed #ccc", background: "none", color: "#666", cursor: "pointer" }}>+ {t.addError}</button>
            </div>

            {errors.length === 0 && <div style={{ background: "#eef7f0", borderRadius: 8, padding: 14, fontSize: 13, color: "#1a7a3a", textAlign: "center" }}>{t.noErrors}</div>}

            {errors.map((err) => (
              <div
                key={err.id}
                onMouseEnter={() => setHighlightId(err.id)}
                onMouseLeave={() => setHighlightId(null)}
                style={{
                  background: err.status === "rejected" ? "#fafaf8" : highlightId === err.id ? "#f8f8f5" : "#fff",
                  border: "1px solid #eeede8",
                  borderLeft: `3px solid ${err.status === "rejected" ? "#ddd" : ECOLORS[err.type]?.border || "#ddd"}`,
                  borderRadius: "0 8px 8px 0", padding: "12px 14px", marginBottom: 8,
                  opacity: err.status === "rejected" ? 0.4 : 1,
                  transition: "all 0.15s",
                  outline: highlightId === err.id ? `2px solid ${ECOLORS[err.type]?.border || "#ddd"}` : "none",
                  outlineOffset: -1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 4, background: ECOLORS[err.type]?.badge, color: ECOLORS[err.type]?.text }}>{err.type}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, textDecoration: err.status === "rejected" ? "line-through" : "none" }}>{err.original}</span>
                      <span style={{ fontSize: 12, color: "#999" }}>&rarr;</span>
                      <span style={{ fontSize: 13, color: "#1a7a3a", fontStyle: "italic" }}>{err.correction}</span>
                      {err.status !== "pending" && (
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: err.status === "rejected" ? "#f5f5f2" : err.status === "manual" ? "#E6F1FB" : "#eef7f0", color: err.status === "rejected" ? "#999" : err.status === "manual" ? "#0C447C" : "#1a7a3a" }}>{t[err.status]}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>{err.explanation}</p>
                  </div>
                  {err.status !== "rejected" && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {err.status === "pending" && <button onClick={() => updateErr(err.id, "accepted")} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid #c0dd97", background: "#eef7f0", color: "#1a7a3a", cursor: "pointer", fontWeight: 500 }}>{t.accept}</button>}
                      <button onClick={() => updateErr(err.id, "rejected")} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid #f0c0c0", background: "#fdf0f0", color: "#b33030", cursor: "pointer", fontWeight: 500 }}>{t.reject}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setStep(1)} style={{ ...s.btn, ...s.btnSecondary, flex: 1, padding: 10, fontSize: 12 }}>{t.back}</button>
              <button onClick={() => setStep(3)} style={{ ...s.btn, ...s.btnPrimary, flex: 2, padding: 10, fontSize: 13 }}>{t.step3} &rarr;</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <div style={{ background: gr.bg, borderRadius: 12, padding: "32px 16px", textAlign: "center", marginBottom: 20, border: `1px solid ${gr.c}20` }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: gr.c, opacity: 0.7, marginBottom: 4 }}>{t.fq}</div>
              <div style={{ fontSize: 52, fontWeight: 600, color: gr.c, lineHeight: 1 }}>{fq}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: gr.c, marginTop: 8 }}>{gr.label}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>{wc} {t.words} &middot; {active.length} {t.errors}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 20 }}>
              {Object.entries(tc).map(([type, count]) => (
                <div key={type} style={{ background: ECOLORS[type].bg, borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: ECOLORS[type].text, opacity: 0.7 }}>{ELABELS[lang][type]}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: ECOLORS[type].text }}>{count}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={doDownload} style={{ ...s.btn, ...s.btnSecondary, flex: 1, padding: 12, fontSize: 13 }}>{t.download}</button>
              <button onClick={doPrint} style={{ ...s.btn, ...s.btnPrimary, flex: 1, padding: 12, fontSize: 13 }}>{t.print}</button>
            </div>
            <button onClick={reset} style={{ ...s.btn, ...s.btnSecondary, width: "100%", padding: 10, fontSize: 12, color: "#888" }}>{t.newAnalysis}</button>
          </div>
        )}
      </main>

      {/* Add Error Modal */}
      {showAdd && (
        <div style={s.overlay} onClick={() => setShowAdd(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <AddModal lang={lang} t={t} onSave={addErr} onClose={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div style={s.overlay} onClick={() => setShowPrivacy(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{t.privacy}</h3>
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 16 }}>{t.privacyText}</p>
            <button onClick={() => setShowPrivacy(false)} style={{ width: "100%", padding: 8, fontSize: 12, border: "1px solid #e5e4df", borderRadius: 6, background: "#fff", cursor: "pointer" }}>{t.close}</button>
          </div>
        </div>
      )}

      <footer style={{ textAlign: "center", padding: "24px 16px 16px", fontSize: 10, color: "#ccc" }}>{t.title} &middot; {t.subtitle}</footer>
    </div>
  );
}

function AddModal({ lang, t, onSave, onClose }) {
  const [type, setType] = useState("G");
  const [original, setOriginal] = useState("");
  const [correction, setCorrection] = useState("");
  const [explanation, setExplanation] = useState("");
  const inp = { width: "100%", border: "1px solid #e5e4df", borderRadius: 6, padding: "8px 10px", fontSize: 13, background: "#fafaf8", color: "#1a1a18", outline: "none", marginBottom: 10 };

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{t.addErrorTitle}</h3>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{t.type}</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["G","R","W","Z"].map((tp) => (
          <button key={tp} onClick={() => setType(tp)} style={{ flex: 1, padding: 6, fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: type===tp ? `2px solid ${ECOLORS[tp].border}` : "1px solid #e5e4df", background: type===tp ? ECOLORS[tp].bg : "#fff", color: type===tp ? ECOLORS[tp].text : "#888" }}>{ELABELS[lang][tp]}</button>
        ))}
      </div>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{t.original}</label>
      <input value={original} onChange={(e) => setOriginal(e.target.value)} style={inp} />
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{t.correction}</label>
      <input value={correction} onChange={(e) => setCorrection(e.target.value)} style={inp} />
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{t.explanation}</label>
      <input value={explanation} onChange={(e) => setExplanation(e.target.value)} style={inp} />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 8, fontSize: 12, border: "1px solid #e5e4df", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#888" }}>{t.cancel}</button>
        <button onClick={() => { if (original.trim() && correction.trim()) onSave({ type, original: original.trim(), correction: correction.trim(), explanation: explanation.trim() }); }} style={{ flex: 1, padding: 8, fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, background: "#1a1a18", color: "#fff", cursor: "pointer" }}>{t.save}</button>
      </div>
    </div>
  );
}

function HighlightedText({ text, errors, highlightId, onHover, lang }) {
  if (!text || !errors.length) return <span>{text}</span>;

  // Build a list of active (non-rejected) errors with their positions in the text
  const activeErrors = errors.filter((e) => e.status !== "rejected");

  // Find all error matches and their positions
  const matches = [];
  activeErrors.forEach((err) => {
    const orig = err.original;
    let startIdx = 0;
    // Find all occurrences (case-insensitive)
    const lowerText = text.toLowerCase();
    const lowerOrig = orig.toLowerCase();
    while (true) {
      const idx = lowerText.indexOf(lowerOrig, startIdx);
      if (idx === -1) break;
      // Only take the first match per error
      if (!matches.find((m) => m.id === err.id)) {
        matches.push({ start: idx, end: idx + orig.length, err });
      }
      startIdx = idx + 1;
    }
  });

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  // Build segments: normal text and highlighted text
  const segments = [];
  let lastIdx = 0;

  matches.forEach((m) => {
    // Skip overlapping matches
    if (m.start < lastIdx) return;

    // Add normal text before this match
    if (m.start > lastIdx) {
      segments.push({ type: "text", content: text.slice(lastIdx, m.start) });
    }

    // Add highlighted match
    segments.push({ type: "error", content: text.slice(m.start, m.end), err: m.err });
    lastIdx = m.end;
  });

  // Add remaining text
  if (lastIdx < text.length) {
    segments.push({ type: "text", content: text.slice(lastIdx) });
  }

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.content}</span>;

        const e = seg.err;
        const col = ECOLORS[e.type] || ECOLORS.G;
        const isHovered = highlightId === e.id;
        const el = ELABELS[lang];

        return (
          <span
            key={i}
            onMouseEnter={() => onHover(e.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              background: isHovered ? col.border + "30" : col.bg,
              borderBottom: `2px solid ${col.border}`,
              borderRadius: 2,
              padding: "1px 2px",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.15s",
            }}
            title={`${el[e.type]}: ${e.original} → ${e.correction}`}
          >
            {seg.content}
            <span style={{
              fontSize: 8, fontWeight: 700, padding: "0 3px", borderRadius: 3,
              background: col.border, color: "#fff",
              marginLeft: 2, verticalAlign: "super", lineHeight: 1,
            }}>{e.type}</span>
          </span>
        );
      })}
    </span>
  );
}
