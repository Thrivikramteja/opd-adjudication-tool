/**
 * Claims API Routes
 *
 * POST   /api/claims          - Submit claim via JSON (test case format)
 * POST   /api/claims/upload   - Submit claim with file uploads
 * GET    /api/claims          - List all claims
 * GET    /api/claims/:id      - Get single claim details
 * POST   /api/claims/:id/appeal - Appeal a decision
 */

const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const { adjudicateClaim } = require('../services/ruleEngine');
const { extractFromImage, extractFromPDF, convertExtractedToClaimFormat } = require('../services/aiExtractor');
const upload = require('../middleware/upload');
const path = require('path');

// ─── POST /api/claims — Submit claim via JSON ────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const {
      member_id, member_name, member_join_date,
      treatment_date, claim_amount,
      hospital, cashless_request, previous_claims_same_day,
      documents,
    } = req.body;

    // Validate required fields
    if (!member_id || !member_name || !treatment_date || !claim_amount) {
      return res.status(400).json({
        error: 'Missing required fields: member_id, member_name, treatment_date, claim_amount',
      });
    }

    // Run adjudication
    const adjInput = {
      member_id, member_name, member_join_date,
      treatment_date, claim_amount,
      hospital, cashless_request: cashless_request || false,
      previous_claims_same_day: previous_claims_same_day || 0,
      documents: documents || {},
    };

    const result = adjudicateClaim(adjInput);

    // Save to MongoDB
    const claim = new Claim({
      member_id,
      member_name,
      member_join_date,
      treatment_date,
      claim_amount,
      hospital_name: hospital,
      cashless_request: cashless_request || false,
      previous_claims_same_day: previous_claims_same_day || 0,
      documents: documents || {},
      status: result.decision,
      decision: result.decision,
      approved_amount: result.approved_amount,
      rejection_reasons: result.rejection_reasons,
      confidence_score: result.confidence_score,
      decision_notes: result.notes,
      next_steps: result.next_steps,
      deductions: result.deductions,
      rejected_items: result.rejected_items,
      cashless_approved: result.cashless_approved,
      network_discount: result.network_discount,
      flags: result.flags,
      adjudication_breakdown: result.adjudication_breakdown,
    });

    await claim.save();

    res.status(201).json(claim.toJSON());
  } catch (error) {
    console.error('Claim submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/claims/upload — Submit with file uploads ──────────────────────

router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { member_id, member_name, member_join_date, treatment_date, claim_amount, hospital, cashless_request } = req.body;

    if (!member_id || !member_name || !treatment_date || !claim_amount) {
      return res.status(400).json({
        error: 'Missing required fields: member_id, member_name, treatment_date, claim_amount',
      });
    }

    // Process uploaded files via AI
    const uploadedFiles = [];
    const allExtracted = { prescription: {}, bill: {} };

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        uploadedFiles.push({
          filename: file.filename,
          original_name: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        });

        // Extract data via AI
        let extracted;
        const ext = path.extname(file.originalname).toLowerCase();

        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
          extracted = await extractFromImage(file.path);
        } else if (ext === '.pdf') {
          extracted = await extractFromPDF(file.path);
        }

        if (extracted && extracted.extracted) {
          const converted = convertExtractedToClaimFormat(extracted);
          if (converted.prescription) Object.assign(allExtracted.prescription, converted.prescription);
          if (converted.bill) Object.assign(allExtracted.bill, converted.bill);
        }
      }
    }

    // Run adjudication
    const adjInput = {
      member_id,
      member_name,
      member_join_date: member_join_date || null,
      treatment_date,
      claim_amount: parseFloat(claim_amount),
      hospital: hospital || null,
      cashless_request: cashless_request === 'true' || cashless_request === true,
      previous_claims_same_day: 0,
      documents: allExtracted,
    };

    const result = adjudicateClaim(adjInput);

    // Save to MongoDB
    const claim = new Claim({
      ...adjInput,
      hospital_name: hospital,
      uploaded_files: uploadedFiles,
      extracted_data: allExtracted,
      status: result.decision,
      decision: result.decision,
      approved_amount: result.approved_amount,
      rejection_reasons: result.rejection_reasons,
      confidence_score: result.confidence_score,
      decision_notes: result.notes,
      next_steps: result.next_steps,
      deductions: result.deductions,
      rejected_items: result.rejected_items,
      cashless_approved: result.cashless_approved,
      network_discount: result.network_discount,
      flags: result.flags,
      adjudication_breakdown: result.adjudication_breakdown,
    });

    await claim.save();
    res.status(201).json(claim.toJSON());
  } catch (error) {
    console.error('Upload claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/claims — List all claims ───────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status, skip = 0, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const claims = await Claim.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Claim.countDocuments(filter);

    // Aggregate stats
    const allClaims = await Claim.find({});
    const stats = {
      total: allClaims.length,
      approved: allClaims.filter(c => c.status === 'APPROVED').length,
      rejected: allClaims.filter(c => c.status === 'REJECTED').length,
      partial: allClaims.filter(c => c.status === 'PARTIAL').length,
      manual_review: allClaims.filter(c => c.status === 'MANUAL_REVIEW').length,
      pending: allClaims.filter(c => ['PENDING', 'PROCESSING'].includes(c.status)).length,
      total_claimed: allClaims.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
      total_approved: allClaims.reduce((sum, c) => sum + (c.approved_amount || 0), 0),
    };

    res.json({ claims: claims.map(c => c.toJSON()), total, stats });
  } catch (error) {
    console.error('List claims error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/claims/:id — Get single claim ─────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const claim = await Claim.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined },
        { claim_number: req.params.id },
      ].filter(q => Object.values(q || {})[0] !== undefined),
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json(claim.toJSON());
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/claims/:id/appeal — Appeal a decision ────────────────────────

router.post('/:id/appeal', async (req, res) => {
  try {
    const { reason } = req.body;

    const claim = await Claim.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : undefined },
        { claim_number: req.params.id },
      ].filter(q => Object.values(q || {})[0] !== undefined),
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (!['REJECTED', 'PARTIAL'].includes(claim.status)) {
      return res.status(400).json({ error: 'Only rejected or partially approved claims can be appealed' });
    }

    claim.status = 'MANUAL_REVIEW';
    claim.decision = 'MANUAL_REVIEW';
    claim.decision_notes = `Appeal submitted. Reason: ${reason || 'Not specified'}. Original decision: ${claim.decision}`;
    claim.flags = [...(claim.flags || []), 'Member appeals automated decision'];

    await claim.save();
    res.json(claim.toJSON());
  } catch (error) {
    console.error('Appeal error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
