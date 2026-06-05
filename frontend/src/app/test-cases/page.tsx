'use client';

import { useState } from 'react';
import { runTestCases, type TestCaseResults, type TestCaseResult } from '@/lib/api';

export default function TestCasesPage() {
  const [results, setResults] = useState<TestCaseResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const data = await runTestCases();
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run test cases');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8 slide-up">
        <h1 className="text-3xl font-bold gradient-text mb-2">Test Case Runner</h1>
        <p className="text-slate-400">
          Validate the rule engine against the 10 provided test cases
        </p>
      </div>

      {/* Run Button */}
      <div className="mb-8 slide-up slide-up-delay-1">
        <button onClick={handleRun} disabled={loading} className="btn-primary px-8 py-3 text-base">
          {loading ? (
            <><span className="spinner" /> Running 10 test cases...</>
          ) : (
            '🧪 Run All Test Cases'
          )}
        </button>
      </div>

      {error && (
        <div className="glass-card border-rose-500/30 bg-rose-500/5 p-4 mb-8">
          <p className="text-rose-400 text-sm">❌ {error}</p>
        </div>
      )}

      {/* Results Summary */}
      {results && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8 slide-up slide-up-delay-2">
            <div className="glass-card p-5 text-center">
              <div className="text-3xl font-bold text-white mb-1">{results.total}</div>
              <div className="text-xs text-slate-500 uppercase">Total</div>
            </div>
            <div className="glass-card p-5 text-center">
              <div className="text-3xl font-bold text-emerald-400 mb-1">{results.passed}</div>
              <div className="text-xs text-slate-500 uppercase">Passed</div>
            </div>
            <div className="glass-card p-5 text-center">
              <div className="text-3xl font-bold text-rose-400 mb-1">{results.failed}</div>
              <div className="text-xs text-slate-500 uppercase">Failed</div>
            </div>
            <div className="glass-card p-5 text-center pulse-glow">
              <div className={`text-3xl font-bold mb-1 ${results.passed === results.total ? 'text-emerald-400' : 'text-amber-400'}`}>
                {results.pass_rate}
              </div>
              <div className="text-xs text-slate-500 uppercase">Pass Rate</div>
            </div>
          </div>

          {/* Individual Results */}
          <div className="space-y-3 slide-up slide-up-delay-3">
            {results.results.map((tc: TestCaseResult) => (
              <div
                key={tc.case_id}
                className={`glass-card p-5 border ${tc.match ? 'border-emerald-500/15 bg-emerald-500/3' : 'border-rose-500/15 bg-rose-500/3'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl ${tc.match ? 'step-pass' : 'step-fail'}`}>
                      {tc.match ? '✓' : '✗'}
                    </span>
                    <div>
                      <span className="text-white font-medium">{tc.case_id}: {tc.case_name}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{tc.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {tc.actual_confidence != null && (
                      <span className="text-xs text-slate-500 font-mono">
                        {(tc.actual_confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-6 ml-9 mt-2">
                  <div>
                    <span className="text-xs text-slate-500">Expected: </span>
                    <span className={`badge text-xs ${tc.expected_decision === 'APPROVED' ? 'badge-approved' : tc.expected_decision === 'REJECTED' ? 'badge-rejected' : tc.expected_decision === 'PARTIAL' ? 'badge-partial' : 'badge-manual-review'}`}>
                      {tc.expected_decision}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Actual: </span>
                    <span className={`badge text-xs ${tc.actual_decision === 'APPROVED' ? 'badge-approved' : tc.actual_decision === 'REJECTED' ? 'badge-rejected' : tc.actual_decision === 'PARTIAL' ? 'badge-partial' : 'badge-manual-review'}`}>
                      {tc.actual_decision}
                    </span>
                  </div>
                  {tc.expected_amount != null && (
                    <div>
                      <span className="text-xs text-slate-500">Expected ₹: </span>
                      <span className="text-xs text-white">{tc.expected_amount}</span>
                    </div>
                  )}
                  {tc.actual_amount != null && (
                    <div>
                      <span className="text-xs text-slate-500">Actual ₹: </span>
                      <span className="text-xs text-white">{tc.actual_amount}</span>
                    </div>
                  )}
                </div>

                {tc.actual_notes && (
                  <p className="text-xs text-slate-500 ml-9 mt-2 italic">{tc.actual_notes}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
