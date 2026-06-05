'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listClaims, type Claim } from '@/lib/api';

export default function ClaimsListPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadClaims();
  }, [filter]);

  async function loadClaims() {
    try {
      setLoading(true);
      const result = await listClaims(filter || undefined);
      setClaims(result.claims);
    } catch {
      // Backend likely not running
    } finally {
      setLoading(false);
    }
  }

  const filters = [
    { label: 'All', value: '' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Partial', value: 'PARTIAL' },
    { label: 'Manual Review', value: 'MANUAL_REVIEW' },
  ];

  const badgeClass: Record<string, string> = {
    APPROVED: 'badge-approved',
    REJECTED: 'badge-rejected',
    PARTIAL: 'badge-partial',
    MANUAL_REVIEW: 'badge-manual-review',
    PENDING: 'badge-pending',
    PROCESSING: 'badge-pending',
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8 slide-up">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">All Claims</h1>
          <p className="text-slate-400">{claims.length} claims found</p>
        </div>
        <Link href="/claims/new" className="btn-primary">+ New Claim</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 slide-up slide-up-delay-1">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${filter === f.value ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Claims Table */}
      <div className="glass-card overflow-hidden slide-up slide-up-delay-2">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="spinner" /></div>
        ) : claims.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">📋</div>
            <p>No claims found{filter ? ` with status "${filter}"` : ''}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="text-left p-4">Claim #</th>
                  <th className="text-left p-4">Member</th>
                  <th className="text-left p-4">Treatment Date</th>
                  <th className="text-right p-4">Amount</th>
                  <th className="text-center p-4">Status</th>
                  <th className="text-right p-4">Approved</th>
                  <th className="text-center p-4">Confidence</th>
                  <th className="text-right p-4">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(claim => (
                  <tr key={claim.id} className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer" onClick={() => router.push(`/claims/${claim.id}`)}>
                      <td className="p-4">
                        <span className="text-indigo-400 font-mono text-xs">{claim.claim_number}</span>
                      </td>
                      <td className="p-4">
                        <div className="text-white font-medium">{claim.member_name}</div>
                        <div className="text-xs text-slate-500">{claim.member_id}</div>
                      </td>
                      <td className="p-4 text-slate-400">{claim.treatment_date}</td>
                      <td className="p-4 text-right text-white font-medium">₹{claim.claim_amount?.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className={`badge ${badgeClass[claim.status] || 'badge-pending'}`}>
                          {claim.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right text-emerald-400 font-medium">
                        {claim.approved_amount != null ? `₹${claim.approved_amount.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-4 text-center">
                        {claim.confidence_score != null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-mono">{(claim.confidence_score * 100).toFixed(0)}%</span>
                            <div className="confidence-bar w-12">
                              <div
                                className="confidence-bar-fill"
                                style={{
                                  width: `${claim.confidence_score * 100}%`,
                                  background: claim.confidence_score >= 0.9 ? '#34d399' : claim.confidence_score >= 0.7 ? '#fbbf24' : '#f87171',
                                }}
                              />
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-right text-slate-500 text-xs">
                        {claim.created_at ? new Date(claim.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
