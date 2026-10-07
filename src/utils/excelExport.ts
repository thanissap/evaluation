import * as XLSX from 'xlsx';
import { EvaluationFormData, CalculatedGrades, EvaluationItem, Director } from '../types/evaluation';
import {
  COMPANIES,
  SUBCOMMITTEE_DEPTS,
  DEFAULT_SECTION_1_ITEMS,
  DEFAULT_SECTION_2_ITEMS,
  DEFAULT_SECTION_3_ITEMS,
  DEFAULT_SECTION_4_ITEMS,
} from '../data/evaluationData';

export function exportEvaluationToExcel(
  formData: EvaluationFormData,
  grades: CalculatedGrades,
  directors: Director[],
  questions: {
    section1: EvaluationItem[];
    section2: EvaluationItem[];
    section3: EvaluationItem[];
    section4: EvaluationItem[];
  },
  aiSynthesis?: any
) {
  const companyInfo = COMPANIES.find((c) => c.id === formData.company);
  const wb = XLSX.utils.book_new();

  // Helper for score labels
  const getLabelSec123 = (val: any) => {
    if (val === 'NA') return 'ไม่เกี่ยวข้อง (N/A)';
    if (val === 4) return '4 - เห็นด้วยอย่างมาก (ดีเยี่ยม)';
    if (val === 3) return '3 - เห็นด้วยค่อนข้างมาก (ดี)';
    if (val === 2) return '2 - เห็นด้วย (พอสมควร)';
    if (val === 1) return '1 - ไม่เห็นด้วย (เล็กน้อย)';
    if (val === 0) return '0 - ไม่เห็นด้วยอย่างยิ่ง';
    return 'ยังไม่ระบุ';
  };

  const getLabelSec4 = (val: any) => {
    if (val === 5) return '5 - ดีมาก';
    if (val === 4) return '4 - ดี';
    if (val === 3) return '3 - ปานกลาง';
    if (val === 2) return '2 - พอใช้';
    if (val === 1) return '1 - ปรับปรุง';
    if (val === 0) return '0 - ไม่ผ่านเกณฑ์';
    return 'ยังไม่ระบุ';
  };

  // 1. Summary Sheet
  const summaryRows: any[] = [
    ['ระบบประเมินผลการปฏิบัติงานประจำปี เครือแคปปิตอล ลิ้งค์'],
    ['CAPITAL LINK GROUP - ANNUAL GOVERNANCE & PERFORMANCE EVALUATION'],
    [],
    ['ข้อมูลทั่วไป (General Information)'],
    ['บริษัท (Company)', `${companyInfo?.nameTh} (${formData.company})`],
    ['ปีการประเมิน (Fiscal Year)', `พ.ศ. ${formData.year}`],
    ['กรรมการผู้ประเมิน (Evaluator)', formData.evaluatorName],
    [
      'รูปแบบการประเมิน (Submission Mode)',
      formData.isSupervisorMode
        ? `มอบหมายหัวหน้างานปฏิบัติการแทน (Supervisor Delegation)`
        : 'กรรมการประเมินโดยตรง (Director Direct)',
    ],
  ];

  if (formData.isSupervisorMode) {
    summaryRows.push([
      'ผู้ปฏิบัติการแทน (Acting Supervisor)',
      `${formData.supervisorName || '-'} (${formData.supervisorTitle || '-'})`,
    ]);
  }

  summaryRows.push(
    ['สถานะการประเมิน (Status)', formData.status === 'SUBMITTED' ? 'ส่งผลแล้ว (SUBMITTED)' : 'แบบร่าง (DRAFT)'],
    ['วันที่บันทึกล่าสุด (Last Saved)', new Date(formData.lastSavedAt).toLocaleString('th-TH')],
    []
  );

  summaryRows.push(
    ['สรุปผลคะแนนเบื้องต้น (Preliminary Summary)'],
    ['มิติการประเมิน (Evaluation Dimension)', 'คะแนน (Score)', 'เกณฑ์เต็ม (Max)', 'ความคืบหน้าการตอบ']
  );

  if (!formData.isSupervisorMode) {
    summaryRows.push([
      'ส่วนที่ 1: คณะกรรมการทั้งชุด',
      grades.boardAvg !== null ? grades.boardAvg.toFixed(2) : 'N/A',
      '4.00 (เฉลี่ย)',
      `ตอบแล้ว ${grades.boardCount} จาก ${questions.section1.length} ข้อ`,
    ]);

    summaryRows.push([
      'ส่วนที่ 2: กรรมการรายบุคคล (Cross-Evaluation)',
      grades.directorAvg !== null ? grades.directorAvg.toFixed(2) : 'N/A',
      '4.00 (เฉลี่ยรวม)',
      `ประเมินแล้ว ${grades.directorEvaluatedCount} จาก ${directors.length} ท่าน`,
    ]);

    if (formData.evaluatorKey !== 'kriangkrai') {
      summaryRows.push([
        'ส่วนที่ 3: ผู้จัดการใหญ่ (MD)',
        grades.mdAvg !== null ? grades.mdAvg.toFixed(2) : 'N/A',
        '4.00 (เฉลี่ย)',
        `ตอบแล้ว ${grades.mdCount} จาก ${questions.section3.length} ข้อ`,
      ]);
    }
  }

  if (formData.company === 'CLC') {
    Object.entries(grades.staffScores).forEach(([deptId, data]) => {
      const deptObj = SUBCOMMITTEE_DEPTS.find((d) => d.id === deptId);
      summaryRows.push([
        `ส่วนที่ 4: พนักงานสายงาน ${deptObj?.nameTh || deptId}`,
        data.total !== null ? data.total : 'N/A',
        '100.00 (คะแนนรวม)',
        `ตอบแล้ว ${data.count} จาก 20 ข้อ`,
      ]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวม');

  // 2. Section 1 Sheet (Board - 27 items)
  if (!formData.isSupervisorMode) {
    const s1Rows: any[] = [
      ['แบบประเมินคณะกรรมการบริษัท (สำหรับประเมินคณะกรรมการบริษัททั้งชุด)'],
      ['ข้อที่', 'หมวดหมู่', 'หัวข้อการประเมิน', 'คะแนน (0-4 / N/A)', 'คำอธิบายเกณฑ์'],
    ];
    questions.section1.forEach((item) => {
      const val = formData.section1?.[item.id];
      s1Rows.push([
        item.code,
        item.category || '-',
        item.title,
        val !== null && val !== undefined ? val : '-',
        getLabelSec123(val),
      ]);
    });
    if (formData.section1Comment) {
      s1Rows.push([]);
      s1Rows.push(['ความเห็น / ข้อเสนอแนะ:', formData.section1Comment]);
    }
    const wsS1 = XLSX.utils.aoa_to_sheet(s1Rows);
    XLSX.utils.book_append_sheet(wb, wsS1, 'ชุดที่ 1 บอร์ดทั้งชุด');

    // 3. Section 2 Sheet (Directors Cross-Evaluation - 11 items per director)
    const s2Rows: any[] = [
      ['แบบประเมินกรรมการรายบุคคล (ประเมินกรรมการทุกคน)'],
      ['กรรมการที่ถูกประเมิน', 'ข้อที่', 'หัวข้อการประเมิน', 'คะแนน (0-4 / N/A)', 'คำอธิบายเกณฑ์'],
    ];
    directors.forEach((dir) => {
      const dirScores = formData.section2?.[dir.key] || {};
      questions.section2.forEach((item) => {
        const val = dirScores[item.id];
        s2Rows.push([
          `${dir.name} (${dir.title})`,
          item.code,
          item.title,
          val !== null && val !== undefined ? val : '-',
          getLabelSec123(val),
        ]);
      });
      const dirComment = formData.section2Comments?.[dir.key];
      if (dirComment) {
        s2Rows.push(['', '', 'ความเห็นต่อท่านนี้:', dirComment, '']);
      }
    });
    const wsS2 = XLSX.utils.aoa_to_sheet(s2Rows);
    XLSX.utils.book_append_sheet(wb, wsS2, 'ชุดที่ 2 กรรมการรายบุคคล');

    // 4. Section 3 Sheet (MD - 45 items)
    if (formData.evaluatorKey !== 'kriangkrai') {
      const s3Rows: any[] = [
        ['แบบประเมินผู้จัดการใหญ่ (นายเกรียงไกร ศิระวณิชการ)'],
        ['ข้อที่', 'หมวดหมู่', 'หัวข้อการประเมิน', 'คะแนน (0-4 / N/A)', 'คำอธิบายเกณฑ์'],
      ];
      questions.section3.forEach((item) => {
        const val = formData.section3?.[item.id];
        s3Rows.push([
          item.code,
          item.category || '-',
          item.title,
          val !== null && val !== undefined ? val : '-',
          getLabelSec123(val),
        ]);
      });
      if (formData.section3Comment) {
        s3Rows.push([]);
        s3Rows.push(['ความเห็น / ข้อเสนอแนะ:', formData.section3Comment]);
      }
      const wsS3 = XLSX.utils.aoa_to_sheet(s3Rows);
      XLSX.utils.book_append_sheet(wb, wsS3, 'ชุดที่ 3 ผู้จัดการใหญ่');
    }
  }

  // 5. Section 4 Sheet (Staff per department)
  if (formData.company === 'CLC') {
    Object.keys(formData.section4 || {}).forEach((deptId) => {
      const deptMap = formData.section4[deptId] || {};
      const deptObj = SUBCOMMITTEE_DEPTS.find((d) => d.id === deptId);
      const s4Rows: any[] = [
        [`แบบประเมินผลการปฏิบัติงานของพนักงานสายงาน ${deptObj?.nameTh || deptId} (HR-58-11#3)`],
        ['ข้อที่', 'หัวข้อการประเมิน', 'คะแนน (0-5)', 'ระดับผลงาน'],
      ];
      questions.section4.forEach((item) => {
        const val = deptMap[item.id];
        s4Rows.push([
          item.code,
          item.title,
          val !== null && val !== undefined ? val : '-',
          getLabelSec4(val),
        ]);
      });
      const c = formData.section4Comments?.[deptId];
      if (c) {
        s4Rows.push([]);
        s4Rows.push(['ความเห็น / ข้อเสนอแนะ:', c]);
      }
      const wsS4 = XLSX.utils.aoa_to_sheet(s4Rows);
      XLSX.utils.book_append_sheet(wb, wsS4, `ชุดที่ 4 พนักงาน ${deptId}`);
    });
  }

  const sanitizedName = formData.evaluatorName.replace(/\s+/g, '_');
  const filename = `CapitalLink_Evaluation_${formData.company}_${formData.year}_${sanitizedName}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export Master Google Sheet / Excel Summary of ALL directors for the Company Secretary
 */
export function exportMasterSummaryToExcel(
  company: string,
  year: string,
  directors: Director[],
  records: Record<string, EvaluationFormData | null>,
  calcSummaryMap: Record<string, any>
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'ลำดับ',
    'ชื่อ-นามสกุล กรรมการ',
    'ตำแหน่ง',
    'สถานะการประเมิน',
    'วันที่ส่งผล',
    'ส่วนที่ 1: บอร์ดทั้งชุด (เฉลี่ย /4.00)',
    'ส่วนที่ 2: รายบุคคล (เฉลี่ย /4.00)',
    'ส่วนที่ 3: ผู้จัดการใหญ่ MD (เฉลี่ย /4.00)',
    'ส่วนที่ 4: CU (เต็ม 100)',
    'ส่วนที่ 4: RISK (เต็ม 100)',
    'ส่วนที่ 4: IA (เต็ม 100)',
    'หมายเหตุ',
  ];

  const rows: any[] = [
    [`รายงานสรุปผลการประเมินประจำปี ${year} - ${company}`],
    ['สำหรับฝ่ายเลขานุการบริษัทและคณะกรรมการสรรหาและกำหนดค่าตอบแทน'],
    [],
    headers,
  ];

  directors.forEach((dir, idx) => {
    const rec = records[dir.key];
    const calc = calcSummaryMap[dir.key] || {};

    const statusText = rec?.status === 'SUBMITTED' ? 'ส่งผลแล้ว (SUBMITTED)' : rec?.status === 'DRAFT' ? 'แบบร่าง (DRAFT)' : 'ยังไม่เริ่มประเมิน';
    const submittedDate = rec?.submittedAt ? new Date(rec.submittedAt).toLocaleDateString('th-TH') : '-';

    const s1Avg = calc.boardAvg !== null && calc.boardAvg !== undefined ? calc.boardAvg.toFixed(2) : '-';
    const s2Avg = calc.directorAvg !== null && calc.directorAvg !== undefined ? calc.directorAvg.toFixed(2) : '-';
    const s3Avg = dir.isMD ? 'ยกเว้นตนเอง (N/A)' : calc.mdAvg !== null && calc.mdAvg !== undefined ? calc.mdAvg.toFixed(2) : '-';

    const cuScore = calc.staffScores?.CU?.total ?? '-';
    const riskScore = calc.staffScores?.RISK?.total ?? '-';
    const iaScore = calc.staffScores?.IA?.total ?? '-';

    rows.push([
      idx + 1,
      dir.name,
      dir.title,
      statusText,
      submittedDate,
      s1Avg,
      s2Avg,
      s3Avg,
      cuScore,
      riskScore,
      iaScore,
      rec?.isSupervisorMode ? 'มอบหมายหัวหน้างาน' : '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'สรุปผลกรรมการทุกคน');

  const filename = `CapitalLink_Master_Summary_${company}_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

