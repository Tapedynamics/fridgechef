// backend/server.js (versione minima e sicura)
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3001;

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cartella con il frontend compilato
const publicDir = path.join(__dirname, 'public');

// health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// API mock: /api/detect (così il bottone non rompe)
app.post('/api/detect', upload.single('image'), (req, res) => {
  // risposta fissa per test
  res.json({ ingredients: ['tomato', 'cheese', 'eggs'] });
});

// serve i file statici del frontend
app.use(express.static(publicDir));

// fallback SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server online: http://localhost:${PORT}`);
  console.log(`📁 Static dir:   ${publicDir}`);
});
