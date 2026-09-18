/**
 * TVU Books & Materials - Serverless API Route: /api/chat
 * Compatible with Vercel / Netlify / Serverless functions
 */

import { generateNovaResponse } from './lib/ai-service.js';
import { verifyAuthToken } from './lib/firestore-tools.js';

export default async function handler(req, res) {
  // Handle CORS Preflight
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      assistant: 'NOVA 🦢',
      provider: process.env.AI_PROVIDER || 'gemini',
      model: process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], userInfo } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    // Authenticate user strictly via Firebase Admin verifyIdToken()
    const verifiedUser = await verifyAuthToken(req.headers.authorization);

    const result = await generateNovaResponse({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      verifiedUser: verifiedUser // Strictly validated user object (null for guests)
    });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      books: result.books || null,
      orders: result.orders || null
    });

  } catch (error) {
    console.error('Serverless NOVA API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing request with NOVA AI.'
    });
  }
}
