/**
 * TVU Books & Materials - Local Development Server
 * 
 * Provides a local backend server that:
 * 1. Loads environment variables securely from .env using dotenv.
 * 2. Handles the /api/chat Gemini AI endpoint locally.
 * 3. Serves the static frontend (HTML, CSS, JS, Assets).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.options('/api/chat', (req, res) => {
  res.sendStatus(204);
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Route for Gemini AI Chat
app.all('/api/chat', async (req, res) => {
  try {
    await chatHandler(req, res);
  } catch (err) {
    console.error('Error in /api/chat handler:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
});

// Serve static project files
app.use(express.static(__dirname));

// Fallback to index.html for root if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log('\n==================================================');
  console.log('🚀 TVU Books & Materials Dev Server Running');
  console.log(`🌐 Local Website:   http://localhost:${PORT}`);
  console.log(`🤖 NOVA AI Chat:    http://localhost:${PORT}/ai-support.html`);
  console.log(`⚡ API Endpoint:    http://localhost:${PORT}/api/chat`);
  console.log(`🔑 Gemini Key:      ${process.env.GEMINI_API_KEY || process.env.AI_API_KEY ? 'Configured ✅' : 'Missing ❌ (Check .env)'}`);
  console.log(`🧠 AI Provider:     ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`✨ AI Model:        ${process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash'}`);
  console.log('==================================================\n');
});

