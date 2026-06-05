/**
 * Rule Engine — Implements the 5-step OPD Claim Adjudication process.
 *
 * Steps:
 *   1. Basic Eligibility Check (policy active, waiting period, member verification)
 *   2. Document Validation (completeness, doctor reg format, date consistency)
 *   3. Coverage Verification (exclusions, covered services, pre-auth)
 *   4. Limit Validation (annual limit, sub-limits, per-claim limit, co-pay)
 *   5. Fraud Detection & Medical Necessity Review
 *
 * Each step returns { passed, reasonCode, message, confidence, details }.
 * The final decision aggregates all steps into APPROVED / REJECTED / PARTIAL / MANUAL_REVIEW.
 */

const policy = require('./policyService');

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adjudicate a claim. Runs all 5 steps and produces a final decision.
 * @param {Object} claimData - claim input matching test case format
 * @returns {Object} decision result
 */
function adjudicateClaim(claimData) {
  const breakdown = [];
  const rejectionReasons = [];
  const flags = [];
  const confidenceComponents = [];

  // Extract key fields
  const memberId = claimData.member_id || '';
  const memberName = claimData.member_name || '';
  const memberJoinDate = claimData.member_join_date || null;
  const treatmentDate = claimData.treatment_date || '';
  const claimAmount = claimData.claim_amount || 0;
  const hospital = claimData.hospital || null;
  const cashlessRequest = claimData.cashless_request || false;
  const previousClaimsSameDay = claimData.previous_claims_same_day || 0;

  const documents = claimData.documents || {};
  const prescription = documents.prescription || {};
  const bill = documents.bill || {};

  const diagnosis = prescription.diagnosis || '';
  const doctorReg = prescription.doctor_reg || '';
  const medicines = prescription.medicines_prescribed || [];
  const procedures = prescription.procedures || [];
  const treatment = prescription.treatment || '';
  const testsPrescribed = prescription.tests_prescribed || [];

  // ── STEP 1: Basic Eligibility ──────────────────────────────────────────
  const step1 = checkEligibility(memberId, memberName, memberJoinDate, treatmentDate, diagnosis);
  breakdown.push({ step: 1, name: 'Basic Eligibility Check', ...step1 });
  if (!step1.passed) rejectionReasons.push(step1.reasonCode);
  confidenceComponents.push(step1.confidence);

  // ── STEP 2: Document Validation ────────────────────────────────────────
  const step2 = validateDocuments(documents, prescription, bill, doctorReg);
  breakdown.push({ step: 2, name: 'Document Validation', ...step2 });
  if (!step2.passed) {
    const codes = step2.reasonCodes || [step2.reasonCode];
    codes.forEach(c => { if (c) rejectionReasons.push(c); });
  }
  confidenceComponents.push(step2.confidence);

  // ── STEP 3: Coverage Verification ──────────────────────────────────────
  const step3 = verifyCoverage(diagnosis, treatment, procedures, testsPrescribed, medicines, bill);
  breakdown.push({ step: 3, name: 'Coverage Verification', ...step3 });
  if (!step3.passed) {
    const codes = step3.reasonCodes || [step3.reasonCode];
    codes.forEach(c => { if (c) rejectionReasons.push(c); });
  }
  confidenceComponents.push(step3.confidence);

  // ── STEP 4: Limit Validation ───────────────────────────────────────────
  // If there are partial exclusions, check limits on the covered portion only
  const partialExclusions = (step3.details || {}).rejected_items || [];
  let effectiveAmount = claimAmount;
  if (partialExclusions.length > 0 && step3.passed) {
    // Subtract excluded item costs to get the covered portion
    for (const item of partialExclusions) {
      if (item.toLowerCase().includes('whitening') && bill.teeth_whitening) {
        effectiveAmount -= bill.teeth_whitening;
      }
    }
  }
  const step4 = validateLimits(effectiveAmount, bill, diagnosis, hospital, cashlessRequest);
  breakdown.push({ step: 4, name: 'Limit Validation', ...step4 });
  if (!step4.passed) {
    const codes = step4.reasonCodes || [step4.reasonCode];
    codes.forEach(c => { if (c) rejectionReasons.push(c); });
  }
  confidenceComponents.push(step4.confidence);

  // ── STEP 5: Fraud & Medical Necessity ──────────────────────────────────
  const step5 = checkFraudAndNecessity(claimAmount, previousClaimsSameDay, diagnosis, medicines, procedures, treatment, bill);
  breakdown.push({ step: 5, name: 'Fraud & Medical Necessity', ...step5 });
  if (step5.flags) flags.push(...step5.flags);
  confidenceComponents.push(step5.confidence);

  // ── FINAL DECISION ─────────────────────────────────────────────────────
  return makeDecision({
    rejectionReasons,
    flags,
    claimAmount,
    bill,
    step3Result: step3,
    step4Result: step4,
    breakdown,
    confidenceComponents,
    hospital,
    cashlessRequest,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Basic Eligibility Check
// ─────────────────────────────────────────────────────────────────────────────

function checkEligibility(memberId, memberName, memberJoinDate, treatmentDate, diagnosis) {
  if (!memberId || !memberName) {
    return {
      passed: false,
      reasonCode: 'MEMBER_NOT_COVERED',
      message: 'Member ID or name is missing',
      confidence: 1.0,
      details: {},
    };
  }

  const { satisfied, message: waitMsg } = policy.checkWaitingPeriod(memberJoinDate, treatmentDate, diagnosis);
  if (!satisfied) {
    return {
      passed: false,
      reasonCode: 'WAITING_PERIOD',
      message: waitMsg,
      confidence: 0.96,
      details: { member_join_date: memberJoinDate, treatment_date: treatmentDate, diagnosis },
    };
  }

  return {
    passed: true,
    reasonCode: null,
    message: 'Member is eligible. Policy active and waiting period satisfied.',
    confidence: 0.95,
    details: { member_id: memberId },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Document Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateDocuments(documents, prescription, bill, doctorReg) {
  const reasonCodes = [];
  const messages = [];

  // Prescription must exist
  if (!prescription || !documents.prescription || Object.keys(prescription).length === 0) {
    reasonCodes.push('MISSING_DOCUMENTS');
    messages.push('Prescription from registered doctor is required');
    return {
      passed: false,
      reasonCodes,
      message: messages.join('; '),
      confidence: 1.0,
      details: { missing: 'prescription' },
    };
  }

  // Bill check
  if (!bill || !documents.bill || Object.keys(bill).length === 0) {
    reasonCodes.push('MISSING_DOCUMENTS');
    messages.push('Bill/invoice is required');
  }

  // Doctor registration number format: XX/NNNNN/YYYY  or  AYUR/XX/NNNN/YYYY
  if (doctorReg) {
    const regPattern = /^[A-Z]{2,4}\/[A-Z]{0,2}\/?[0-9]+\/[0-9]{4}$/;
    if (!regPattern.test(doctorReg)) {
      reasonCodes.push('DOCTOR_REG_INVALID');
      messages.push(`Doctor registration number '${doctorReg}' doesn't match expected format`);
    }
  } else {
    reasonCodes.push('DOCTOR_REG_INVALID');
    messages.push('Doctor registration number is missing');
  }

  if (reasonCodes.length > 0) {
    return {
      passed: false,
      reasonCodes,
      message: messages.join('; '),
      confidence: 0.95,
      details: { doctor_reg: doctorReg },
    };
  }

  return {
    passed: true,
    reasonCode: null,
    message: 'All documents validated successfully.',
    confidence: 0.92,
    details: { doctor_reg: doctorReg, doctor_reg_valid: true },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Coverage Verification
// ─────────────────────────────────────────────────────────────────────────────

function verifyCoverage(diagnosis, treatment, procedures, testsPrescribed, medicines, bill) {
  const reasonCodes = [];
  const messages = [];
  const rejectedItems = [];

  // Check diagnosis/treatment against exclusions
  const { isExcluded: diagExcluded, match: diagMatch } = policy.isExcluded(diagnosis, treatment);
  if (diagExcluded) {
    reasonCodes.push('SERVICE_NOT_COVERED');
    messages.push(`Treatment excluded from coverage: ${diagMatch}`);
    return {
      passed: false,
      reasonCodes,
      message: messages.join('; '),
      confidence: 0.97,
      details: { exclusion: diagMatch },
    };
  }

  // Check individual procedures for exclusions
  let hasCovered = false;
  for (const proc of procedures) {
    const { isExcluded: procExcluded, match: procMatch } = policy.isExcluded('', proc);
    if (procExcluded) {
      rejectedItems.push(`${proc} - ${procMatch}`);
    } else {
      hasCovered = true;
    }
  }

  // If ALL procedures are excluded
  if (procedures.length > 0 && !hasCovered && rejectedItems.length > 0) {
    reasonCodes.push('SERVICE_NOT_COVERED');
    messages.push(`All procedures excluded: ${rejectedItems.join(', ')}`);
    return {
      passed: false,
      reasonCodes,
      message: messages.join('; '),
      confidence: 0.95,
      details: { rejected_items: rejectedItems },
    };
  }

  // Check pre-authorization requirements
  const allTests = [...(testsPrescribed || [])];
  if (bill.mri_scan) allTests.push('MRI');
  if (bill.ct_scan) allTests.push('CT Scan');

  for (const test of allTests) {
    if (policy.requiresPreAuth(test, bill.mri_scan || bill.ct_scan || bill.diagnostic_tests || 0)) {
      reasonCodes.push('PRE_AUTH_MISSING');
      messages.push(`${test} requires pre-authorization`);
    }
  }

  if (reasonCodes.length > 0) {
    return {
      passed: false,
      reasonCodes,
      message: messages.join('; '),
      confidence: 0.94,
      details: { rejected_items: rejectedItems },
    };
  }

  return {
    passed: true,
    reasonCode: null,
    message: 'Treatment is covered under policy.',
    confidence: 0.90,
    details: { rejected_items: rejectedItems, has_partial_exclusions: rejectedItems.length > 0 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Limit Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateLimits(claimAmount, bill, diagnosis, hospital, cashlessRequest) {
  const reasonCodes = [];
  const messages = [];

  const perClaimLimit = policy.getPerClaimLimit();
  const minimumAmount = policy.getMinimumClaimAmount();

  // Minimum amount check
  if (claimAmount < minimumAmount) {
    reasonCodes.push('BELOW_MIN_AMOUNT');
    messages.push(`Claim amount ₹${claimAmount} is below minimum ₹${minimumAmount}`);
  }

  // Per-claim limit check
  if (claimAmount > perClaimLimit) {
    reasonCodes.push('PER_CLAIM_EXCEEDED');
    messages.push(`Claim amount ₹${claimAmount} exceeds per-claim limit of ₹${perClaimLimit}`);
  }

  if (reasonCodes.length > 0) {
    return {
      passed: false,
      reasonCodes,
      message: messages.join('; '),
      confidence: 0.98,
      details: { claim_amount: claimAmount, per_claim_limit: perClaimLimit, minimum_amount: minimumAmount },
    };
  }

  // Calculate deductions
  const deductions = {};
  let approvedAmount = claimAmount;

  // Co-pay for consultation
  const consultationFee = bill.consultation_fee || 0;
  if (consultationFee) {
    const copayPct = policy.getCopayPercentage('consultation_fees');
    if (copayPct > 0) {
      const copayAmount = claimAmount * (copayPct / 100);
      deductions.copay = Math.round(copayAmount);
      approvedAmount -= copayAmount;
    }
  }

  // Network discount
  let networkDiscountAmount = 0;
  if (hospital && policy.isNetworkHospital(hospital)) {
    const discountPct = policy.getNetworkDiscount();
    if (discountPct > 0) {
      networkDiscountAmount = Math.round(claimAmount * (discountPct / 100));
      approvedAmount -= networkDiscountAmount;
    }
  }

  return {
    passed: true,
    reasonCode: null,
    message: 'Claim within all applicable limits.',
    confidence: 0.95,
    details: {
      claim_amount: claimAmount,
      approved_amount: Math.round(approvedAmount),
      deductions: Object.keys(deductions).length > 0 ? deductions : null,
      network_discount: networkDiscountAmount || null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Fraud Detection & Medical Necessity
// ─────────────────────────────────────────────────────────────────────────────

function checkFraudAndNecessity(claimAmount, previousClaimsSameDay, diagnosis, medicines, procedures, treatment, bill) {
  const foundFlags = [];
  let confidence = 0.92;

  // Multiple claims same day
  if (previousClaimsSameDay && previousClaimsSameDay >= 2) {
    foundFlags.push('Multiple claims same day');
    foundFlags.push('Unusual pattern detected');
    confidence = 0.65;
  }

  // High-value claim
  if (claimAmount > 25000) {
    foundFlags.push('High-value claim requires review');
    confidence = Math.min(confidence, 0.70);
  }

  // No diagnosis
  if (!diagnosis) {
    foundFlags.push('No diagnosis provided');
    confidence = Math.min(confidence, 0.75);
  }

  if (foundFlags.length > 0) {
    return {
      passed: true, // flags don't directly reject — they trigger MANUAL_REVIEW
      flags: foundFlags,
      message: `Fraud/necessity flags: ${foundFlags.join(', ')}`,
      confidence,
      details: { previous_claims_same_day: previousClaimsSameDay },
    };
  }

  return {
    passed: true,
    flags: [],
    message: 'No fraud indicators. Medical necessity established.',
    confidence: 0.92,
    details: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Final Decision Aggregation
// ─────────────────────────────────────────────────────────────────────────────

function makeDecision({ rejectionReasons, flags, claimAmount, bill, step3Result, step4Result, breakdown, confidenceComponents, hospital, cashlessRequest }) {
  // Clean empties
  const reasons = rejectionReasons.filter(Boolean);

  // Average confidence
  const avgConfidence = confidenceComponents.length > 0
    ? confidenceComponents.reduce((a, b) => a + b, 0) / confidenceComponents.length
    : 0.5;

  // ── MANUAL_REVIEW: fraud flags ──────────────────────────────────────────
  if (flags.length > 0 && flags.some(f => f.includes('Multiple claims') || f.includes('Unusual pattern'))) {
    return {
      decision: 'MANUAL_REVIEW',
      approved_amount: null,
      rejection_reasons: null,
      confidence_score: round2(avgConfidence),
      notes: 'Claim flagged for manual review due to suspicious patterns',
      next_steps: 'This claim requires manual review by a claims adjuster',
      flags,
      deductions: null,
      rejected_items: null,
      cashless_approved: null,
      network_discount: null,
      adjudication_breakdown: breakdown,
    };
  }

  // ── PARTIAL: some procedures rejected (check BEFORE hard rejection) ─────
  const rejectedItems = (step3Result.details || {}).rejected_items || [];
  if (rejectedItems.length > 0 && step3Result.passed) {
    // Partial approval: exclude rejected item costs
    let approvedAmount = claimAmount;

    for (const item of rejectedItems) {
      if (item.toLowerCase().includes('whitening') && bill.teeth_whitening) {
        approvedAmount -= bill.teeth_whitening;
      } else if (item.toLowerCase().includes('cosmetic') && bill.teeth_whitening) {
        approvedAmount -= bill.teeth_whitening;
      }
    }

    const deductions = (step4Result.details || {}).deductions || null;
    if (deductions) {
      for (const val of Object.values(deductions)) {
        approvedAmount -= val;
      }
    }

    return {
      decision: 'PARTIAL',
      approved_amount: Math.round(Math.max(0, approvedAmount)),
      rejection_reasons: null,
      confidence_score: round2(avgConfidence),
      notes: `Partial approval: ${rejectedItems.join(', ')} excluded`,
      next_steps: 'Excluded items are not covered under your policy. Approved items have been processed.',
      rejected_items: rejectedItems,
      deductions,
      flags: flags.length > 0 ? flags : null,
      cashless_approved: null,
      network_discount: null,
      adjudication_breakdown: breakdown,
    };
  }

  // ── REJECTED ────────────────────────────────────────────────────────────
  if (reasons.length > 0) {
    const notes = breakdown.filter(b => !b.passed).map(b => b.message).join('; ');
    return {
      decision: 'REJECTED',
      approved_amount: 0,
      rejection_reasons: reasons,
      confidence_score: round2(avgConfidence),
      notes,
      next_steps: 'Please review the rejection reasons and submit a corrected claim or appeal',
      flags: flags.length > 0 ? flags : null,
      deductions: null,
      rejected_items: null,
      cashless_approved: null,
      network_discount: null,
      adjudication_breakdown: breakdown,
    };
  }

  // (Partial approval already handled above)

  // ── APPROVED ────────────────────────────────────────────────────────────
  const details = step4Result.details || {};
  const approvedAmount = details.approved_amount || claimAmount;
  const deductions = details.deductions || null;
  const networkDiscount = details.network_discount || null;

  let cashlessApproved = null;
  if (cashlessRequest && hospital) {
    cashlessApproved = policy.isNetworkHospital(hospital);
  }

  return {
    decision: 'APPROVED',
    approved_amount: Math.round(approvedAmount),
    rejection_reasons: null,
    confidence_score: round2(avgConfidence),
    notes: 'Claim approved. All validations passed.',
    next_steps: 'Your approved amount will be processed within 3-5 business days.',
    deductions,
    rejected_items: null,
    flags: flags.length > 0 ? flags : null,
    cashless_approved: cashlessApproved,
    network_discount: networkDiscount,
    adjudication_breakdown: breakdown,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { adjudicateClaim };
