import React, { useState, useEffect } from 'react';
import { AISynthesisResult, CalculatedGrades, EvaluationFormData } from '../types/evaluation';
import {
  Sparkles,
  X,
  Copy,
  Check,
  TrendingUp,
  AlertTriangle,
  FileText,
  RefreshCw,
  Code2,
} from 'lucide-react';

interface AISynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: EvaluationFormData;
  grades: CalculatedGrades;
  onSynthesisSuccess?: (data: AISynthesisResult) => void;
}

export const AISynthesisModal: React.FC<AISynthesisModalProps> = ({
  isOpen,
  onClose,
  formData,
  grades,
  onSynthesisSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AISynthesisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJsonRaw, setShowJsonRaw] = useState(false);

  const runSynthesis = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        year: formData.year,
        company: formData.company,
        evaluatorName: formData.evaluatorName,
        actingSupervisor: formData.isSupervisorMode
          ? `${formData.supervisorName || ''} (${formData.supervisorTitle || ''})`
          : null,
        submissionType: formData.isSupervisorMode
          ? 'SUPERVISOR_DELEGATED'
          : 'DIRECTOR_DIRECT',
        calculatedSummary: {
          boardAvg: grades.boardAvg,
          boardGrade: grades.boardGrade,
          directorAvg: grades.directorAvg,
          directorGrade: grades.directorGrade,
          mdAvg: grades.mdAvg,
          mdGrade: grades.mdGrade,
          staffScore100: Object.values(grades.staffScores || {})[0]?.total ?? null,
          staffGrade: Object.values(grades.staffScores || {})[0]?.grade ?? 'N/A',
          staffScores: grades.staffScores,
          staffDept: formData.supervisorDept || formData.selectedStaffDept,
        },
        evaluationDetails: {
          section1: formData.section1,
          section2: formData.section2,
          section3: formData.section3,
          section4: formData.section4,
          comments: {
            section1: formData.section1Comment,
            section2: formData.section2Comments,
            section3: formData.section3Comment,
            section4: formData.section4Comments,
          },
        },
      };

      const res = await fetch('/api/ai/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `HTTP error ${res.status}`);
      }

      const data: AISynthesisResult = await res.json();
      setResult(data);
      if (onSynthesisSuccess) {
        onSynthesisSuccess(data);
      }
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setError(err?.message || 'เกิดข้อผิดพลาดในการสังเคราะห์ด้วย AI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !result && !loading) {
      runSynthesis();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const jsonString = result ? JSON.stringify(result, null, 2) : '';

  const handleCopyJson = () => {
    if (jsonString) {
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-white p-5 flex items-center justify-between border-b border-amber-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-800/80 text-amber-200 border border-amber-600/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                AI สังเคราะห์รายงานธรรมาภิบาล (Gemini Executive Synthesis)
              </h3>
              <p className="text-xs text-amber-200/80">
                ประมวลผลตามเกณฑ์ CG Code สถาบันการเงิน และสร้าง JSON รูปแบบเฉพาะ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h4 className="text-base font-bold text-slate-800">
                กำลังวิเคราะห์และสังเคราะห์ข้อมูลด้วย Gemini 3.8 Flash...
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                ระบบกำลังวิเคราะห์คะแนนประเมินบอร์ด กรรมการรายบุคคล MD และพนักงานตามหลัก Fiduciary Duty
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <div className="font-bold mb-1">ไม่สามารถประมวลผลได้</div>
              <div className="text-xs">{error}</div>
              <button
                type="button"
                onClick={runSynthesis}
                className="mt-3 px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition-colors"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">บอร์ดทั้งคณะ</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {result.evaluation_summary.board_grade}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">กรรมการรายบุคคล</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {result.evaluation_summary.self_director_grade}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">ผู้จัดการใหญ่ (MD)</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {result.evaluation_summary.md_grade}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-amber-800">พนักงาน (สายงานกำกับ)</div>
                  <div className="text-sm font-extrabold text-amber-950 mt-0.5">
                    {result.evaluation_summary.staff_grade} ({result.evaluation_summary.staff_score_100} คะแนน)
                  </div>
                </div>
              </div>

              {/* Strengths */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <span>จุดเด่นด้าน Governance & การปฏิบัติงาน (Key Strengths)</span>
                </div>
                <ul className="space-y-1.5">
                  {result.governance_insights.strengths.map((str, i) => (
                    <li key={i} className="text-xs sm:text-sm text-emerald-950 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas for Improvement */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>ประเด็นที่ควรส่งเสริมหรือพัฒนา (Areas for Improvement)</span>
                </div>
                <ul className="space-y-1.5">
                  {result.governance_insights.areas_for_improvement.map((area, i) => (
                    <li key={i} className="text-xs sm:text-sm text-amber-950 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Executive Narrative */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-2">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>บทสรุปเชิงบริหาร (Executive Narrative)</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {result.executive_narrative}
                </div>
              </div>

              {/* Raw Mandatory JSON Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowJsonRaw(!showJsonRaw)}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 transition-colors"
                >
                  <Code2 className="w-4 h-4" />
                  <span>{showJsonRaw ? 'ซ่อน JSON Object' : 'แสดง JSON Object ตามเกณฑ์ข้อกำหนด (MANDATORY JSON)'}</span>
                </button>

                {showJsonRaw && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-amber-200 text-xs font-mono overflow-x-auto max-h-60 border border-slate-800">
                    {jsonString}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={runSynthesis}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>ประมวลผลใหม่</span>
          </button>

          <div className="flex items-center gap-2">
            {result && (
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'คัดลอก JSON เรียบร้อย' : 'คัดลอก MANDATORY JSON'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
