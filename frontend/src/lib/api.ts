/**
 * API client for the OPD Claims backend.
 * All backend communication goes through here.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrescriptionData {
  doctor_name?: string;
  doctor_reg?: string;
  diagnosis?: string;
  medicines_prescribed?: string[];
  procedures?: string[];
  treatment?: string;
  tests_prescribed?: string[];
}

export interface BillData {
  consultation_fee?: number;
  diagnostic_tests?: number;
  test_names?: string[];
  medicines?: number;
  root_canal?: number;
  teeth_whitening?: number;
  therapy_charges?: number;
  mri_scan?: number;
  diet_plan?: number;
}

export interface ClaimSubmitData {
  member_id: string;
  member_name: string;
  member_join_date?: string;
  treatment_date: string;
  claim_amount: number;
  hospital?: string;
  cashless_request?: boolean;
  previous_claims_same_day?: number;
  documents: {
    prescription?: PrescriptionData;
    bill?: BillData;
  };
}

export interface AdjudicationBreakdown {
  step: number;
  name: string;
  passed: boolean;
  message: string;
  reason_code?: string;
  confidence?: number;
  details?: Record<string, unknown>;
}

export interface Claim {
  id: string;
  claim_number: string;
  member_id: string;
  member_name: string;
  treatment_date: string;
  claim_amount: number;
  status: string;
  decision?: string;
  approved_amount?: number;
  rejection_reasons?: string[];
  confidence_score?: number;
  decision_notes?: string;
  next_steps?: string;
  deductions?: Record<string, number>;
  rejected_items?: string[];
  cashless_approved?: boolean;
  network_discount?: number;
  flags?: string[];
  adjudication_breakdown?: AdjudicationBreakdown[];
  extracted_data?: Record<string, unknown>;
  documents_metadata?: Array<Record<string, unknown>>;
  hospital_name?: string;
  created_at?: string;
}

export interface ClaimListResponse {
  claims: Claim[];
  total: number;
  stats: {
    total: number;
    approved: number;
    rejected: number;
    partial: number;
    manual_review: number;
    pending: number;
    total_claimed: number;
    total_approved: number;
  };
}

export interface TestCaseResult {
  case_id: string;
  case_name: string;
  description: string;
  expected_decision: string;
  actual_decision: string;
  match: boolean;
  expected_amount?: number;
  actual_amount?: number;
  expected_reasons?: string[] | null;
  actual_reasons?: string[] | null;
  actual_confidence?: number;
  actual_notes?: string;
}

export interface TestCaseResults {
  total: number;
  passed: number;
  failed: number;
  pass_rate: string;
  results: TestCaseResult[];
}

// ─── API Functions ───────────────────────────────────────────────────────────

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(error.error || error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/** Submit a new claim with structured JSON data */
export async function submitClaim(data: ClaimSubmitData): Promise<Claim> {
  return fetchAPI<Claim>('/api/claims', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Submit a claim with file uploads */
export async function submitClaimWithFiles(formData: FormData): Promise<Claim> {
  const response = await fetch(`${API_BASE}/api/claims/upload`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type for multipart/form-data — browser handles it
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/** List all claims */
export async function listClaims(status?: string): Promise<ClaimListResponse> {
  const params = status ? `?status=${status}` : '';
  return fetchAPI<ClaimListResponse>(`/api/claims${params}`);
}

/** Get a specific claim */
export async function getClaim(id: string): Promise<Claim> {
  return fetchAPI<Claim>(`/api/claims/${id}`);
}

/** Appeal a claim decision */
export async function appealClaim(id: string, reason: string): Promise<Claim> {
  return fetchAPI<Claim>(`/api/claims/${id}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Get policy terms */
export async function getPolicy(): Promise<{ policy: Record<string, unknown> }> {
  return fetchAPI('/api/policy');
}

/** Run test cases */
export async function runTestCases(): Promise<TestCaseResults> {
  return fetchAPI<TestCaseResults>('/api/policy/test-cases');
}

/** Health check */
export async function healthCheck(): Promise<{ status: string; ai_configured: boolean }> {
  return fetchAPI('/api/health');
}
