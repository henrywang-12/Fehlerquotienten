"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import Tesseract from "tesseract.js";

// … (T‑Übersetzungen, ECOLORS, ELABELS, Hilfsfunktionen – alle bleiben wie zuvor, ich zeige nur die Änderungen) …

// NEU: OCR‑Zustand
const [ocrProgress, setOcrProgress] = useState(0);
const [ocrReady, setOcrReady] = useState(false);
const [ocrWords, setOcrWords] = useState([]); // [{ text, bbox: { x0, y0, x1, y1 } }]
const canvasRef = useRef(null);

// Nach erfolgreicher Analyse OCR starten
useEffect(() => {
  if (step === 2 && imgSrc && errors.length > 0) {
    setOcrReady(false);
    setOcrProgress(0);
    setOcrWords([]);
    const worker = Tesseract.createWorker({
      logger: (m) => {
        if (m.status === "recognizing text") {
          setOcrProgress(m.progress);
        }
      },
    });
    (async () => {
      await worker.load();
      await worker.loadLanguage(scanLang === "Deutsch" ? "deu" : "eng");
      await worker.initialize(scanLang === "Deutsch" ? "deu" : "eng");
      const { data } = await worker.recognize(imgSrc);
      // data.words enthält die einzelnen Wörter mit Bounding Boxes
      setOcrWords(
        data.words.filter((w) => w.text.trim().length > 0).map((w) => ({
          text: w.text,
          bbox: w.bbox, // x0, y0, x1, y1
        }))
      );
      await worker.terminate();
      setOcrReady(true);
    })();
  }
}, [step, imgSrc, errors.length, scanLang]);

// Fehler‑Originaltext mit OCR‑Wörtern abgleichen
const matchErrorOriginal = (original) => {
  const cleaned = original.replace(/\s+/g, " ").trim().toLowerCase();
  // Einfach: Wort-für-Wort suchen und Bounding Box der ersten Übereinstimmung nehmen
  const words = cleaned.split(" ");
  const found = ocrWords.filter((ocr) =>
    words.includes(ocr.text.toLowerCase().trim())
  );
  // Nimm die erste Box, die alle Teile umschließt (grobe Näherung)
  if (found.length === 0) return null;
  const x0 = Math.min(...found.map((w) => w.bbox.x0));
  const y0 = Math.min(...found.map((w) => w.bbox.y0));
  const x1 = Math.max(...found.map((w) => w.bbox.x1));
  const y1 = Math.max(...found.map((w) => w.bbox.y1));
  return { x0, y0, x1, y1 };
};

// Canvas‑Overlay zeichnen, sobald OCR‑Wörter und Fehler da sind
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || !imgSrc || !ocrReady) return;
  const img = new Image();
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fehler‑Rechtecke zeichnen
    active.forEach((err) => {
      const box = matchErrorOriginal(err.original);
      if (!box) return;
      const { x0, y0, x1, y1 } = box;
      ctx.strokeStyle = ECOLORS[err.type].border;
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      // Typ‑Label
      ctx.fillStyle = ECOLORS[err.type].badge;
      ctx.fillRect(x0, y0 - 18, 24, 18);
      ctx.fillStyle = ECOLORS[err.type].text;
      ctx.font = "bold 12px DM Sans, sans-serif";
      ctx.fillText(err.type, x0 + 4, y0 - 4);
    });
  };
  img.src = imgSrc;
}, [imgSrc, errors, ocrReady, ocrWords]);

// In Schritt 2: Bild + Canvas anzeigen (ersetzt das bisherige einfache <img>)
{step === 2 && (
  <div>
    {/* … bestehende Karten für Wörter, Fehler, FQ … */}
    {/* NEU: Bild mit Overlay */}
    <div style={{ position: "relative", marginBottom: 16 }}>
      <img
        src={imgSrc}
        style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 8, border: "1px solid #eee" }}
        alt="uploaded"
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {!ocrReady && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 12,
          }}
        >
          OCR lädt… {Math.round(ocrProgress * 100)}%
        </div>
      )}
    </div>
    {/* … Rest der Fehlerliste bleibt gleich */}
  </div>
)}
