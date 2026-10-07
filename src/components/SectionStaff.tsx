import React, { useState } from 'react';
import { ScoreValueSec4, EvaluationItem, SubCommitteeDept } from '../types/evaluation';
import { SUBCOMMITTEE_DEPTS, DeptInfo } from '../data/evaluationData';
import { RatingButtonGroup } from './RatingButtonGroup';
import { calculateStaffTotal } from '../utils/grading';
import { UserCog, CheckCircle2, MessageSquare, ShieldCheck, Zap, RotateCcw, ChevronRight } from 'lucide-react';

interface SectionStaffProps {
  items: EvaluationItem[];
  eligibleDepts: DeptInfo[];
  selectedDept: SubCommitteeDept;
  isSupervisorMode: boolean;
  supervisorName?: string;
  supervisorTitle?: string;
  deptScores: Record<string, Record<string, ScoreValueSec4>>;
  comments: Record<string, string>;
  disabled?: boolean;
  onDeptChange: (dept: SubCommitteeDept) => void;
  onSupervisorNameChange: (val: string) => void;
  onSupervisorTitleChange: (val: string) => void;
  onScoreChange: (deptId: string, itemId: string, val: ScoreValueSec4) => void;
  onCommentChange: (deptId: string, val: string) => void;
  onQuickFillDept: (deptId: string) => void;
  onResetDept: (deptId: string) => void;
}

export const SectionStaff: React.FC<SectionStaffProps> = ({
  items,
  eligibleDepts,
  selectedDept,
  isSupervisorMode,
  supervisorName = '',
  supervisorTitle = '',
  deptScores,
  comments,
  disabled = false,
  onDeptChange,
  onSupervisorNameChange,
  onSupervisorTitleChange,
  onScoreChange,
  onCommentChange,
  onQuickFillDept,
  onResetDept,
}) => {
  const currentDeptInfo =
    SUBCOMMITTEE_DEPTS.find((d) => d.id === selectedDept) || SUBCOMMITTEE_DEPTS[0];

  const currentScores = deptScores[selectedDept] || {};
  const currentComment = comments[selectedDept] || '';

  const { total, count } = calculateStaffTotal(currentScores);

  const [confirmResetDept, setConfirmResetDept] = useState(false);
  const currentDeptIndex = eligibleDepts.findIndex((d) => d.id === selectedDept);

  const scrollToTopBar = () => {
    setTimeout(() => {
      const navEl = document.getElementById('evaluation-sections-nav');
      if (navEl) {
        const headerOffset = 76;
        const elementPosition = navEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: Math.max(0, offsetPosition), behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  };

  return (
    <section id="section-4" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mb-8 transition-all">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-800/60 border border-amber-600/40 text-amber-300">
              <UserCog className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-amber-300">แบบประเมินส่วนที่ 4 (CLC Only)</span>
                <span className="text-xs text-amber-200/70 font-medium">· แบบฟอร์ม HR-58-11#3 (20 ข้อ)</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                การประเมินผลการปฏิบัติงานของพนักงานสายงานกำกับ (CU, IA, RISK)
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/80 mt-0.5">
                ประเมิน CU และ RISK โดย <span className="font-semibold text-amber-200">คณะกรรมการบริหาร</span> · ประเมิน IA โดย <span className="font-semibold text-amber-200">คณะกรรมการตรวจสอบ</span>
              </p>
            </div>
          </div>

          {/* Quick Actions for Active Department */}
          {!disabled && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => onQuickFillDept(selectedDept)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                title={`ให้คะแนน 5 ทุกข้อในสายงาน ${selectedDept}`}
              >
                <Zap className="w-3.5 h-3.5 fill-amber-950" />
                <span>⚡ เห็นชอบระดับดีมากทั้งหมด (คะแนน 5)</span>
              </button>
              {confirmResetDept ? (
                <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-rose-950/90 border border-rose-500 animate-in fade-in">
                  <span className="text-[11px] text-rose-200 px-1 font-bold">ยืนยันล้างสายงาน {selectedDept}?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmResetDept(false);
                      onResetDept(selectedDept);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] cursor-pointer shadow-xs active:scale-95"
                  >
                    ยืนยัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetDept(false)}
                    className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetDept(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer bg-stone-900/80 hover:bg-rose-950 text-amber-200 hover:text-rose-200 border border-amber-800/50 active:scale-95"
                  title={`รีเซ็ตคะแนนของสายงาน ${currentDeptInfo.nameTh}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตสายงานนี้</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Total Score & Progress for current department */}
        <div className="mt-4 pt-3 border-t border-amber-800/60 flex items-center justify-between text-xs text-amber-200 flex-wrap gap-2">
          <span>
            ความคืบหน้าของ {selectedDept}: ตอบแล้ว <strong>{count}</strong> จาก {items.length} ข้อ
          </span>
          <span className="text-sm font-extrabold text-amber-300">
            คะแนนรวมสายงาน {selectedDept}: {total !== null ? total : '-'} / 100 คะแนน
          </span>
        </div>
      </div>

      {/* Prominent Department Cards / Selectors */}
      {!isSupervisorMode && eligibleDepts.length > 1 && (
        <div className="bg-slate-100 p-4 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span>สายงานที่คุณมีอำนาจประเมิน (คลิกการ์ดขนาดใหญ่ด้านล่างเพื่อเลือกประเมิน):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {eligibleDepts.map((d) => {
              const isSelected = d.id === selectedDept;
              const dScores = deptScores[d.id] || {};
              const dTotalRes = calculateStaffTotal(dScores);
              const isComplete = dTotalRes.count === items.length;

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onDeptChange(d.id);
                    scrollToTopBar();
                  }}
                  className={`
                    p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between
                    ${
                      isSelected
                        ? 'bg-amber-900 text-white border-amber-800 shadow-md ring-2 ring-amber-500/50'
                        : 'bg-white text-slate-800 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      {d.id}
                    </span>
                    {isComplete ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}>
                        ครบ 20 ข้อ ✓ ({dTotalRes.total} คะแนน)
                      </span>
                    ) : dTotalRes.count > 0 ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-amber-800 text-amber-200' : 'bg-amber-100 text-amber-900'}`}>
                        {dTotalRes.count}/{items.length} ข้อ
                      </span>
                    ) : (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isSelected ? 'text-amber-200' : 'text-slate-400'}`}>
                        ยังไม่ได้ประเมิน
                      </span>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm font-bold mt-1 line-clamp-1">
                    {d.nameTh}
                  </div>

                  <div className={`text-[11px] mt-1 font-medium ${isSelected ? 'text-amber-200' : 'text-slate-500'}`}>
                    ผู้ประเมิน: {d.evaluatorCommittee}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Department Details Banner */}
      <div className="bg-amber-50/80 border-b border-amber-200/80 p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-900 text-amber-100 uppercase">
              กำลังประเมินสายงาน
            </span>
            <span className="text-xs font-bold text-amber-900">
              ผู้ประเมินตามเกณฑ์: {currentDeptInfo.evaluatorCommittee}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            {currentDeptInfo.nameTh}
          </h3>
        </div>

        {/* Supervisor Identity Form (In Delegation Mode) */}
        {isSupervisorMode && (
          <div className="w-full mt-2 pt-3 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-amber-300">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อ-นามสกุล หัวหน้างานผู้ประเมินแทน *
              </label>
              <input
                type="text"
                disabled={disabled}
                value={supervisorName}
                onChange={(e) => onSupervisorNameChange(e.target.value)}
                placeholder="เช่น นายประวิทย์ มงคลสุข"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ตำแหน่งงาน (Job Title) *
              </label>
              <input
                type="text"
                disabled={disabled}
                value={supervisorTitle}
                onChange={(e) => onSupervisorTitleChange(e.target.value)}
                placeholder="เช่น ผู้จัดการฝ่ายกำกับดูแลการปฏิบัติงาน"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* Criteria Explanatory Strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 text-xs text-slate-700 flex items-center justify-between flex-wrap gap-2">
        <span className="font-medium">
          เกณฑ์คะแนนพนักงาน (HR-58-11#3): 5 = ดีมาก, 4 = ดี, 3 = ปานกลาง, 2 = พอใช้, 1 = ปรับปรุง, 0 = ไม่ผ่านเกณฑ์ (รวมเต็ม 100 คะแนน)
        </span>
      </div>

      {/* Item List (20 items) */}
      <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-6 sm:space-y-0">
        {items.map((item) => {
          const currentVal = currentScores[item.id];
          const hasAnswered = currentVal !== undefined && currentVal !== null;

          return (
            <div
              key={item.id}
              id={`item-s-${selectedDept}-${item.id}`}
              className={`py-4 transition-colors ${
                hasAnswered ? 'bg-transparent' : 'bg-slate-50/60 -mx-4 px-4 sm:-mx-6 sm:px-6 rounded-lg'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold font-['Plus_Jakarta_Sans',sans-serif]">
                      {item.code}
                    </span>
                    {hasAnswered && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {item.title}
                  </h3>
                </div>

                {/* Rating Button Group */}
                <div className="w-full lg:w-[460px] shrink-0">
                  <RatingButtonGroup
                    itemId={`s_${selectedDept}_${item.id}`}
                    type="staff"
                    value={currentVal}
                    disabled={disabled}
                    onChange={(val) => onScoreChange(selectedDept, item.id, val)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Comment Box for current department */}
      <div className="bg-slate-50/70 border-t border-slate-200/80 p-5 sm:p-6">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
          <MessageSquare className="w-4 h-4 text-amber-700" />
          ความเห็น / ข้อเสนอแนะ เกี่ยวกับการปฏิบัติงานของพนักงานสายงาน {currentDeptInfo.nameTh}
        </label>
        <textarea
          value={currentComment}
          disabled={disabled}
          onChange={(e) => onCommentChange(selectedDept, e.target.value)}
          placeholder="ระบุข้อคิดเห็นเชิงพัฒนา ผลการปฏิบัติงานที่โดดเด่น หรือจุดที่ควรปรับปรุงเพิ่มเติม..."
          rows={3}
          className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 focus:outline-hidden bg-white disabled:bg-slate-100 disabled:text-slate-500"
        />

        {/* Next Department shortcut */}
        {!isSupervisorMode && currentDeptIndex < eligibleDepts.length - 1 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onDeptChange(eligibleDepts[currentDeptIndex + 1].id);
                scrollToTopBar();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <span>ประเมินสายงานถัดไป: {eligibleDepts[currentDeptIndex + 1].nameTh}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
