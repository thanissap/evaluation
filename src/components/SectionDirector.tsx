import React, { useState } from 'react';
import { ScoreValueSec123, EvaluationItem, Director } from '../types/evaluation';
import { RatingButtonGroup } from './RatingButtonGroup';
import { calculateSectionAvg } from '../utils/grading';
import {
  UserCheck2,
  CheckCircle2,
  MessageSquare,
  Zap,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Users,
} from 'lucide-react';

interface SectionDirectorProps {
  items: EvaluationItem[];
  directors: Director[];
  evaluatorKey: string;
  selectedTargetDirectorKey?: string;
  onSelectTargetDirectorKey?: (key: string) => void;
  crossScores: Record<string, Record<string, ScoreValueSec123>>;
  comments: Record<string, string>;
  disabled?: boolean;
  onScoreChange: (targetDirectorKey: string, itemId: string, val: ScoreValueSec123) => void;
  onCommentChange: (targetDirectorKey: string, val: string) => void;
  onQuickFillDirector: (targetDirectorKey: string) => void;
  onQuickFillAllDirectors: () => void;
  onResetDirector: (targetDirectorKey: string) => void;
  onResetAllDirectors?: () => void;
}

export const SectionDirector: React.FC<SectionDirectorProps> = ({
  items,
  directors,
  evaluatorKey,
  selectedTargetDirectorKey,
  onSelectTargetDirectorKey,
  crossScores,
  comments,
  disabled = false,
  onScoreChange,
  onCommentChange,
  onQuickFillDirector,
  onQuickFillAllDirectors,
  onResetDirector,
  onResetAllDirectors,
}) => {
  const [internalTargetKey, setInternalTargetKey] = useState<string>(
    directors[0]?.key || evaluatorKey
  );
  const [confirmResetOne, setConfirmResetOne] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const selectedTargetKey = selectedTargetDirectorKey || internalTargetKey;

  const handleSelectTarget = (key: string) => {
    setInternalTargetKey(key);
    if (onSelectTargetDirectorKey) {
      onSelectTargetDirectorKey(key);
    }
  };

  const currentTargetDirector =
    directors.find((d) => d.key === selectedTargetKey) || directors[0];

  const currentDirectorScores = crossScores[selectedTargetKey] || {};
  const currentComment = comments[selectedTargetKey] || '';

  const { avg, count } = calculateSectionAvg(currentDirectorScores);
  const answeredCountForCurrent = Object.keys(currentDirectorScores).filter(
    (k) => currentDirectorScores[k] !== null && currentDirectorScores[k] !== undefined
  ).length;

  // Calculate overall completed directors
  const completedDirectorsCount = directors.filter((d) => {
    const s = crossScores[d.key] || {};
    const filled = Object.keys(s).filter((k) => s[k] !== null && s[k] !== undefined).length;
    return filled === items.length;
  }).length;

  const currentDirectorIndex = directors.findIndex((d) => d.key === selectedTargetKey);

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

  const handleNextDirector = () => {
    if (currentDirectorIndex < directors.length - 1) {
      handleSelectTarget(directors[currentDirectorIndex + 1].key);
      scrollToTopBar();
    }
  };

  const handlePrevDirector = () => {
    if (currentDirectorIndex > 0) {
      handleSelectTarget(directors[currentDirectorIndex - 1].key);
      scrollToTopBar();
    }
  };

  return (
    <section id="section-2" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mb-8 transition-all">
      {/* Section Header */}
      <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-800/60 border border-amber-600/40 text-amber-300">
              <UserCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-amber-300">เอกสารชุดที่ 2</span>
                <span className="text-xs text-amber-200/70 font-medium">· ประเมินกรรมการทุกคน (Self & Cross Evaluation)</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                แบบประเมินกรรมการรายบุคคล (ประเมินกรรมการทุกคน {directors.length} ท่าน)
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/80 mt-0.5">
                ประเมินคุณสมบัติ ความพร้อม การประชุม บทบาทหน้าที่ และการอุทิศเวลาของกรรมการเป็นรายบุคคล
              </p>
            </div>
          </div>

          {/* Quick Actions for Section 2 */}
          {!disabled && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => onQuickFillDirector(selectedTargetKey)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                title={`ให้คะแนน 4 แก่ ${currentTargetDirector?.name}`}
              >
                <Zap className="w-3.5 h-3.5 fill-amber-950" />
                <span>⚡ เห็นชอบระดับดีมากแก่ท่านนี้ (คะแนน 4)</span>
              </button>
              <button
                type="button"
                onClick={onQuickFillAllDirectors}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700/80 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                title="ใส่คะแนน 4 แก่กรรมการทุกคนครบทั้ง 9-10 ท่านในคลิกเดียว"
              >
                <Users className="w-3.5 h-3.5" />
                <span>⚡ ให้คะแนน 4 แก่กรรมการทุกคน</span>
              </button>
              {confirmResetOne ? (
                <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-rose-950/90 border border-rose-500 animate-in fade-in">
                  <span className="text-[11px] text-rose-200 px-1 font-bold">ยืนยันล้างท่านนี้?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmResetOne(false);
                      onResetDirector(selectedTargetKey);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] cursor-pointer shadow-xs active:scale-95"
                  >
                    ยืนยัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOne(false)}
                    className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetOne(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer bg-stone-900/80 hover:bg-rose-950 text-amber-200 hover:text-rose-200 border-amber-800/50 active:scale-95"
                  title={`รีเซ็ตคะแนนของ ${currentTargetDirector?.name}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตท่านนี้</span>
                </button>
              )}

              {onResetAllDirectors && (
                confirmResetAll ? (
                  <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-rose-950/90 border border-rose-500 animate-in fade-in">
                    <span className="text-[11px] text-rose-200 px-1 font-bold">ยืนยันล้างกรรมการทุกคน?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmResetAll(false);
                        onResetAllDirectors();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] cursor-pointer shadow-xs active:scale-95"
                    >
                      ยืนยันล้างทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetAll(false)}
                      className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetAll(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer bg-rose-950/70 hover:bg-rose-900 text-rose-200 border-rose-700/60 active:scale-95"
                    title="รีเซ็ตคะแนนของกรรมการทุกคนทั้งหมดในชุดที่ 2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>รีเซ็ตทุกคน</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Global Progress across all directors */}
        <div className="mt-4 pt-3 border-t border-amber-800/60 flex items-center justify-between text-xs text-amber-200 flex-wrap gap-2">
          <span>
            ความคืบหน้ารวม: ประเมินครบถ้วนแล้ว <strong>{completedDirectorsCount}</strong> จากทั้งหมด {directors.length} ท่าน
          </span>
          <span className="font-semibold text-amber-300">
            {Math.round((completedDirectorsCount / directors.length) * 100)}% เสร็จสิ้น
          </span>
        </div>
      </div>

      {/* Target Directors Selection Tabs */}
      <div className="bg-slate-100 p-3 sm:p-4 border-b border-slate-200">
        <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center justify-between">
          <span>เลือกกรรมการที่ต้องการประเมิน (คลิกเพื่อสลับท่าน):</span>
          <span className="text-slate-500 font-normal">
            ท่านที่ {currentDirectorIndex + 1} จาก {directors.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {directors.map((dir, idx) => {
            const isSelected = dir.key === selectedTargetKey;
            const dirScores = crossScores[dir.key] || {};
            const answered = Object.keys(dirScores).filter(
              (k) => dirScores[k] !== null && dirScores[k] !== undefined
            ).length;
            const isComplete = answered === items.length;
            const isSelf = dir.key === evaluatorKey;

            return (
              <button
                key={dir.key}
                type="button"
                onClick={() => handleSelectTarget(dir.key)}
                className={`
                  p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px]
                  ${
                    isSelected
                      ? 'bg-amber-900 text-white border-amber-800 shadow-md ring-2 ring-amber-500/40'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                  }
                `}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] uppercase font-bold opacity-70">
                      #{idx + 1} {isSelf ? '(ตนเอง)' : ''}
                    </span>
                    {isComplete ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}>
                        ครบแล้ว ✓
                      </span>
                    ) : answered > 0 ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-amber-800 text-amber-200' : 'bg-amber-100 text-amber-900'}`}>
                        {answered}/{items.length}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-medium px-1 rounded ${isSelected ? 'text-amber-200' : 'text-slate-400'}`}>
                        0/{items.length}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold truncate mt-0.5">
                    {dir.name}
                  </div>
                </div>
                <div className={`text-[10px] truncate mt-1 ${isSelected ? 'text-amber-200' : 'text-slate-500'}`}>
                  {dir.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Evaluated Director Profile Banner */}
      <div className="bg-amber-50/70 border-b border-amber-200/80 p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-900 text-amber-100 uppercase">
              กรรมการที่กำลังประเมิน
            </span>
            {currentTargetDirector.key === evaluatorKey && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-900">
                ประเมินตนเอง (Self-Evaluation)
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            {currentTargetDirector.name}
          </h3>
          <p className="text-xs text-slate-600">
            {currentTargetDirector.title}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">ตอบแล้วสำหรับท่านนี้</div>
            <div className="text-base font-bold text-slate-900">
              {answeredCountForCurrent} / {items.length} ข้อ
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentDirectorIndex === 0}
              onClick={handlePrevDirector}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
              title="กรรมการท่านก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentDirectorIndex === directors.length - 1}
              onClick={handleNextDirector}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
              title="กรรมการท่านถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Criteria Explanatory Strip */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 text-xs text-slate-700 leading-relaxed">
        <div className="font-bold text-amber-900 mb-0.5">วิธีการให้คะแนน:</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-slate-600">
          <div><strong className="text-amber-900">4</strong> = เห็นด้วยอย่างมาก / ดีเยี่ยม</div>
          <div><strong className="text-amber-900">3</strong> = เห็นด้วยค่อนข้างมาก / ดี</div>
          <div><strong className="text-amber-900">2</strong> = เห็นด้วย / พอสมควร</div>
          <div><strong className="text-amber-900">1</strong> = ไม่เห็นด้วย / เล็กน้อย</div>
          <div><strong className="text-amber-900">0</strong> = ไม่เห็นด้วยอย่างยิ่ง / ไม่ได้ดำเนินการ</div>
          <div><strong className="text-amber-900">N/A</strong> = เฉพาะเจาะจง / ไม่เคยเกิดเหตุการณ์</div>
        </div>
      </div>

      {/* Item List for Current Director */}
      <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-6 sm:space-y-0">
        {items.map((item, idx) => {
          const currentVal = currentDirectorScores[item.id];
          const hasAnswered = currentVal !== undefined && currentVal !== null;
          const isCategoryStart = idx === 0 || items[idx - 1].category !== item.category;

          return (
            <React.Fragment key={item.id}>
              {/* Category Header */}
              {isCategoryStart && item.category && (
                <div className="pt-6 pb-2 first:pt-0">
                  <div className="text-sm font-extrabold text-amber-950 bg-amber-100/60 px-3.5 py-1.5 rounded-lg border-l-4 border-amber-800">
                    {item.category}
                  </div>
                </div>
              )}

              <div
                id={`item-d-${selectedTargetKey}-${item.id}`}
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
                      itemId={`d_${selectedTargetKey}_${item.id}`}
                      type="director"
                      value={currentVal}
                      disabled={disabled}
                      onChange={(val) => onScoreChange(selectedTargetKey, item.id, val)}
                    />
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Additional Comment for Selected Director */}
      <div className="bg-slate-50/70 border-t border-slate-200/80 p-5 sm:p-6">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
          <MessageSquare className="w-4 h-4 text-amber-700" />
          ความเห็น / ข้อเสนอแนะ สำหรับ {currentTargetDirector.name}
        </label>
        <textarea
          value={currentComment}
          disabled={disabled}
          onChange={(e) => onCommentChange(selectedTargetKey, e.target.value)}
          placeholder={`ระบุความเห็นหรือข้อเสนอแนะเพิ่มเติมสำหรับการปฏิบัติหน้าที่ของ ${currentTargetDirector.name}...`}
          rows={3}
          className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 focus:outline-hidden bg-white disabled:bg-slate-100 disabled:text-slate-500"
        />

        {/* Next Director shortcut */}
        {currentDirectorIndex < directors.length - 1 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleNextDirector}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <span>ประเมินกรรมการท่านถัดไป: {directors[currentDirectorIndex + 1].name}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
