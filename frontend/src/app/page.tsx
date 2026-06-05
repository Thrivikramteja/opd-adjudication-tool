'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listClaims, type ClaimListResponse } from '@/lib/api';

export default function Dashboard() {
  const [data, setData] = useState<ClaimListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const result = await listClaims();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.stats || {
    total: 0, approved: 0, rejected: 0, partial: 0,
    manual_review: 0, pending: 0, total_claimed: 0, total_approved: 0,
  };

  const statCards = [
    { label: 'Total Claims', value: stats.total, icon: '📋', color: 'from-indigo-500 to-purple-600' },
    { label: 'Approved', value: stats.approved, icon: '✅', color: 'from-emerald-500 to-teal-600' },
    { label: 'Rejected', value: stats.rejected, icon: '❌', color: 'from-rose-500 to-red-600' },
    { label: 'Partial', value: stats.partial, icon: '⚠️', color: 'from-amber-500 to-orange-600' },
    { label: 'Manual Review', value: stats.manual_review, icon: '🔍', color: 'from-blue-500 to-cyan-600' },
    { label: 'Total Claimed', value: `₹${stats.total_claimed.toLocaleString()}`, icon: '💰', color: 'from-violet-500 to-fuchsia-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Hero Section */}
      <div className="mb-10 slide-up">
        <h1 className="text-4xl font-bold gradient-text mb-3">Dashboard</h1>
        <p className="text-slate-400 text-lg">
          AI-powered OPD claim adjudication at a glance
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="glass-card border-rose-500/30 bg-rose-500/5 p-4 mb-8 slide-up">
          <p className="text-rose-400 text-sm">
            ⚠️ {error} — Make sure the backend is running on{' '}
            <code className="text-rose-300">http://localhost:8000</code>
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-4 mb-10 slide-up slide-up-delay-1">
        <Link href="/claims/new" className="btn-primary text-base px-8 py-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Submit New Claim
        </Link>
        <Link href="/test-cases" className="btn-secondary text-base px-8 py-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          Run Test Cases
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {statCards.map((stat, i) => (
          <div
            key={stat.label}
            className={`glass-card glass-card-hover p-5 slide-up slide-up-delay-${Math.min(i + 1, 4)}`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white mb-1">
              {loading ? <span className="spinner inline-block" /> : stat.value}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Claims */}
      <div className="glass-card p-6 slide-up slide-up-delay-3">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Claims</h2>
          <Link href="/claims" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : data?.claims && data.claims.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="text-left pb-3 pr-4">Claim #</th>
                  <th className="text-left pb-3 pr-4">Member</th>
                  <th className="text-left pb-3 pr-4">Date</th>
                  <th className="text-right pb-3 pr-4">Amount</th>
                  <th className="text-center pb-3 pr-4">Status</th>
                  <th className="text-right pb-3 pr-4">Approved</th>
                  <th className="text-center pb-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {data.claims.slice(0, 10).map((claim) => (
                  <tr
                    key={claim.id}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/claims/${claim.id}`}
                  >
                    <td className="py-3 pr-4">
                      <span className="text-indigo-400 font-mono text-xs">{claim.claim_number}</span>
                    </td>
                    <td className="py-3 pr-4 text-white">{claim.member_name}</td>
                    <td className="py-3 pr-4 text-slate-400">{claim.treatment_date}</td>
                    <td className="py-3 pr-4 text-right text-white">₹{claim.claim_amount?.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-center">
                      <StatusBadge status={claim.status} />
                    </td>
                    <td className="py-3 pr-4 text-right text-emerald-400">
                      {claim.approved_amount != null ? `₹${claim.approved_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 text-center">
                      {claim.confidence_score != null ? (
                        <span className={`text-xs font-mono ${claim.confidence_score >= 0.9 ? 'text-emerald-400' : claim.confidence_score >= 0.7 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {(claim.confidence_score * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">📋</div>
            <p>No claims yet. Submit your first claim to get started.</p>
            <Link href="/claims/new" className="btn-primary mt-4 inline-flex">
              Submit New Claim
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: 'badge-approved',
    REJECTED: 'badge-rejected',
    PARTIAL: 'badge-partial',
    MANUAL_REVIEW: 'badge-manual-review',
    PENDING: 'badge-pending',
    PROCESSING: 'badge-pending',
  };

  return (
    <span className={`badge ${styles[status] || 'badge-pending'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
