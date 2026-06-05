/**
 * Policy & Test Cases API Routes
 *
 * GET  /api/policy             - Return full policy terms
 * GET  /api/policy/test-cases  - Run all test cases through rule engine
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { getPolicyTerms } = require('../services/policyService');
const { adjudicateClaim } = require('../services/ruleEngine');
const { isOllamaAvailable } = require('../services/aiExtractor');

// Load test cases
const testCases = require(path.join(__dirname, '..', 'data', 'test_cases.json'));

// ─── GET /api/policy — Return policy terms ───────────────────────────────────

router.get('/', (req, res) => {
  res.json({ policy: getPolicyTerms() });
});

// ─── GET /api/policy/test-cases — Run all test cases ─────────────────────────

router.get('/test-cases', (req, res) => {
  try {
    const results = [];
    let passed = 0;
    const total = testCases.test_cases.length;

    for (const tc of testCases.test_cases) {
      const input = tc.input_data;
      const expected = tc.expected_output;

      // Build adjudication input
      const adjInput = {
        member_id: input.member_id || '',
        member_name: input.member_name || '',
        member_join_date: input.member_join_date || null,
        treatment_date: input.treatment_date || '',
        claim_amount: input.claim_amount || 0,
        hospital: input.hospital || null,
        cashless_request: input.cashless_request || false,
        previous_claims_same_day: input.previous_claims_same_day || 0,
        documents: input.documents || {},
      };

      const actual = adjudicateClaim(adjInput);
      const match = actual.decision === expected.decision;
      if (match) passed++;

      results.push({
        case_id: tc.case_id,
        case_name: tc.case_name,
        description: tc.description,
        expected_decision: expected.decision,
        actual_decision: actual.decision,
        match,
        expected_amount: expected.approved_amount ?? null,
        actual_amount: actual.approved_amount ?? null,
        expected_reasons: expected.rejection_reasons || null,
        actual_reasons: actual.rejection_reasons || null,
        actual_confidence: actual.confidence_score,
        actual_notes: actual.notes,
      });
    }

    res.json({
      total,
      passed,
      failed: total - passed,
      pass_rate: `${((passed / total) * 100).toFixed(1)}%`,
      results,
    });
  } catch (error) {
    console.error('Test cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/health — Detailed health check ─────────────────────────────────

router.get('/health', async (req, res) => {
  const ollamaUp = await isOllamaAvailable();
  res.json({
    status: 'healthy',
    ollama_available: ollamaUp,
    ollama_model: process.env.OLLAMA_MODEL || 'llama3.2',
    database: 'connected',
  });
});

module.exports = router;
