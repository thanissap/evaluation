import React from 'react';
import { CalculatedGrades, SubmissionStatus, CompanyId, FiscalYear } from '../types/evaluation';
import { getGradeBadgeStyle } from '../utils/grading';
import {
  Award,
  CheckCircle,
  Clock,
  Send,
  Printer,
  Sparkles,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';

interface ExecutiveSummaryProps {
  grades: CalculatedGrades;
  status: SubmissionStatus;
  company: CompanyId;
  year: FiscalYear;
  evaluatorName: string;
  isMD: boolean;
  hasStaffAccess: boolean;
  isSupervisorMode: boolean;
  submittedAt?: string;
  isIncomplete: boolean;
  incompleteMessage?: string;
  onFinalSubmit: () => void;
  onOpenAIModal: () => void;
  onExportExcel: () => void;
  onShowIncompleteDetails: () => void;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  grades,
  status,
  company,
  year,
  evaluatorName,
  isMD,
  hasStaffAccess,
  isSupervisorMode,
  submittedAt,
  isIncomplete,
  incompleteMessage,
  onFinalSubmit,
  onOpenAIModal,
  onExportExcel,
  onShowIncompleteDetails,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-700" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              แดชบอร์ดสรุปผลการประเมินประจำปี (Executive Scorecard)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {company} · ประจำปีการประเมิน {year} · ผู้ประเมิน: <span className="font-bold text-slate-800">{evaluatorName}</span>
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {status === 'SUBMITTED' ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 px-3.5 py-1.5 rounded-xl text-emerald-800 text-xs font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>ส่งผลการประเมินแล้ว ({submittedAt ? new Date(submittedAt).toLocaleDateString('th-TH') : 'เรียบร้อย'})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-xl text-amber-800 text-xs font-bold">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>สถานะ: บันทึกแบบร่างอัตโนมัติ (DRAFT)</span>
            </div>
          )}
        </div>
      </div>

      {/* Incomplete Warning Alert Banner */}
      {status !== 'SUBMITTED' && isIncomplete && (
        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{incompleteMessage || 'ยังมีข้อคำถามที่ยังไม่ได้ประเมินครบถ้วน'}</span>
          </div>
          <button
            type="button"
            onClick={onShowIncompleteDetails}
            className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
          >
            ตรวจสอบรายการที่ยังไม่ตอบ →
          </button>
        </div>
      )}

      {/* Scorecards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Card 1: Board */}
        {!isSupervisorMode && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              ชุดที่ 1: คณะกรรมการทั้งชุด
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {grades.boardAvg !== null ? grades.boardAvg.toFixed(2) : '-.--'}
              </div>
              <div className="text-xs text-slate-500 font-medium">เต็ม 4.00</div>
            </div>
            <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-200/60 text-xs">
              <span className="text-slate-600">ตอบแล้ว:</span>
              <span className="font-bold text-slate-800">
                {grades.boardCount} / {grades.boardTotalQuestions} ข้อ
              </span>
            </div>
          </div>
        )}

        {/* Card 2: Individual Director (Cross Evaluation) */}
        {!isSupervisorMode && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              ชุดที่ 2: กรรมการรายบุคคล
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {grades.directorAvg !== null ? grades.directorAvg.toFixed(2) : '-.--'}
              </div>
              <div className="text-xs text-slate-500 font-medium">เต็ม 4.00</div>
            </div>
            <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-200/60 text-xs">
              <span className="text-slate-600">ประเมินแล้ว:</span>
              <span className="font-bold text-slate-800">
                {grades.directorEvaluatedCount} / {grades.directorTotalEligible} ท่าน
              </span>
            </div>
          </div>
        )}

        {/* Card 3: MD */}
        {!isSupervisorMode && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              ชุดที่ 3: ผู้จัดการใหญ่ (MD)
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {isMD ? 'N/A' : grades.mdAvg !== null ? grades.mdAvg.toFixed(2) : '-.--'}
              </div>
              <div className="text-xs text-slate-500 font-medium">{isMD ? 'ยกเว้นตนเอง' : 'เต็ม 4.00'}</div>
            </div>
            <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-200/60 text-xs">
              <span className="text-slate-600">{isMD ? 'สถานะ:' : 'ตอบแล้ว:'}</span>
              <span className="font-bold text-slate-800">
                {isMD ? 'ยกเว้นตามเกณฑ์' : `${grades.mdCount} / ${grades.mdTotalQuestions} ข้อ`}
              </span>
            </div>
          </div>
        )}

        {/* Card 4: Staff (CLC Only) */}
        {(company === 'CLC' && (hasStaffAccess || isSupervisorMode)) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
              ชุดที่ 4: พนักงานสายงานกำกับ
            </div>
            <div className="mt-2 space-y-1.5">
              {Object.keys(grades.staffScores).length > 0 ? (
                Object.entries(grades.staffScores).map(([deptKey, scoreData]) => (
                  <div key={deptKey} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{deptKey}:</span>
                    <span className="font-extrabold text-amber-950 font-['Plus_Jakarta_Sans',sans-serif]">
                      {scoreData.total !== null ? `${scoreData.total} / 100` : '-'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">ยังไม่มีข้อมูล</div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-amber-200/70 text-xs">
              <span className="text-amber-900">เกณฑ์ HR-58:</span>
              <span className="font-bold text-amber-950">รวมเต็ม 100 คะแนน</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>พิมพ์รายงาน (Print)</span>
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>ดาวน์โหลด Excel</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenAIModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>สังเคราะห์บทสรุปธรรมาภิบาลด้วย AI</span>
          </button>

          {status !== 'SUBMITTED' ? (
            <button
              type="button"
              onClick={onFinalSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer active:scale-95 ring-2 ring-amber-500/30"
            >
              <Send className="w-4 h-4 text-amber-300" />
              <span>ยืนยันและส่งผลการประเมิน (Submit)</span>
            </button>
          ) : (
            <div className="text-xs text-slate-500 font-medium">
              ส่งผลการประเมินเรียบร้อยแล้ว (หากต้องการแก้ไข ติดต่อฝ่ายเลขานุการบริษัทเพื่อปลดล็อก)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
