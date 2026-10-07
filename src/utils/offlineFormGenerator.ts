import { Director, CompanyId, FiscalYear, SubCommitteeDept, DirectorPermissions } from '../types/evaluation';
import { getGradeForDirectorAvg, getGradeForStaffScore } from './grading';

export function generateOfflineEvaluationHtml(params: {
  director: Director;
  company: CompanyId;
  year: FiscalYear;
  isSupervisor?: boolean;
  supervisorDept?: SubCommitteeDept;
  questions: any;
  permissions?: Record<string, DirectorPermissions>;
  allDirectors: Director[];
}): string {
  const { director, company, year, isSupervisor, supervisorDept, questions, permissions, allDirectors } = params;
  const perm = permissions ? permissions[director.key] : null;

  const titlePrefix = isSupervisor
    ? `แบบประเมินผลการปฏิบัติงานของพนักงาน (สายงาน ${supervisorDept}) - ได้รับมอบหมายจาก ${director.name}`
    : `แบบประเมินผลการปฏิบัติงานประจำปี ${year} - ${director.name}`;

  const targetDirs = allDirectors.filter((d) => !d.companySpecific || d.companySpecific === company);

  const serializedData = JSON.stringify({
    director,
    company,
    year,
    isSupervisor: !!isSupervisor,
    supervisorDept: supervisorDept || 'CU',
    questions,
    targetDirectors: targetDirs,
    hasSec1: !isSupervisor && (company === 'CLC' ? perm?.clc?.canEvaluateBoard : perm?.clfg?.canEvaluateBoard),
    hasSec2: !isSupervisor && (company === 'CLC' ? perm?.clc?.canEvaluateDirectors : perm?.clfg?.canEvaluateDirectors),
    hasSec3: !isSupervisor && (company === 'CLC' ? perm?.clc?.canEvaluateMD : perm?.clfg?.canEvaluateMD),
    hasSec4: isSupervisor || (company === 'CLC' && (perm?.clc?.canEvaluateCU || perm?.clc?.canEvaluateIA || perm?.clc?.canEvaluateRISK)),
  });

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titlePrefix} - Capital Link</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', sans-serif; background-color: #f8fafc; }
    h1, h2, h3, h4, .brand-font { font-family: 'Plus Jakarta Sans', 'Sarabun', sans-serif; }
  </style>
</head>
<body class="text-slate-800 antialiased pb-20">
  <div class="bg-gradient-to-r from-amber-950 via-amber-900 to-stone-900 text-white p-4 sm:p-6 shadow-md border-b border-amber-800">
    <div class="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 mb-1">
          Capital Link Evaluation Portal • แบบประเมินออฟไลน์ (Standalone)
        </div>
        <h1 class="text-lg sm:text-xl font-extrabold text-white">
          ${company === 'CLC' ? 'บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์ (CLC)' : 'บมจ.แคปปิตอล ลิ้งค์ ไฟแนนเชียล กรุ๊ป (CLFG)'}
        </h1>
        <p class="text-xs sm:text-sm text-amber-200/90 mt-0.5">
          ${isSupervisor ? `โหมดปฏิบัติการแทน (สายงาน ${supervisorDept}) • มอบหมายโดย ${director.name}` : `ผู้ประเมิน: ${director.name} (${director.title})`} • ปี พ.ศ. ${year}
        </p>
      </div>
      <div class="text-right sm:self-center">
        <span class="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
          ✓ เปิดทำได้ทันที ไม่ต้องล็อกอิน Google
        </span>
      </div>
    </div>
  </div>

  <main class="max-w-4xl mx-auto px-4 pt-6 space-y-6">
    <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      <h3 class="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
        <span>คำชี้แจงการทำแบบประเมิน</span>
      </h3>
      <p class="text-xs text-slate-600 mt-1 leading-relaxed">
        ท่านสามารถทำแบบประเมินบนหน้าจอนี้ได้โดยตรง ระบบจะคำนวณคะแนนและเกรดตามเกณฑ์ธรรมาภิบาลให้อัตโนมัติ เมื่อทำเสร็จสิ้น กรุณากดปุ่ม <strong>"บันทึกและส่งออกผลการประเมิน"</strong> ด้านล่างสุด เพื่อดาวน์โหลดไฟล์ผลการประเมิน (.json) และส่งไฟล์กลับให้ฝ่ายเลขานุการบริษัททาง LINE หรือ Email
      </p>
    </div>

    <form id="evalForm" class="space-y-6">
      <div id="sectionsContainer"></div>

      <div class="bg-white rounded-2xl border border-amber-300 p-5 sm:p-6 shadow-md text-center space-y-3">
        <h3 class="font-bold text-slate-900 text-base sm:text-lg">
          ยืนยันการส่งผลการประเมิน
        </h3>
        <p class="text-xs text-slate-600 max-w-lg mx-auto">
          เมื่อท่านให้คะแนนครบถ้วนแล้ว ให้กดปุ่มด้านล่างเพื่อส่งออกไฟล์ผลการประเมินของท่าน เพื่อนำส่งให้ฝ่ายเลขานุการบริษัทต่อไป
        </p>
        <button
          type="button"
          onclick="handleExportResults()"
          class="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-900 to-amber-950 hover:from-amber-800 hover:to-amber-900 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          📥 บันทึกและส่งออกไฟล์ผลการประเมิน (.json)
        </button>
      </div>
    </form>
  </main>

  <script>
    const APP_DATA = ${serializedData};
    const answers = {
      section1: {},
      section2: {},
      section3: {},
      section4: {},
      section1Comment: '',
      section2Comments: {},
      section3Comment: '',
      section4Comments: {},
    };

    function renderForm() {
      const container = document.getElementById('sectionsContainer');
      let html = '';

      // Section 1: Board Overview
      if (APP_DATA.hasSec1 && APP_DATA.questions.section1) {
        html += \`
          <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <span class="text-xs font-bold text-amber-800 uppercase tracking-wider">ส่วนที่ 1</span>
              <h2 class="text-base font-bold text-slate-900">แบบประเมินผลการปฏิบัติงานของคณะกรรมการทั้งคณะ</h2>
              <p class="text-xs text-slate-500 mt-0.5">เกณฑ์คะแนน: 4 = ดีเยี่ยม, 3 = ดี, 2 = พอสมควร, 1 = เล็กน้อย, 0 = ไม่มีการดำเนินการ, N/A = ไม่คิดคะแนน</p>
            </div>
            <div class="space-y-4">
        \`;
        APP_DATA.questions.section1.forEach((q, idx) => {
          html += \`
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="text-xs font-semibold text-slate-800">\${idx + 1}. \${q.text}</div>
              <div class="flex items-center gap-2 flex-wrap pt-1">
                \${[4, 3, 2, 1, 0, 'NA'].map(val => \`
                  <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-amber-50 cursor-pointer text-xs font-bold text-slate-700">
                    <input type="radio" name="s1_\${q.id}" value="\${val}" onchange="setS1Score('\${q.id}', '\${val}')" class="text-amber-900 focus:ring-amber-500">
                    <span>\${val}</span>
                  </label>
                \`).join('')}
              </div>
            </div>
          \`;
        });
        html += \`
            </div>
          </div>
        \`;
      }

      // Section 3: MD
      if (APP_DATA.hasSec3 && APP_DATA.questions.section3) {
        html += \`
          <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <span class="text-xs font-bold text-amber-800 uppercase tracking-wider">ส่วนที่ 3</span>
              <h2 class="text-base font-bold text-slate-900">แบบประเมินผลการปฏิบัติงานของผู้จัดการใหญ่ (MD)</h2>
            </div>
            <div class="space-y-4">
        \`;
        APP_DATA.questions.section3.forEach((q, idx) => {
          html += \`
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="text-xs font-semibold text-slate-800">\${idx + 1}. \${q.text}</div>
              <div class="flex items-center gap-2 flex-wrap pt-1">
                \${[4, 3, 2, 1, 0, 'NA'].map(val => \`
                  <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-amber-50 cursor-pointer text-xs font-bold text-slate-700">
                    <input type="radio" name="s3_\${q.id}" value="\${val}" onchange="setS3Score('\${q.id}', '\${val}')" class="text-amber-900 focus:ring-amber-500">
                    <span>\${val}</span>
                  </label>
                \`).join('')}
              </div>
            </div>
          \`;
        });
        html += \`
            </div>
          </div>
        \`;
      }

      // Section 4: Staff
      if (APP_DATA.hasSec4 && APP_DATA.questions.section4) {
        const staffDept = APP_DATA.isSupervisor ? APP_DATA.supervisorDept : 'CU';
        html += \`
          <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <span class="text-xs font-bold text-amber-800 uppercase tracking-wider">ส่วนที่ 4</span>
              <h2 class="text-base font-bold text-slate-900">แบบประเมินผลการปฏิบัติงานของพนักงานสายงานกำกับ (สายงาน \${staffDept})</h2>
              <p class="text-xs text-slate-500 mt-0.5">รวม 20 ข้อ รวมเต็ม 100 คะแนน (เกณฑ์คะแนน: 5 = ดีมาก, 4 = ดี, 3 = ปานกลาง, 2 = พอใช้, 1 = ปรับปรุง, 0 = ไม่ผ่าน)</p>
            </div>
            <div class="space-y-4">
        \`;
        APP_DATA.questions.section4.forEach((q, idx) => {
          html += \`
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="text-xs font-semibold text-slate-800">\${idx + 1}. \${q.text}</div>
              <div class="flex items-center gap-2 flex-wrap pt-1">
                \${[5, 4, 3, 2, 1, 0].map(val => \`
                  <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-amber-50 cursor-pointer text-xs font-bold text-slate-700">
                    <input type="radio" name="s4_\${q.id}" value="\${val}" onchange="setS4Score('\${staffDept}', '\${q.id}', \${val})" class="text-amber-900 focus:ring-amber-500">
                    <span>\${val}</span>
                  </label>
                \`).join('')}
              </div>
            </div>
          \`;
        });
        html += \`
            </div>
          </div>
        \`;
      }

      container.innerHTML = html;
    }

    function setS1Score(qId, val) {
      answers.section1[qId] = val === 'NA' ? 'NA' : Number(val);
    }
    function setS3Score(qId, val) {
      answers.section3[qId] = val === 'NA' ? 'NA' : Number(val);
    }
    function setS4Score(dept, qId, val) {
      if (!answers.section4[dept]) answers.section4[dept] = {};
      answers.section4[dept][qId] = Number(val);
    }

    function handleExportResults() {
      const now = new Date().toISOString();
      const payload = {
        id: \`\${APP_DATA.company}_\${APP_DATA.year}_\${APP_DATA.director.key}\${APP_DATA.isSupervisor ? '_' + APP_DATA.supervisorDept : ''}\`,
        year: APP_DATA.year,
        company: APP_DATA.company,
        evaluatorKey: APP_DATA.director.key,
        evaluatorName: APP_DATA.director.name,
        isSupervisorMode: APP_DATA.isSupervisor,
        supervisorName: '',
        supervisorTitle: '',
        supervisorDept: APP_DATA.isSupervisor ? APP_DATA.supervisorDept : 'CU',
        selectedStaffDept: APP_DATA.isSupervisor ? APP_DATA.supervisorDept : 'CU',
        status: 'SUBMITTED',
        submittedAt: now,
        lastSavedAt: now,
        section1: answers.section1,
        section2: answers.section2,
        section3: answers.section3,
        section4: answers.section4,
        section1Comment: answers.section1Comment,
        section2Comments: answers.section2Comments,
        section3Comment: answers.section3Comment,
        section4Comments: answers.section4Comments,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', \`ผลการประเมิน_\${APP_DATA.director.name}_\${APP_DATA.company}_\${APP_DATA.year}.json\`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      alert('บันทึกผลการประเมินเรียบร้อยแล้ว! กรุณาส่งไฟล์ .json ที่ดาวน์โหลดได้นี้ กลับไปยังฝ่ายเลขานุการบริษัททาง LINE หรือ Email ครับ');
    }

    window.onload = renderForm;
  </script>
</body>
</html>`;
}
