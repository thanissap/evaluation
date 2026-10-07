import { ScoreValueSec123, ScoreValueSec4, CalculatedGrades } from '../types/evaluation';

/**
 * Standard Rating Definitions for Director Evaluations (0 - 4 & N/A)
 */
export const RATING_DEFINITIONS_SEC123: { val: ScoreValueSec123; label: string; desc: string }[] = [
  { val: 4, label: '4', desc: 'เห็นด้วยอย่างมาก หรือมีการดำเนินการในเรื่องนั้นอย่างดีเยี่ยม' },
  { val: 3, label: '3', desc: 'เห็นด้วยค่อนข้างมาก หรือมีการดำเนินการในเรื่องนั้นดี' },
  { val: 2, label: '2', desc: 'เห็นด้วย หรือมีการดำเนินการในเรื่องนั้นพอสมควร' },
  { val: 1, label: '1', desc: 'ไม่เห็นด้วย หรือมีการดำเนินการในเรื่องนั้นเล็กน้อย' },
  { val: 0, label: '0', desc: 'ไม่เห็นด้วยอย่างยิ่ง หรือไม่มีการดำเนินการในเรื่องนั้น' },
  { val: 'NA', label: 'N/A', desc: 'เรื่องเฉพาะเจาะจง / ไม่เคยเกิดเหตุการณ์ระหว่างปี (ไม่คิดคะแนน)' },
];

/**
 * Standard Rating Definitions for Staff Evaluations (0 - 5)
 */
export const RATING_DEFINITIONS_SEC4: { val: ScoreValueSec4; label: string; desc: string }[] = [
  { val: 5, label: '5', desc: 'ดีมาก (ผลงานโดดเด่นสม่ำเสมอ)' },
  { val: 4, label: '4', desc: 'ดี (ตามมาตรฐานงานที่กำหนด)' },
  { val: 3, label: '3', desc: 'ปานกลาง (ปฏิบัติงานได้ตามเกณฑ์)' },
  { val: 2, label: '2', desc: 'พอใช้ (มีประเด็นต้องพัฒนา)' },
  { val: 1, label: '1', desc: 'ปรับปรุง (ต่ำกว่าเกณฑ์มาตรฐาน)' },
  { val: 0, label: '0', desc: 'ไม่ผ่านเกณฑ์การประเมิน' },
];

/**
 * Cutoff grades for Secretary / Reporting based on average score (0.00 - 4.00):
 * < 0.50 = "ควรปรับปรุง"
 * 0.50 - 1.49 = "พอใช้"
 * 1.50 - 2.49 = "ปานกลาง"
 * 2.50 - 3.49 = "ดี"
 * >= 3.50 = "ดีมาก"
 */
export function getGradeForDirectorAvg(avg: number | null): string {
  if (avg === null || isNaN(avg)) return 'ยังไม่ประเมิน';
  if (avg >= 3.50) return 'ดีมาก';
  if (avg >= 2.50) return 'ดี';
  if (avg >= 1.50) return 'ปานกลาง';
  if (avg >= 0.50) return 'พอใช้';
  return 'ควรปรับปรุง';
}

/**
 * Cutoff grades for Staff Evaluation based on total score out of 100 (HR-58-11#3):
 * >= 86 = "ดีมาก"
 * 71 - 85 = "ดี"
 * 50 - 70 = "ปานกลาง"
 * < 50 = "ควรปรับปรุง"
 */
export function getGradeForStaffScore(total: number | null): string {
  if (total === null || isNaN(total)) return 'ยังไม่ประเมิน';
  if (total >= 86) return 'ดีมาก';
  if (total >= 71) return 'ดี';
  if (total >= 50) return 'ปานกลาง';
  return 'ควรปรับปรุง';
}

export function calculateSectionAvg(scores: Record<string, ScoreValueSec123>): {
  avg: number | null;
  count: number;
  totalValidScore: number;
} {
  let sum = 0;
  let count = 0;

  if (!scores) return { avg: null, count: 0, totalValidScore: 0 };

  Object.values(scores).forEach((val) => {
    if (typeof val === 'number') {
      sum += val;
      count += 1;
    }
  });

  if (count === 0) {
    return { avg: null, count: 0, totalValidScore: 0 };
  }

  const avg = Number((sum / count).toFixed(2));
  return { avg, count, totalValidScore: sum };
}

export function calculateStaffTotal(scores: Record<string, ScoreValueSec4>): {
  total: number | null;
  count: number;
} {
  let sum = 0;
  let count = 0;

  if (!scores) return { total: null, count: 0 };

  Object.values(scores).forEach((val) => {
    if (typeof val === 'number') {
      sum += val;
      count += 1;
    }
  });

  if (count === 0) {
    return { total: null, count: 0 };
  }

  return { total: sum, count };
}

export function computeAllGrades(
  s1: Record<string, ScoreValueSec123>,
  s2: Record<string, Record<string, ScoreValueSec123>>,
  s3: Record<string, ScoreValueSec123>,
  s4: Record<string, Record<string, ScoreValueSec4>>,
  isMD: boolean,
  eligibleDirectorKeys: string[],
  activeDepts: string[]
): CalculatedGrades {
  const b = calculateSectionAvg(s1);

  // Section 2: Calculate average across all evaluated directors
  let directorSum = 0;
  let directorRatingCount = 0;
  let evaluatedDirectorsCount = 0;

  eligibleDirectorKeys.forEach((dirKey) => {
    const dirScores = s2?.[dirKey];
    if (dirScores && Object.keys(dirScores).length > 0) {
      const res = calculateSectionAvg(dirScores);
      if (res.count > 0) {
        evaluatedDirectorsCount++;
        directorSum += res.totalValidScore;
        directorRatingCount += res.count;
      }
    }
  });

  const dirAvg = directorRatingCount > 0 ? Number((directorSum / directorRatingCount).toFixed(2)) : null;

  // Section 3: MD Evaluation
  const m = isMD ? { avg: null, count: 0 } : calculateSectionAvg(s3);

  // Section 4: Staff Scores per department
  const staffScores: Record<string, { total: number | null; grade: string; count: number }> = {};
  activeDepts.forEach((deptId) => {
    const deptMap = s4?.[deptId] || {};
    const res = calculateStaffTotal(deptMap);
    staffScores[deptId] = {
      total: res.total,
      grade: res.total !== null ? getGradeForStaffScore(res.total) : 'ยังไม่ประเมิน',
      count: res.count,
    };
  });

  return {
    boardAvg: b.avg,
    boardGrade: b.avg !== null ? getGradeForDirectorAvg(b.avg) : 'ยังไม่ประเมิน',
    boardCount: b.count,
    boardTotalQuestions: 27,

    directorAvg: dirAvg,
    directorGrade: dirAvg !== null ? getGradeForDirectorAvg(dirAvg) : 'ยังไม่ประเมิน',
    directorEvaluatedCount: evaluatedDirectorsCount,
    directorTotalEligible: eligibleDirectorKeys.length,

    mdAvg: isMD ? null : m.avg,
    mdGrade: isMD ? 'N/A (ยกเว้น)' : m.avg !== null ? getGradeForDirectorAvg(m.avg) : 'ยังไม่ประเมิน',
    mdCount: m.count,
    mdTotalQuestions: 45,

    staffScores,
  };
}

export function getGradeBadgeStyle(grade: string): { bg: string; text: string; border: string } {
  switch (grade) {
    case 'ดีมาก':
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        text: 'text-emerald-700 font-bold',
        border: 'border-emerald-200',
      };
    case 'ดี':
      return {
        bg: 'bg-blue-50 text-blue-800 border-blue-300',
        text: 'text-blue-700 font-bold',
        border: 'border-blue-200',
      };
    case 'ปานกลาง':
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-300',
        text: 'text-amber-700 font-bold',
        border: 'border-amber-200',
      };
    case 'พอใช้':
      return {
        bg: 'bg-orange-50 text-orange-800 border-orange-300',
        text: 'text-orange-700 font-bold',
        border: 'border-orange-200',
      };
    case 'ควรปรับปรุง':
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-300',
        text: 'text-rose-700 font-bold',
        border: 'border-rose-200',
      };
    default:
      return {
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        text: 'text-slate-600 font-medium',
        border: 'border-slate-200',
      };
  }
}
