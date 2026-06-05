/**
 * Policy Service — Loads policy terms and provides lookup methods.
 *
 * All business rule data comes from policy_terms.json.
 * This service provides clean access methods used by the rule engine.
 */

const path = require('path');
const POLICY = require(path.join(__dirname, '..', 'data', 'policy_terms.json'));

// ─── Basic Getters ───────────────────────────────────────────────────────────

function getPolicyTerms() {
  return POLICY;
}

function getCoverageDetails() {
  return POLICY.coverage_details || {};
}

function getExclusions() {
  return POLICY.exclusions || [];
}

function getWaitingPeriods() {
  return POLICY.waiting_periods || {};
}

function getClaimRequirements() {
  return POLICY.claim_requirements || {};
}

function getNetworkHospitals() {
  return POLICY.network_hospitals || [];
}

function getAnnualLimit() {
  return POLICY.coverage_details.annual_limit;
}

function getPerClaimLimit() {
  return POLICY.coverage_details.per_claim_limit;
}

function getMinimumClaimAmount() {
  return POLICY.claim_requirements.minimum_claim_amount || 500;
}

// ─── Co-pay ──────────────────────────────────────────────────────────────────

function getCopayPercentage(category) {
  const coverage = POLICY.coverage_details;
  if (coverage[category] && typeof coverage[category] === 'object') {
    return coverage[category].copay_percentage || 0;
  }
  return 0;
}

// ─── Network Hospital Check ─────────────────────────────────────────────────

function isNetworkHospital(hospitalName) {
  if (!hospitalName) return false;
  const network = getNetworkHospitals();
  const lower = hospitalName.toLowerCase();
  return network.some(h => h.toLowerCase().includes(lower) || lower.includes(h.toLowerCase()));
}

function getNetworkDiscount() {
  return POLICY.coverage_details.consultation_fees.network_discount || 0;
}

// ─── Exclusion Check ─────────────────────────────────────────────────────────

/**
 * Check if a diagnosis or treatment falls under exclusions.
 * @returns {{ isExcluded: boolean, match: string|null }}
 */
function isExcluded(diagnosis, treatment = '') {
  const exclusions = getExclusions();
  const combined = `${diagnosis} ${treatment}`.toLowerCase();

  const exclusionKeywords = {
    'cosmetic procedures': ['cosmetic', 'whitening', 'aesthetic', 'beauty'],
    'weight loss treatments': ['weight loss', 'obesity', 'bariatric', 'diet plan'],
    'infertility treatments': ['infertility', 'ivf', 'fertility'],
    'experimental treatments': ['experimental', 'unproven', 'trial'],
    'self-inflicted injuries': ['self-inflicted', 'self harm'],
    'adventure sports injuries': ['adventure sport', 'bungee', 'skydiving'],
    'vitamins and supplements (unless prescribed for deficiency)': ['vitamin', 'supplement'],
    'alcoholism/drug abuse treatment': ['alcoholism', 'drug abuse', 'addiction'],
    'hiv/aids treatment': ['hiv', 'aids'],
  };

  for (const exclusion of exclusions) {
    const lowerExclusion = exclusion.toLowerCase();
    const keywords = exclusionKeywords[lowerExclusion] || [lowerExclusion.split('(')[0].trim()];

    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        // Special case: vitamins prescribed for deficiency are OK
        if (keyword === 'vitamin' && combined.includes('deficiency')) continue;
        return { isExcluded: true, match: exclusion };
      }
    }
  }

  return { isExcluded: false, match: null };
}

// ─── Waiting Period Check ────────────────────────────────────────────────────

/**
 * Check if the waiting period has been satisfied.
 * @returns {{ satisfied: boolean, message: string|null }}
 */
function checkWaitingPeriod(memberJoinDate, treatmentDate, diagnosis) {
  if (!memberJoinDate) return { satisfied: true, message: null };

  let joinDt, treatDt;
  try {
    joinDt = new Date(memberJoinDate);
    treatDt = new Date(treatmentDate);
  } catch {
    return { satisfied: true, message: null };
  }

  if (isNaN(joinDt.getTime()) || isNaN(treatDt.getTime())) {
    return { satisfied: true, message: null };
  }

  const daysSinceJoin = Math.floor((treatDt - joinDt) / (1000 * 60 * 60 * 24));
  const waiting = getWaitingPeriods();

  // Initial waiting period
  if (daysSinceJoin < (waiting.initial_waiting || 30)) {
    const eligibleDate = new Date(joinDt);
    eligibleDate.setDate(eligibleDate.getDate() + waiting.initial_waiting);
    return {
      satisfied: false,
      message: `Initial waiting period of ${waiting.initial_waiting} days not satisfied. Eligible from ${eligibleDate.toISOString().split('T')[0]}`,
    };
  }

  // Specific ailment waiting periods
  const diagnosisLower = diagnosis.toLowerCase();
  const specific = waiting.specific_ailments || {};

  for (const [ailment, periodDays] of Object.entries(specific)) {
    if (diagnosisLower.includes(ailment.toLowerCase())) {
      if (daysSinceJoin < periodDays) {
        const eligibleDate = new Date(joinDt);
        eligibleDate.setDate(eligibleDate.getDate() + periodDays);
        return {
          satisfied: false,
          message: `${ailment.charAt(0).toUpperCase() + ailment.slice(1)} has ${periodDays}-day waiting period. Eligible from ${eligibleDate.toISOString().split('T')[0]}`,
        };
      }
    }
  }

  // Pre-existing diseases
  const preExistingKeywords = ['diabetes', 'hypertension', 'asthma', 'thyroid', 'heart disease'];
  for (const kw of preExistingKeywords) {
    if (diagnosisLower.includes(kw)) {
      const preExistingPeriod = waiting.pre_existing_diseases || 365;
      if (daysSinceJoin < preExistingPeriod) {
        const eligibleDate = new Date(joinDt);
        eligibleDate.setDate(eligibleDate.getDate() + preExistingPeriod);
        return {
          satisfied: false,
          message: `Pre-existing condition (${kw}) has ${preExistingPeriod}-day waiting period. Eligible from ${eligibleDate.toISOString().split('T')[0]}`,
        };
      }
    }
  }

  return { satisfied: true, message: null };
}

// ─── Pre-authorization Check ─────────────────────────────────────────────────

function requiresPreAuth(treatment, claimAmount) {
  if (!treatment) return false;
  const lower = treatment.toLowerCase();
  // MRI and CT Scan require pre-auth per policy
  if (lower.includes('mri') || lower.includes('ct scan')) return true;
  return false;
}

module.exports = {
  getPolicyTerms,
  getCoverageDetails,
  getExclusions,
  getWaitingPeriods,
  getClaimRequirements,
  getNetworkHospitals,
  getAnnualLimit,
  getPerClaimLimit,
  getMinimumClaimAmount,
  getCopayPercentage,
  isNetworkHospital,
  getNetworkDiscount,
  isExcluded,
  checkWaitingPeriod,
  requiresPreAuth,
};
