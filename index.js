
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import cors from 'cors';


dotenv.config();
// The client gets the API key from the environment variable `GEMINI_API_KEY`.
//const ai = new GoogleGenAI({});

const app = express()

import fs from "fs";
import path from "path";
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import Database from 'better-sqlite3';

// Inisialisasi database SQLite untuk metadata dokumen
const dbPath = path.join('uploads', 'metadata.db');
const db = new Database(dbPath);
// Buat tabel jika belum ada
db.prepare(`CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  originalName TEXT,
  summary TEXT,
  topic TEXT,
  uploadedAt TEXT
)`).run();

const upload = multer({ dest: 'uploads/' })



// ...existing code...

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// Endpoint untuk menampilkan daftar dokumen dari database
app.get('/list-documents', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, originalName, summary, topic, uploadedAt FROM documents ORDER BY uploadedAt DESC').all();
    res.status(200).json({ documents: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint upload PDF
app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const filePath = req.file.path;
    const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
      data: dataBuffer,
      useSystemFonts: true,
      disableFontFace: true
    });
    const pdfDoc = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    // Simpan hasil ekstraksi dan file path, misal pakai nama file sebagai ID
    const pdfId = path.basename(filePath);
    fs.writeFileSync(`uploads/${pdfId}.txt`, fullText, 'utf8');

    // Generate ringkasan/topik dokumen menggunakan AI
    let summary = "";
    let topic = "";
    try {
      const aiSummaryPrompt = [
        { text: `Buatkan ringkasan singkat (1-2 kalimat) dari dokumen berikut dalam bahasa Indonesia:\n${fullText.substring(0, 3000)}` },
      ];
      const aiTopicPrompt = [
        { text: `Tentukan topik utama atau kategori dari dokumen berikut (jawab 3-7 kata saja, tanpa penjelasan):\n${fullText.substring(0, 3000)}` },
      ];
      // Ringkasan
      const summaryResp = await ai.models.generateContent({
        model: process.env.MODEL,
        contents: aiSummaryPrompt,
      });
      summary = summaryResp.text?.trim() || "";
      // Topik
      const topicResp = await ai.models.generateContent({
        model: process.env.MODEL,
        contents: aiTopicPrompt,
      });
      topic = topicResp.text?.trim() || "";
    } catch (err) {
      summary = "(Gagal generate ringkasan AI)";
      topic = "(Gagal generate topik AI)";
    }

    // Simpan metadata ke database SQLite
    db.prepare(`INSERT OR REPLACE INTO documents (id, originalName, summary, topic, uploadedAt) VALUES (?, ?, ?, ?, ?)`)
      .run(pdfId, req.file.originalname, summary, topic, new Date().toISOString());

    res.status(200).json({ id: pdfId, text: fullText, summary, topic });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const ai = new GoogleGenAI({});

const port = 3000

// Tambahkan baris ini untuk memuat folder public (termasuk index.html)
app.use(express.static('public'));

app.use(express.json());
app.use(cors());
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post('/reading-text', async (req, res) => {
  //res.send('Hello World!')
  const {prompt} = req.body;
  if(!prompt) {
    return res.status(400).json({ error: "mising prompt" });
  }

  try {    
    const response = await ai.models.generateContent({
      model: process.env.MODEL,
      contents: prompt,
    });
    res.status(200).json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/reading-document', upload.single('document'), async (req, res) => {
  //res.send('Hello World!')
  const { prompt } = req.body;
  const base64Document = req.file.buffer.toString('base64');

  if(!base64Document) {
    return res.status(400).json({ error: "mising document" });
  }

  try {    
    const response = await ai.models.generateContent({
      model: process.env.MODEL,
      contents: [
        { text: prompt ?? "summarize this document" , type: "text" },
        { inlineData:{data  : base64Document, mimeType: req.file.mimetype }}
      ],
    });
    res.status(200).json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/reading-audio', upload.single('audio'), async (req, res) => {
  const { prompt } = req.body;
  const base64Audio = req.file.buffer.toString('base64');

  if(!base64Audio) {
    return res.status(400).json({ error: "missing audio" });
  }

  try {    
    const response = await ai.models.generateContent({
      model: process.env.MODEL,
      contents: [
        { text: prompt ?? "summarize this audio" , type: "text" },
        { inlineData:{data  : base64Audio, mimeType: req.file.mimetype }}
      ],
    });
    res.status(200).json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/reading-image', upload.single('image'), async (req, res) => {
  //res.send('Hello World!')
  const { prompt } = req.body;
  const base64Image = req.file.buffer.toString('base64');

  if(!base64Image) {
    return res.status(400).json({ error: "mising image" });
  }

  try {    
    const response = await ai.models.generateContent({
      model: process.env.MODEL,
      contents: [
        { text: prompt , type: "text" },
        { inlineData:{data  : base64Image, mimeType: req.file.mimetype }}
      ],
    });
    res.status(200).json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/reading-chat', async (req, res) => {
  const { chat, pdfId } = req.body;
  try {
    if (!Array.isArray(chat)) {
      return res.status(400).json({ error: "missing chat array" });
    }

    let selectedPdfId = pdfId;
    let pdfContext = "";

    // Jika pdfId tidak diberikan, cari dokumen paling relevan dari database
    if (!selectedPdfId) {
      // Ambil pertanyaan terakhir user
      const lastUserMsg = [...chat].reverse().find(msg => msg.role === 'user');
      const userText = lastUserMsg ? lastUserMsg.text : '';
      // Cari dokumen yang summary atau topic-nya paling cocok (LIKE sederhana)
      const row = db.prepare(`SELECT id FROM documents WHERE summary LIKE ? OR topic LIKE ? ORDER BY uploadedAt DESC LIMIT 1`).get(`%${userText}%`, `%${userText}%`);
      if (row && row.id) {
        selectedPdfId = row.id;
      }
    }

    if (selectedPdfId) {
      const pdfTextPath = path.join('uploads', `${selectedPdfId}.txt`);
      if (fs.existsSync(pdfTextPath)) {
        pdfContext = fs.readFileSync(pdfTextPath, 'utf8');
      }
    }

    // Jika tidak ditemukan dokumen relevan, balas error
    if (!pdfContext) {
      return res.status(404).json({ error: "Tidak ditemukan dokumen relevan untuk pertanyaan ini." });
    }

    const contents = chat.map(({ role, text }, index) => {
      let finalText = text;
      // Jika ada konteks PDF, tambahkan ke pesan terakhir dari user
      if (index === chat.length - 1 && role === 'user' && pdfContext) {
        finalText = `KONTEKS DATA (PDF):\n${pdfContext}\n\nPERTANYAAN USER:\n${text}`;
      }
      return {
        role,
        parts: [{ text: finalText }]
      };
    });

    const response = await ai.models.generateContent({
      model: process.env.MODEL,
      contents: contents,
      config: {
        temperature: 0.8, // Rendah agar lebih faktual dan tidak berhalusinasi
        systemInstruction: "Anda adalah asisten AI yang hanya boleh menjawab pertanyaan berdasarkan KONTEKS DATA (PDF) yang diberikan. Jika informasi tidak ditemukan dalam konteks tersebut, jawablah dengan: 'Maaf, informasi tersebut tidak ditemukan dalam dokumen yang diunggah.' Jangan menggunakan pengetahuan umum Anda di luar dokumen tersebut. Jawab dalam bahasa Indonesia yang profesional.",
      }
    });
    res.status(200).json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})