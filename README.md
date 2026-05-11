# Fehlerquotient — KI-gestützte Klausuranalyse

Klausuren scannen, Fehler automatisch erkennen, Fehlerquotient berechnen.

## Setup (5 Minuten)

### 1. OpenAI API-Key holen
- Geh auf [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Erstelle einen neuen Key
- Lade 5€ auf (reicht für ~5.000 Klausuren)

### 2. Auf Vercel deployen

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Erstelle einen Account auf [vercel.com](https://vercel.com)
2. Klicke auf "New Project" → "Import Git Repository"
3. Lade diesen Ordner als GitHub-Repo hoch (oder per Vercel CLI)
4. In Vercel: **Settings → Environment Variables**
   - Name: `OPENAI_API_KEY`
   - Value: dein OpenAI Key (sk-...)
5. Klicke "Deploy" → fertig!

### 3. Lokal testen (optional)
```bash
cp .env.local.example .env.local
# Trage deinen OpenAI Key in .env.local ein
npm install
npm run dev
```

Öffne http://localhost:3000

## Features
- Bild hochladen oder Foto direkt aufnehmen
- KI erkennt Handschrift und markiert Fehler
- Fehler bestätigen, verwerfen oder manuell hinzufügen
- FQ wird live berechnet
- Fehlerblatt drucken oder herunterladen
- Deutsch und Englisch

## Datenschutz
- Kein Account nötig
- Keine Daten werden gespeichert
- Bilder werden nur zur Analyse an OpenAI gesendet
- OpenAI speichert keine API-Daten für Training
- DSGVO-konform nutzbar
