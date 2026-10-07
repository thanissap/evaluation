import React, { useState } from 'react';
import { ScoreValueSec123, EvaluationItem } from '../types/evaluation';
import { RatingButtonGroup } from './RatingButtonGroup';
import { calculateSectionAvg } from '../utils/grading';
import { Briefcase, CheckCircle2, MessageSquare, Info, Zap, RotateCcw } from 'lucide-react';

interface SectionMDProps {
  items: EvaluationItem[];
  evaluatorKey: string;
  scores: Record<string, ScoreValueSec123>;
  comment?: string;
  disabled?: boolean;
  onScoreChange: (id: string, val: ScoreValueSec123) => void;
  onCommentChange: (val: string) => void;
  onQuickFillExcellent: () => void;
  onResetSection: () => void;
}

export const SectionMD: React.FC<SectionMDProps> = ({
  items,
  evaluatorKey,
  scores,
  comment = '',
  disabled = false,
  onScoreChange,
  onCommentChange,
  onQuickFillExcellent,
  onResetSection,
}) => {
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  // If evaluator is MD (kriangkrai), hide Section 3 completely
  if (evaluatorKey === 'kriangkrai') {
    return (
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 mb-8 text-amber-900 flex items-center gap-4">
        <Info className="w-8 h-8 text-amber-700 shrink-0" />
        <div>
          <h3 className="font-bold text-base">ยกเว้นการประเมินเอกสารชุดที่ 3 (ผู้จัดการใหญ่)</h3>
          <p className="text-xs sm:text-sm text-amber-800/90 mt-0.5">
            ตามหลักธรรมาภิบาลและการกำกับดูแลกิจการที่ดี นายเกรียงไกร ศิระวณิชการ ในฐานะผู้จัดการใหญ่ (MD) ได้รับการยกเว้นไม่ต้องประเมินผลการปฏิบัติงานตนเองในส่วนนี้
          </p>
        </div>
      </div>
    );
  }

  const { avg, count } = calculateSectionAvg(scores);
  const answeredTotal = Object.keys(scores || {}).filter((k) => scores[k] !== null && scores[k] !== undefined).length;

  return (
    <section id="section-3" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mb-8 transition-all">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 text-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-800/60 border border-amber-600/40 text-amber-300">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-amber-300">เอกสารชุดที่ 3</span>
                <span className="text-xs text-amber-200/70 font-medium">· รวม {items.length} ข้อการประเมิน (9 หมวด)</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                แบบประเมินผู้จัดการใหญ่ (สำหรับประเมิน นายเกรียงไกร ศิระวณิชการ ในฐานะผู้จัดการใหญ่)
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/80 mt-0.5">
                ประเมินภาวะผู้นำ กลยุทธ์ การเงิน ความสัมพันธ์กับบอร์ด/ภายนอก การบริหารบุคลากร และคุณลักษณะส่วนตัว
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          {!disabled && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={onQuickFillExcellent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                title="ใส่คะแนน 4 (เห็นด้วยอย่างมาก) ให้กับทุกข้อในแบบประเมินผู้จัดการใหญ่ชุดนี้"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-950" />
                <span>⚡ เห็นชอบระดับดีมากทั้งหมด (คะแนน 4)</span>
              </button>
              {isConfirmingReset ? (
                <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-rose-950/90 border border-rose-500 animate-in fade-in">
                  <span className="text-[11px] text-rose-200 px-1 font-bold">ยืนยันล้างชุดที่ 3?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmingReset(false);
                      onResetSection();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] cursor-pointer shadow-xs active:scale-95"
                  >
                    ยืนยันล้าง
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(false)}
                    className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer bg-amber-950/80 hover:bg-rose-950 text-amber-200 hover:text-rose-200 border-amber-700/60 active:scale-95"
                  title="ล้างคะแนนในแบบประเมินผู้จัดการใหญ่นี้เพื่อเริ่มประเมินใหม่"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตคะแนนชุดนี้</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-3 border-t border-amber-800/60 flex items-center justify-between text-xs text-amber-200">
          <span>
            ความคืบหน้า: ตอบแล้ว <strong>{answeredTotal}</strong> จาก {items.length} ข้อ (คะแนนตัวเลขที่ใช้คำนวณ {count} ข้อ)
          </span>
          <span className="font-bold text-amber-300">
            คะแนนเฉลี่ยเบื้องต้น: {avg !== null ? avg.toFixed(2) : '-.--'} / 4.00
          </span>
        </div>
      </div>

      {/* Criteria Explanatory Strip */}
      <div className="bg-amber-50/70 border-b border-amber-200/80 p-4 text-xs text-amber-950 leading-relaxed">
        <div className="font-bold text-amber-900 mb-1">วิธีการให้คะแนนตามเกณฑ์มาตรฐาน:</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-slate-700">
          <div><strong className="text-amber-900">4</strong> = เห็นด้วยอย่างมาก หรือมีการดำเนินการในเรื่องนั้นอย่างดีเยี่ยม</div>
          <div><strong className="text-amber-900">3</strong> = เห็นด้วยค่อนข้างมาก หรือมีการดำเนินการในเรื่องนั้นดี</div>
          <div><strong className="text-amber-900">2</strong> = เห็นด้วย หรือมีการดำเนินการในเรื่องนั้นพอสมควร</div>
          <div><strong className="text-amber-900">1</strong> = ไม่เห็นด้วย หรือมีการดำเนินการในเรื่องนั้นเล็กน้อย</div>
          <div><strong className="text-amber-900">0</strong> = ไม่เห็นด้วยอย่างยิ่ง หรือไม่มีการดำเนินการในเรื่องนั้น</div>
          <div><strong className="text-amber-900">N/A</strong> = เป็นเรื่องเฉพาะเจาะจง หรือไม่เคยเกิดเหตุการณ์ (ไม่นำมาคำนวณ)</div>
        </div>
      </div>

      {/* Item List */}
      <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-6 sm:space-y-0">
        {items.map((item, idx) => {
          const currentVal = scores[item.id];
          const hasAnswered = currentVal !== undefined && currentVal !== null;
          const isCategoryStart = idx === 0 || items[idx - 1].category !== item.category;

          return (
            <React.Fragment key={item.id}>
              {/* Category Header */}
              {isCategoryStart && item.category && (
                <div className="pt-6 pb-2 first:pt-0">
                  <div className="text-sm sm:text-base font-extrabold text-amber-950 bg-amber-100/60 px-3.5 py-1.5 rounded-lg border-l-4 border-amber-800">
                    {item.category}
                  </div>
                </div>
              )}

              <div
                id={`item-m-${item.id}`}
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
                      itemId={`m_${item.id}`}
                      type="director"
                      value={currentVal}
                      disabled={disabled}
                      onChange={(val) => onScoreChange(item.id, val)}
                    />
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Additional Comment Box */}
      <div className="bg-slate-50/70 border-t border-slate-200/80 p-5 sm:p-6">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
          <MessageSquare className="w-4 h-4 text-amber-700" />
          ความเห็น / ข้อเสนอแนะ สำหรับการประเมินผู้จัดการใหญ่
        </label>
        <textarea
          value={comment}
          disabled={disabled}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="ระบุความเห็นหรือข้อเสนอแนะเพิ่มเติมสำหรับการบริหารงานของผู้จัดการใหญ่..."
          rows={3}
          className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 focus:outline-hidden bg-white disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>
    </section>
  );
};
