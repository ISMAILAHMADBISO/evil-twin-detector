import {useEffect, useState, type FormEvent} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import {ClassificationLabel} from '../components/StatusTag';
import type {EvaluationCase, EvaluationMetrics} from '../types';

function formatPercent(val: number | null): string {
  if (val === null || val === undefined) return 'N/A';
  return `${(val * 100).toFixed(2)}%`;
}

export function AnalyticsPage() {
  const [cases, setCases] = useState<EvaluationCase[]>([]);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ssid, setSsid] = useState('');
  const [bssid, setBssid] = useState('');
  const [observedSecurity, setObservedSecurity] = useState('WPA2');
  const [expectedClassification, setExpectedClassification] = useState<
    'Legitimate' | 'Unknown' | 'Simulated Evil Twin'
  >('Simulated Evil Twin');
  const [testDescription, setTestDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadEvaluation() {
    setLoading(true);
    try {
      const res = await apiFetch<{cases: EvaluationCase[]; metrics: EvaluationMetrics}>(
        '/api/evaluation'
      );
      setCases(res.cases);
      setMetrics(res.metrics);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluation data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvaluation();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{case: EvaluationCase; metrics: EvaluationMetrics}>(
        '/api/evaluation/cases',
        {
          method: 'POST',
          body: JSON.stringify({
            ssid,
            bssid,
            observed_security: observedSecurity,
            expected_classification: expectedClassification,
            test_description: testDescription,
          }),
        }
      );
      setCases((prev) => [res.case, ...prev]);
      setMetrics(res.metrics);
      setSsid('');
      setBssid('');
      setTestDescription('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate test case.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await apiFetch<{deleted: boolean; metrics: EvaluationMetrics}>(
      `/api/evaluation/cases/${id}`,
      {method: 'DELETE'}
    );
    setCases((prev) => prev.filter((c) => c.id !== id));
    setMetrics(res.metrics);
  }

  return (
    <div className="space-y-6">
      {/* Add Labelled Test Case */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-100 mb-1">
          Performance Evaluation — Labelled Test Cases
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Submit labelled wireless observations against your active Approved Access Points baseline
          to measure Precision, Detection Rate (Recall), False Positive Rate, and Detection Time.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Test SSID</label>
            <input
              type="text"
              required
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="e.g., CCUK_Campus_WiFi"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Test BSSID</label>
            <input
              type="text"
              required
              value={bssid}
              onChange={(e) => setBssid(e.target.value)}
              placeholder="DE:AD:BE:EF:11:99"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Observed Security</label>
            <select
              value={observedSecurity}
              onChange={(e) => setObservedSecurity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="WPA2">WPA2</option>
              <option value="WPA3">WPA3</option>
              <option value="WPA">WPA</option>
              <option value="Open">Open</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ground Truth Category</label>
            <select
              value={expectedClassification}
              onChange={(e) =>
                setExpectedClassification(
                  e.target.value as 'Legitimate' | 'Unknown' | 'Simulated Evil Twin'
                )
              }
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Legitimate">Legitimate</option>
              <option value="Unknown">Unknown</option>
              <option value="Simulated Evil Twin">Simulated Evil Twin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Test Description</label>
            <input
              type="text"
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              placeholder="Scenario note"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run &amp; Record Case</span>
            </button>
          </div>
        </form>
      </div>

      {/* Metrics Section */}
      {!loading && metrics && !metrics.has_data ? (
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-6 text-sm text-slate-300">
          Evaluation data has not yet been entered. Add labelled test cases above to calculate
          Precision, Detection Rate, False Positive Rate, and Detection Time from real engine
          outputs.
        </div>
      ) : (
        metrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">Precision · TP / (TP + FP)</div>
                <div className="text-2xl font-bold font-mono-tabular text-cyan-400">
                  {formatPercent(metrics.precision)}
                </div>
              </div>
              <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">Detection Rate · TP / (TP + FN)</div>
                <div className="text-2xl font-bold font-mono-tabular text-emerald-400">
                  {formatPercent(metrics.detection_rate)}
                </div>
              </div>
              <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">
                  False Positive Rate · FP / (FP + TN)
                </div>
                <div className="text-2xl font-bold font-mono-tabular text-amber-400">
                  {formatPercent(metrics.false_positive_rate)}
                </div>
              </div>
              <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">Average Detection Time</div>
                <div className="text-2xl font-bold font-mono-tabular text-slate-100">
                  {metrics.avg_detection_time_ms !== null
                    ? `${metrics.avg_detection_time_ms.toFixed(3)} ms`
                    : 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-400">Total Cases</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-100">
                  {metrics.total_cases}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">True Positives (TP)</div>
                <div className="text-lg font-bold font-mono-tabular text-emerald-400">
                  {metrics.tp}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">False Positives (FP)</div>
                <div className="text-lg font-bold font-mono-tabular text-rose-400">{metrics.fp}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">True Negatives (TN)</div>
                <div className="text-lg font-bold font-mono-tabular text-cyan-400">{metrics.tn}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">False Negatives (FN)</div>
                <div className="text-lg font-bold font-mono-tabular text-amber-400">
                  {metrics.fn}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Recorded Cases Table */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">Evaluated Test Cases</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">SSID</th>
                <th className="py-3 px-4 font-medium">BSSID</th>
                <th className="py-3 px-4 font-medium">Security</th>
                <th className="py-3 px-4 font-medium">Ground Truth</th>
                <th className="py-3 px-4 font-medium">Engine Output</th>
                <th className="py-3 px-4 font-medium text-right">Time</th>
                <th className="py-3 px-4 font-medium">Notes</th>
                <th className="py-3 px-4 font-medium text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-slate-400">
                    No evaluation test cases stored yet.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-medium text-slate-100">{c.ssid}</td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-300">
                      {c.bssid}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{c.observed_security}</td>
                    <td className="py-3 px-4 text-xs text-slate-200">
                      {c.expected_classification}
                    </td>
                    <td className="py-3 px-4">
                      <ClassificationLabel classification={c.actual_classification} />
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-right text-slate-300">
                      {c.detection_time_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-xs truncate">
                      {c.test_description || formatTimestamp(c.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        aria-label={`Delete evaluation case ${c.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
