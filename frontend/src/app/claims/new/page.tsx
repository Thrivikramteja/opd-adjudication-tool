'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitClaim, submitClaimWithFiles, type ClaimSubmitData } from '@/lib/api';

type TabType = 'manual' | 'upload';

export default function NewClaimPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual entry form state
  const [form, setForm] = useState({
    member_id: '',
    member_name: '',
    member_join_date: '',
    treatment_date: '',
    claim_amount: '',
    hospital: '',
    cashless_request: false,
    previous_claims_same_day: '0',
    // Prescription
    doctor_name: '',
    doctor_reg: '',
    diagnosis: '',
    medicines: '',
    procedures: '',
    treatment: '',
    tests_prescribed: '',
    // Bill
    consultation_fee: '',
    diagnostic_tests: '',
    medicines_amount: '',
    root_canal: '',
    teeth_whitening: '',
    therapy_charges: '',
    mri_scan: '',
    diet_plan: '',
  });

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    member_id: '',
    member_name: '',
    member_join_date: '',
    treatment_date: '',
    claim_amount: '',
    hospital: '',
    cashless_request: false,
  });
  const [files, setFiles] = useState<File[]>([]);

  function updateForm(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateUploadForm(field: string, value: string | boolean) {
    setUploadForm(prev => ({ ...prev, [field]: value }));
  }

  // ─── Manual Submit ─────────────────────────────────────────────────────

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const prescription: Record<string, unknown> = {};
      if (form.doctor_name) prescription.doctor_name = form.doctor_name;
      if (form.doctor_reg) prescription.doctor_reg = form.doctor_reg;
      if (form.diagnosis) prescription.diagnosis = form.diagnosis;
      if (form.medicines) prescription.medicines_prescribed = form.medicines.split(',').map(s => s.trim()).filter(Boolean);
      if (form.procedures) prescription.procedures = form.procedures.split(',').map(s => s.trim()).filter(Boolean);
      if (form.treatment) prescription.treatment = form.treatment;
      if (form.tests_prescribed) prescription.tests_prescribed = form.tests_prescribed.split(',').map(s => s.trim()).filter(Boolean);

      const bill: Record<string, unknown> = {};
      if (form.consultation_fee) bill.consultation_fee = parseFloat(form.consultation_fee);
      if (form.diagnostic_tests) bill.diagnostic_tests = parseFloat(form.diagnostic_tests);
      if (form.medicines_amount) bill.medicines = parseFloat(form.medicines_amount);
      if (form.root_canal) bill.root_canal = parseFloat(form.root_canal);
      if (form.teeth_whitening) bill.teeth_whitening = parseFloat(form.teeth_whitening);
      if (form.therapy_charges) bill.therapy_charges = parseFloat(form.therapy_charges);
      if (form.mri_scan) bill.mri_scan = parseFloat(form.mri_scan);
      if (form.diet_plan) bill.diet_plan = parseFloat(form.diet_plan);

      const data: ClaimSubmitData = {
        member_id: form.member_id,
        member_name: form.member_name,
        member_join_date: form.member_join_date || undefined,
        treatment_date: form.treatment_date,
        claim_amount: parseFloat(form.claim_amount),
        hospital: form.hospital || undefined,
        cashless_request: form.cashless_request,
        previous_claims_same_day: parseInt(form.previous_claims_same_day) || 0,
        documents: {
          prescription: Object.keys(prescription).length > 0 ? prescription : undefined,
          bill: Object.keys(bill).length > 0 ? bill : undefined,
        },
      };

      const result = await submitClaim(data);
      router.push(`/claims/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  // ─── Upload Submit ─────────────────────────────────────────────────────

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('member_id', uploadForm.member_id);
      formData.append('member_name', uploadForm.member_name);
      formData.append('treatment_date', uploadForm.treatment_date);
      formData.append('claim_amount', uploadForm.claim_amount);
      if (uploadForm.member_join_date) formData.append('member_join_date', uploadForm.member_join_date);
      if (uploadForm.hospital) formData.append('hospital', uploadForm.hospital);
      formData.append('cashless_request', String(uploadForm.cashless_request));

      for (const file of files) {
        formData.append('files', file);
      }

      const result = await submitClaimWithFiles(formData);
      router.push(`/claims/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  // ─── Pre-fill Test Case ─────────────────────────────────────────────────

  function prefillTestCase(caseNum: number) {
    const cases: Record<number, typeof form> = {
      1: { ...form, member_id: 'EMP001', member_name: 'Rajesh Kumar', treatment_date: '2024-11-01', claim_amount: '1500', doctor_name: 'Dr. Sharma', doctor_reg: 'KA/45678/2015', diagnosis: 'Viral fever', medicines: 'Paracetamol 650mg, Vitamin C', consultation_fee: '1000', diagnostic_tests: '500' },
      2: { ...form, member_id: 'EMP002', member_name: 'Priya Singh', treatment_date: '2024-10-15', claim_amount: '12000', doctor_name: 'Dr. Patel', doctor_reg: 'MH/23456/2018', diagnosis: 'Tooth decay requiring root canal', procedures: 'Root canal treatment, Teeth whitening', root_canal: '8000', teeth_whitening: '4000' },
      3: { ...form, member_id: 'EMP003', member_name: 'Amit Verma', treatment_date: '2024-10-20', claim_amount: '7500', doctor_name: 'Dr. Gupta', doctor_reg: 'DL/34567/2016', diagnosis: 'Gastroenteritis', medicines: 'Antibiotics, Probiotics', consultation_fee: '2000', medicines_amount: '5500' },
      4: { ...form, member_id: 'EMP004', member_name: 'Sneha Reddy', treatment_date: '2024-10-25', claim_amount: '2000', consultation_fee: '1500', medicines_amount: '500' },
      5: { ...form, member_id: 'EMP005', member_name: 'Vikram Joshi', member_join_date: '2024-09-01', treatment_date: '2024-10-15', claim_amount: '3000', doctor_name: 'Dr. Mehta', doctor_reg: 'GJ/56789/2014', diagnosis: 'Type 2 Diabetes', medicines: 'Metformin, Glimepiride', consultation_fee: '1000', medicines_amount: '2000' },
    };
    if (cases[caseNum]) setForm(cases[caseNum]);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8 slide-up">
        <h1 className="text-3xl font-bold gradient-text mb-2">Submit New Claim</h1>
        <p className="text-slate-400">Enter claim details manually or upload documents for AI extraction</p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 mb-8 p-1 glass-card inline-flex slide-up slide-up-delay-1">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          📝 Manual Entry
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          📄 Document Upload
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card border-rose-500/30 bg-rose-500/5 p-4 mb-6">
          <p className="text-rose-400 text-sm">❌ {error}</p>
        </div>
      )}

      {/* ─── Manual Entry Tab ──────────────────────────────────────── */}
      {activeTab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-6 slide-up slide-up-delay-2">
          {/* Quick Fill Test Cases */}
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Quick Fill — Test Cases</p>
            <div className="flex flex-wrap gap-2">
              {[
                { n: 1, label: 'TC1: Approved', color: 'text-emerald-400' },
                { n: 2, label: 'TC2: Partial', color: 'text-amber-400' },
                { n: 3, label: 'TC3: Limit Exceeded', color: 'text-rose-400' },
                { n: 4, label: 'TC4: Missing Docs', color: 'text-rose-400' },
                { n: 5, label: 'TC5: Waiting Period', color: 'text-rose-400' },
              ].map(tc => (
                <button key={tc.n} type="button" onClick={() => prefillTestCase(tc.n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium glass-card glass-card-hover ${tc.color}`}>
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Member Info */}
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm">1</span>
              Member Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Member ID *</label>
                <input className="form-input" required value={form.member_id} onChange={e => updateForm('member_id', e.target.value)} placeholder="e.g. EMP001" />
              </div>
              <div>
                <label className="form-label">Member Name *</label>
                <input className="form-input" required value={form.member_name} onChange={e => updateForm('member_name', e.target.value)} placeholder="e.g. Rajesh Kumar" />
              </div>
              <div>
                <label className="form-label">Join Date (if pre-existing condition)</label>
                <input className="form-input" type="date" value={form.member_join_date} onChange={e => updateForm('member_join_date', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Treatment Date *</label>
                <input className="form-input" type="date" required value={form.treatment_date} onChange={e => updateForm('treatment_date', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Claim Amount (₹) *</label>
                <input className="form-input" type="number" required value={form.claim_amount} onChange={e => updateForm('claim_amount', e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div>
                <label className="form-label">Hospital Name</label>
                <input className="form-input" value={form.hospital} onChange={e => updateForm('hospital', e.target.value)} placeholder="e.g. Apollo Hospitals" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input type="checkbox" id="cashless" checked={form.cashless_request} onChange={e => updateForm('cashless_request', e.target.checked)} className="w-4 h-4 rounded border-white/20" />
                <label htmlFor="cashless" className="text-sm text-slate-300">Cashless request</label>
              </div>
              <div>
                <label className="form-label">Previous Claims Same Day</label>
                <input className="form-input" type="number" value={form.previous_claims_same_day} onChange={e => updateForm('previous_claims_same_day', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Prescription */}
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">2</span>
              Prescription Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Doctor Name</label>
                <input className="form-input" value={form.doctor_name} onChange={e => updateForm('doctor_name', e.target.value)} placeholder="e.g. Dr. Sharma" />
              </div>
              <div>
                <label className="form-label">Doctor Reg. Number</label>
                <input className="form-input" value={form.doctor_reg} onChange={e => updateForm('doctor_reg', e.target.value)} placeholder="e.g. KA/45678/2015" />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Diagnosis</label>
                <input className="form-input" value={form.diagnosis} onChange={e => updateForm('diagnosis', e.target.value)} placeholder="e.g. Viral fever" />
              </div>
              <div>
                <label className="form-label">Medicines (comma separated)</label>
                <input className="form-input" value={form.medicines} onChange={e => updateForm('medicines', e.target.value)} placeholder="e.g. Paracetamol 650mg, Vitamin C" />
              </div>
              <div>
                <label className="form-label">Procedures (comma separated)</label>
                <input className="form-input" value={form.procedures} onChange={e => updateForm('procedures', e.target.value)} placeholder="e.g. Root canal treatment" />
              </div>
              <div>
                <label className="form-label">Treatment</label>
                <input className="form-input" value={form.treatment} onChange={e => updateForm('treatment', e.target.value)} placeholder="e.g. Panchakarma therapy" />
              </div>
              <div>
                <label className="form-label">Tests Prescribed (comma separated)</label>
                <input className="form-input" value={form.tests_prescribed} onChange={e => updateForm('tests_prescribed', e.target.value)} placeholder="e.g. MRI Lumbar Spine" />
              </div>
            </div>
          </div>

          {/* Bill */}
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm">3</span>
              Bill Details (₹)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="form-label">Consultation Fee</label>
                <input className="form-input" type="number" value={form.consultation_fee} onChange={e => updateForm('consultation_fee', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Diagnostic Tests</label>
                <input className="form-input" type="number" value={form.diagnostic_tests} onChange={e => updateForm('diagnostic_tests', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Medicines</label>
                <input className="form-input" type="number" value={form.medicines_amount} onChange={e => updateForm('medicines_amount', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Root Canal</label>
                <input className="form-input" type="number" value={form.root_canal} onChange={e => updateForm('root_canal', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Teeth Whitening</label>
                <input className="form-input" type="number" value={form.teeth_whitening} onChange={e => updateForm('teeth_whitening', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Therapy Charges</label>
                <input className="form-input" type="number" value={form.therapy_charges} onChange={e => updateForm('therapy_charges', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">MRI Scan</label>
                <input className="form-input" type="number" value={form.mri_scan} onChange={e => updateForm('mri_scan', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Diet Plan</label>
                <input className="form-input" type="number" value={form.diet_plan} onChange={e => updateForm('diet_plan', e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? <><span className="spinner" /> Processing Claim...</> : '🚀 Submit & Adjudicate'}
          </button>
        </form>
      )}

      {/* ─── Upload Tab ────────────────────────────────────────────── */}
      {activeTab === 'upload' && (
        <form onSubmit={handleUploadSubmit} className="space-y-6 slide-up slide-up-delay-2">
          {/* Member Info (simplified) */}
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4">Member Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Member ID *</label>
                <input className="form-input" required value={uploadForm.member_id} onChange={e => updateUploadForm('member_id', e.target.value)} placeholder="e.g. EMP001" />
              </div>
              <div>
                <label className="form-label">Member Name *</label>
                <input className="form-input" required value={uploadForm.member_name} onChange={e => updateUploadForm('member_name', e.target.value)} placeholder="e.g. Rajesh Kumar" />
              </div>
              <div>
                <label className="form-label">Treatment Date *</label>
                <input className="form-input" type="date" required value={uploadForm.treatment_date} onChange={e => updateUploadForm('treatment_date', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Claim Amount (₹) *</label>
                <input className="form-input" type="number" required value={uploadForm.claim_amount} onChange={e => updateUploadForm('claim_amount', e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div>
                <label className="form-label">Hospital Name</label>
                <input className="form-input" value={uploadForm.hospital} onChange={e => updateUploadForm('hospital', e.target.value)} />
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="glass-card p-6">
            <h3 className="text-white font-semibold mb-4">Upload Documents</h3>
            <div
              className={`dropzone ${files.length > 0 ? 'active' : ''}`}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dropped = Array.from(e.dataTransfer.files);
                setFiles(prev => [...prev, ...dropped]);
              }}
            >
              <div className="text-4xl mb-3">📎</div>
              <p className="text-slate-300 mb-1">Drop files here or click to browse</p>
              <p className="text-xs text-slate-500">Supports: JPG, PNG, WebP, PDF (max 10MB each)</p>
              <input
                id="file-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={e => {
                  if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-slate-300">📄 {file.name}</span>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-rose-400 text-xs hover:text-rose-300">Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
              <p className="text-xs text-indigo-300">
                💡 AI extraction uses <strong>Llama 3.2</strong> via Ollama. Make sure Ollama is running with the model pulled.
                The system will extract patient info, doctor details, diagnosis, and billing from your documents.
              </p>
            </div>
          </div>

          <button type="submit" disabled={loading || files.length === 0} className="btn-primary w-full py-4 text-base">
            {loading ? <><span className="spinner" /> Extracting & Processing...</> : '🚀 Upload & Adjudicate'}
          </button>
        </form>
      )}
    </div>
  );
}
