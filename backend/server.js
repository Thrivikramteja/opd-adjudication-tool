/**
 * OPD Claim Adjudication Tool — Express Server
 *
 * AI-powered system for automating OPD insurance claim decisions.
 * Built for Plum's AI Automation Engineer Intern Assignment.
 *
 * Tech Stack: Node.js + Express + MongoDB + Llama (Ollama)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 8000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/claims', require('./routes/claims'));
app.use('/api/policy', require('./routes/policy'));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'OPD Claim Adjudication Tool',
    version: '1.0.0',
    docs: '/api/policy for policy terms, /api/claims for claims',
  });
});

app.get('/api/health', async (req, res) => {
  const { isOllamaAvailable } = require('./services/aiExtractor');
  const ollamaUp = await isOllamaAvailable();
  res.json({
    status: 'healthy',
    ai_configured: ollamaUp,
    ai_model: process.env.OLLAMA_MODEL || 'llama3.2',
    database: 'connected',
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────────────────────

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n🏥 OPD Claim Adjudication Tool — Backend`);
      console.log(`   Server:   http://localhost:${PORT}`);
      console.log(`   API:      http://localhost:${PORT}/api/claims`);
      console.log(`   Policy:   http://localhost:${PORT}/api/policy`);
      console.log(`   Tests:    http://localhost:${PORT}/api/policy/test-cases`);
      console.log(`   Health:   http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
