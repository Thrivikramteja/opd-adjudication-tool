'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getClaim, appealClaim, type Claim } from '@/lib/api';

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [appealing, setAppealing] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [showAppeal, setShowAppeal] = useState(false);

  useEffect(() => {
    loadClaim();
  }, [params.id]);

  async function loadClaim() {
    try {
      setLoading(true);
      const result = await getClaim(params.id as string);
      setClaim(result);
    } catch {
      // not found
    } finally {
      setLoading(false);
    }
  }

  async function handleAppeal() {
    if (!claim) return;
    setAppealing(true);
    try {
      const updated = await appealClaim(claim.id, appealReason);
      setClaim(updated);
      setShowAppeal(false);
    } catch {
      // error
    } finally {
      setAppealing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-white mb-2">Claim Not Found</h2>
        <p className="text-slate-400 mb-6">The claim you&apos;re looking for doesn&apos;t exist.</p>
        <button onClick={() => router.push('/claims')} className="btn-primary">← Back to Claims</button>
      </div>
    );
  }

  const decisionConfig: Record<string, { icon: string; gradient: string; label: string; badgeClass: string }> = {
    APPROVED: { icon: '✅', gradient: 'from-emerald-500 to-teal-600', label: 'Approved', badgeClass: 'badge-approved' },
    REJECTED: { icon: '❌', gradient: 'from-rose-500 to-red-600', label: 'Rejected', badgeClass: 'badge-rejected' },
    PARTIAL: { icon: '⚠️', gradient: 'from-amber-500 to-orange-600', label: 'Partially Approved', badgeClass: 'badge-partial' },
    MANUAL_REVIEW: { icon: '🔍', gradient: 'from-blue-500 to-cyan-600', label: 'Manual Review', badgeClass: 'badge-manual-review' },
  };
  const dc = decisionConfig[claim.status] || decisionConfig.MANUAL_REVIEW;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back button */}
      <button onClick={() => router.push('/claims')} className="text-sm text-slate-400 hover:text-white mb-6 flex items-center gap-1 transition-colors">
        ← Back to Claims
      </button>

      {/* Decision Hero Card */}
      <div className={`glass-card p-8 mb-8 slide-up overflow-hidden relative`}>
        <div className={`absolute inset-0 bg-gradient-to-r ${dc.gradient} opacity-5`} />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-sm text-slate-400 mb-1 font-mono">{claim.claim_number}</div>
              <h1 className="text-3xl font-bold text-white mb-1">{dc.icon} {dc.label}</h1>
              <p className="text-slate-400">{claim.member_name} • {claim.treatment_date}</p>
            </div>
            <span className={`badge ${dc.badgeClass} text-base px-5 py-2`}>{claim.status?.replace('_', ' ')}</span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase mb-1">Claimed</div>
              <div className="text-xl font-bold text-white">₹{claim.claim_amount?.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase mb-1">Approved</div>
              <div className="text-xl font-bold text-emerald-400">
                {claim.approved_amount != null ? `₹${claim.approved_amount.toLocaleString()}` : '—'}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase mb-1">Confidence</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">
                  {claim.confidence_score != null ? `${(claim.confidence_score * 100).toFixed(0)}%` : '—'}
                </span>
                {claim.confidence_score != null && (
                  <div className="confidence-bar flex-1">
                    <div className="confidence-bar-fill" style={{
                      width: `${claim.confidence_score * 100}%`,
                      background: claim.confidence_score >= 0.9 ? '#34d399' : claim.confidence_score >= 0.7 ? '#fbbf24' : '#f87171',
                    }} />
                  </div>
                )}
              </div>
            </div>
            {claim.network_discount != null && claim.network_discount > 0 && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase mb-1">Network Discount</div>
                <div className="text-xl font-bold text-indigo-400">₹{claim.network_discount?.toLocaleString()}</div>
              </div>
            )}
            {claim.cashless_approved != null && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase mb-1">Cashless</div>
                <div className="text-xl font-bold">{claim.cashless_approved ? '✅ Yes' : '❌ No'}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes & Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {claim.decision_notes && (
          <div className="glass-card p-6 slide-up slide-up-delay-1">
            <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Decision Notes</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{claim.decision_notes}</p>
          </div>
        )}
        {claim.next_steps && (
          <div className="glass-card p-6 slide-up slide-up-delay-2">
            <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Next Steps</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{claim.next_steps}</p>
          </div>
        )}
      </div>

      {/* Rejection Reasons / Rejected Items / Flags */}
      {(claim.rejection_reasons?.length || claim.rejected_items?.length || claim.flags?.length) && (
        <div className="glass-card p-6 mb-8 slide-up slide-up-delay-2">
          {claim.rejection_reasons && claim.rejection_reasons.length > 0 && (
            <div className="mb-4">
              <h3 className="text-rose-400 font-semibold mb-2 text-sm uppercase tracking-wider">Rejection Reasons</h3>
              <div className="flex flex-wrap gap-2">
                {claim.rejection_reasons.map((r, i) => (
                  <span key={i} className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-mono">{r}</span>
                ))}
              </div>
            </div>
          )}
          {claim.rejected_items && claim.rejected_items.length > 0 && (
            <div className="mb-4">
              <h3 className="text-amber-400 font-semibold mb-2 text-sm uppercase tracking-wider">Excluded Items</h3>
              <div className="flex flex-wrap gap-2">
                {claim.rejected_items.map((r, i) => (
                  <span key={i} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs">{r}</span>
                ))}
              </div>
            </div>
          )}
          {claim.deductions && Object.keys(claim.deductions).length > 0 && (
            <div className="mb-4">
              <h3 className="text-indigo-400 font-semibold mb-2 text-sm uppercase tracking-wider">Deductions</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(claim.deductions).map(([key, val]) => (
                  <span key={key} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 text-xs">
                    {key}: ₹{(val as number).toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )}
          {claim.flags && claim.flags.length > 0 && (
            <div>
              <h3 className="text-blue-400 font-semibold mb-2 text-sm uppercase tracking-wider">Flags</h3>
              <div className="flex flex-wrap gap-2">
                {claim.flags.map((f, i) => (
                  <span key={i} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs">🚩 {f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjudication Breakdown */}
      {claim.adjudication_breakdown && claim.adjudication_breakdown.length > 0 && (
        <div className="glass-card p-6 mb-8 slide-up slide-up-delay-3">
          <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
            Adjudication Breakdown — 5-Step Analysis
          </h3>
          <div className="space-y-3">
            {claim.adjudication_breakdown.map((step) => (
              <div
                key={step.step}
                className={`p-4 rounded-xl border ${step.passed ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-rose-500/5 border-rose-500/15'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-lg ${step.passed ? 'step-pass' : 'step-fail'}`}>
                    {step.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-white font-medium text-sm">Step {step.step}: {step.name}</span>
                  {step.confidence != null && (
                    <span className="text-xs text-slate-500 ml-auto font-mono">
                      confidence: {(step.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className={`text-xs ml-8 ${step.passed ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                  {step.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Data */}
      {claim.extracted_data && Object.keys(claim.extracted_data).length > 0 && (
        <div className="glass-card p-6 mb-8 slide-up slide-up-delay-4">
          <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Submitted / Extracted Data</h3>
          <pre className="text-xs text-slate-400 bg-black/20 p-4 rounded-xl overflow-x-auto">
            {JSON.stringify(claim.extracted_data, null, 2)}
          </pre>
        </div>
      )}

      {/* Appeal Section */}
      {['REJECTED', 'PARTIAL'].includes(claim.status) && (
        <div className="glass-card p-6 slide-up slide-up-delay-4">
          <h3 className="text-white font-semibold mb-4">Appeal This Decision</h3>
          {!showAppeal ? (
            <button onClick={() => setShowAppeal(true)} className="btn-secondary">
              📝 File an Appeal
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                className="form-input min-h-[100px]"
                placeholder="Explain why you believe this decision should be reconsidered..."
                value={appealReason}
                onChange={e => setAppealReason(e.target.value)}
              />
              <div className="flex gap-3">
                <button onClick={handleAppeal} disabled={appealing} className="btn-primary">
                  {appealing ? 'Submitting...' : 'Submit Appeal'}
                </button>
                <button onClick={() => setShowAppeal(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
