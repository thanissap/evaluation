import React from 'react';
import { ScoreValueSec123, ScoreValueSec4 } from '../types/evaluation';
import { Check } from 'lucide-react';

interface RatingButtonGroupProps {
  itemId: string;
  type: 'director' | 'staff'; // director: 4, 3, 2, 1, 0, NA ; staff: 5, 4, 3, 2, 1, 0
  value: ScoreValueSec123 | ScoreValueSec4;
  disabled?: boolean;
  onChange: (val: any) => void;
}

const DIRECTOR_OPTIONS: { val: ScoreValueSec123; label: string; tooltip: string }[] = [
  { val: 4, label: '4', tooltip: '4: เห็นด้วยอย่างมาก หรือมีการดำเนินการในเรื่องนั้นอย่างดีเยี่ยม' },
  { val: 3, label: '3', tooltip: '3: เห็นด้วยค่อนข้างมาก หรือมีการดำเนินการในเรื่องนั้นดี' },
  { val: 2, label: '2', tooltip: '2: เห็นด้วย หรือมีการดำเนินการในเรื่องนั้นพอสมควร' },
  { val: 1, label: '1', tooltip: '1: ไม่เห็นด้วย หรือมีการดำเนินการในเรื่องนั้นเล็กน้อย' },
  { val: 0, label: '0', tooltip: '0: ไม่เห็นด้วยอย่างยิ่ง หรือไม่มีการดำเนินการในเรื่องนั้น' },
  { val: 'NA', label: 'N/A', tooltip: 'N/A: หัวข้อเฉพาะเจาะจง หรือไม่เคยเกิดเหตุการณ์ (ไม่นำมาคำนวณ)' },
];

const STAFF_OPTIONS: { val: ScoreValueSec4; label: string; tooltip: string }[] = [
  { val: 5, label: '5', tooltip: '5: ดีมาก (ผลงานโดดเด่นสม่ำเสมอ)' },
  { val: 4, label: '4', tooltip: '4: ดี (ได้ตามมาตรฐานงาน)' },
  { val: 3, label: '3', tooltip: '3: ปานกลาง (ผ่านเกณฑ์มาตรฐาน)' },
  { val: 2, label: '2', tooltip: '2: พอใช้ (มีประเด็นต้องปรับปรุง)' },
  { val: 1, label: '1', tooltip: '1: ปรับปรุง (ต่ำกว่าเกณฑ์มาตรฐาน)' },
  { val: 0, label: '0', tooltip: '0: ไม่ผ่านเกณฑ์การประเมิน' },
];

export const RatingButtonGroup: React.FC<RatingButtonGroupProps> = ({
  itemId,
  type,
  value,
  disabled = false,
  onChange,
}) => {
  const options = type === 'director' ? DIRECTOR_OPTIONS : STAFF_OPTIONS;

  return (
    <div
      className="grid grid-cols-6 gap-1.5 sm:gap-2 w-full max-w-full"
      role="radiogroup"
      aria-label={`Rating for ${itemId}`}
    >
      {options.map((opt) => {
        const isSelected = value === opt.val;
        return (
          <button
            key={String(opt.val)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.val)}
            title={opt.tooltip}
            className={`
              relative flex items-center justify-center h-12 sm:h-14 rounded-xl border transition-all duration-150 select-none
              ${disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-95 hover:border-amber-500 hover:bg-amber-50'}
              ${
                isSelected
                  ? 'bg-amber-900 text-white border-amber-950 shadow-md ring-2 ring-amber-500 font-extrabold scale-[1.02]'
                  : 'bg-white text-slate-800 border-slate-300 shadow-2xs hover:text-amber-950'
              }
            `}
          >
            <span
              className={`text-xl sm:text-2xl font-black font-['Plus_Jakarta_Sans',sans-serif] tracking-tight ${
                isSelected ? 'text-amber-200' : 'text-slate-800'
              }`}
            >
              {opt.label}
            </span>
            {isSelected && (
              <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        );
      })}
    </div>
  );
};
