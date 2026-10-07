import React, { useState, useEffect } from 'react';
import { CompanyId, FiscalYear, Director, SubCommitteeDept } from '../types/evaluation';
import {
  SUBCOMMITTEE_DEPTS,
  COMPANIES,
  FISCAL_YEARS,
  getStoredQuestions,
  getStoredDirectorPermissions,
} from '../data/evaluationData';
import { generateOfflineEvaluationHtml } from '../utils/offlineFormGenerator';
import {
  Share2,
  X,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Calendar,
  Building2,
  Globe,
  AlertTriangle,
  PlayCircle,
  Save,
  FileDown,
} from 'lucide-react';

interface DelegationShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyId;
  year: FiscalYear;
  directors: Director[];
  currentDirectorKey: string;
  onOpenAdminModal?: () => void;
  onSwitchToContext?: (params: {
    company: CompanyId;
    year: FiscalYear;
    evaluatorKey: string;
    isSupervisor: boolean;
    dept: SubCommitteeDept;
  }) => void;
}

export const DelegationShareModal: React.FC<DelegationShareModalProps> = ({
  isOpen,
  onClose,
  company: initialCompany,
  year: initialYear,
  directors,
  currentDirectorKey,
  onOpenAdminModal,
  onSwitchToContext,
}) => {
  const [selectedCompany, setSelectedCompany] = useState<CompanyId>(initialCompany);
  const [selectedYear, setSelectedYear] = useState<FiscalYear>(initialYear);
  const [selectedDirectorKey, setSelectedDirectorKey] = useState(currentDirectorKey);
  const [selectedDept, setSelectedDept] = useState<SubCommitteeDept>('CU');
  const [linkType, setLinkType] = useState<'director' | 'supervisor'>('director');
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedParams, setCopiedParams] = useState(false);
  const [domainSavedNotice, setDomainSavedNotice] = useState(false);

  // Base URL state (defaults to direct live app URL)
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('clg_public_domain');
      if (stored && !stored.includes('ais-pre-')) return stored;
      return window.location.origin + window.location.pathname;
    }
    return '';
  });

  const [isEditingDomain, setIsEditingDomain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Sync from server if available
      fetch('/api/config')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.publicBaseUrl && !data.publicBaseUrl.includes('ais-pre-')) {
            setBaseUrl(data.publicBaseUrl);
          } else {
            const stored = localStorage.getItem('clg_public_domain');
            if (stored && !stored.includes('ais-pre-')) {
              setBaseUrl(stored);
            } else {
              setBaseUrl(window.location.origin + window.location.pathname);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanBase = baseUrl.replace(/\/+$/, '');

  let queryParams = '';
  if (linkType === 'supervisor') {
    queryParams = `?c=${selectedCompany}&y=${selectedYear}&k=${selectedDirectorKey}&role=supervisor&dept=${selectedDept}`;
  } else {
    queryParams = `?k=${selectedDirectorKey}&y=${selectedYear}`;
  }

  const generatedUrl = `${cleanBase}${queryParams}`;

  const handleCopyFull = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleCopyParamsOnly = () => {
    navigator.clipboard.writeText(queryParams);
    setCopiedParams(true);
    setTimeout(() => setCopiedParams(false), 2000);
  };

  const handleSaveDomain = async (newDomain: string) => {
    const trimmed = newDomain.trim();
    setBaseUrl(trimmed);
    try {
      localStorage.setItem('clg_public_domain', trimmed);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicBaseUrl: trimmed }),
      });
      setDomainSavedNotice(true);
      setTimeout(() => setDomainSavedNotice(false), 2500);
      setIsEditingDomain(false);
    } catch {
      setDomainSavedNotice(true);
      setTimeout(() => setDomainSavedNotice(false), 2500);
      setIsEditingDomain(false);
    }
  };

  const handleDownloadOffline = () => {
    const dir = directors.find((d) => d.key === selectedDirectorKey) || directors[0];
    const questions = getStoredQuestions();
    const permissions = getStoredDirectorPermissions();

    const htmlContent = generateOfflineEvaluationHtml({
      director: dir,
      company: selectedCompany,
      year: selectedYear,
      isSupervisor: linkType === 'supervisor',
      supervisorDept: selectedDept,
      questions,
      permissions,
      allDirectors: directors,
    });

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = linkType === 'supervisor'
      ? `แบบประเมินพนักงานสายงาน${selectedDept}_${selectedYear}.html`
      : `แบบประเมิน_${dir.name}_${selectedCompany}_${selectedYear}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isDevUrl =
    baseUrl.includes('run.app') ||
    baseUrl.includes('localhost') ||
    baseUrl.includes('ais-dev-') ||
    baseUrl.includes('ais-pre-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-amber-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-800/80 text-amber-200 border border-amber-600/50">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                สร้างลิงก์สำหรับส่งให้กรรมการและหัวหน้างาน (Magic Links)
              </h3>
              <p className="text-xs text-amber-200/80">
                ส่งลิงก์เพื่อเปิดทำแบบประเมินได้ทันที ไม่ต้องค้นหาชื่อใหม่
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-800/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Notice on Direct Working Link & Immediate Database Sync */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-1.5 shadow-2xs">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>ลิงก์ตรงของระบบพร้อมใช้งานทันที (Direct Link) & บันทึกลงฐานข้อมูลส่วนกลางทันที</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-900/90">
              เมื่อกด <strong>"คัดลอกลิงก์ใช้งานทันที"</strong> ผู้รับสิทธิ์สามารถเปิดเข้าทำแบบประเมินได้ทันทีโดยไม่ต้องล็อกอิน และเมื่อทำเสร็จกด <strong>"ยืนยันส่งผลการประเมิน"</strong> ข้อมูลจะถูกส่งกลับเข้าฐานข้อมูลส่วนกลางและระบบสำรองข้อมูลอัตโนมัติทันที
            </p>
            <div className="pt-1 flex items-center gap-2 flex-wrap text-[11px] text-emerald-800">
              <span>💡 หากต้องการเปลี่ยน Domain / Public URL แบบกำหนดเอง สามารถกด</span>
              <button
                type="button"
                onClick={() => setIsEditingDomain(true)}
                className="font-bold underline text-emerald-900 hover:text-emerald-950 cursor-pointer"
              >
                ตั้งค่าโดเมนเสริมได้ที่นี่
              </button>
            </div>
          </div>

          {/* Public Domain Settings Accordion */}
          {isEditingDomain && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-800" />
                  <span>กำหนด Domain / Public Base URL ของเว็บไซต์จริง:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditingDomain(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  ปิด
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://evaluation.capitallink.co.th"
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleSaveDomain(baseUrl)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึก</span>
                </button>
              </div>
              {domainSavedNotice && (
                <p className="text-[11px] text-emerald-700 font-bold">
                  ✅ บันทึกโดเมนสาธารณะเรียบร้อยแล้ว ลิงก์ทั้งหมดถูกอัปเดตทันที
                </p>
              )}
            </div>
          )}

          {/* Target Company & Year Selection by Secretary */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-amber-800" />
                <span>บริษัทเป้าหมาย:</span>
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value as CompanyId)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
              >
                {COMPANIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.nameTh}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-800" />
                <span>ปี พ.ศ. ที่ประเมิน:</span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value as FiscalYear)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
              >
                {FISCAL_YEARS.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Link Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              วัตถุประสงค์ของลิงก์:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLinkType('director')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  linkType === 'director'
                    ? 'border-amber-700 bg-amber-50 text-amber-950 ring-2 ring-amber-500/40'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>👔 ลิงก์สำหรับกรรมการโดยตรง</span>
                <span className="text-[10px] font-normal text-slate-500 mt-1">
                  กรรมการเปิดแล้วจะล็อกชื่อท่านนั้นทันที และสลับบริษัท CLC/CLFG ได้ในหน้าจอ
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLinkType('supervisor')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  linkType === 'supervisor'
                    ? 'border-amber-700 bg-amber-50 text-amber-950 ring-2 ring-amber-500/40'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>🛡️ มอบหมายหัวหน้างาน</span>
                <span className="text-[10px] font-normal text-slate-500 mt-1">
                  ล็อกเฉพาะส่วนที่ 4 (พนักงาน) ซ่อนส่วนที่ 1-3 เพื่อความลับบอร์ด
                </span>
              </button>
            </div>
          </div>

          {/* Director Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              กรรมการเจ้าของสิทธิ์:
            </label>
            <select
              value={selectedDirectorKey}
              onChange={(e) => setSelectedDirectorKey(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
            >
              {directors.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name} ({d.title})
                </option>
              ))}
            </select>
          </div>

          {/* Department Select (if supervisor mode) */}
          {linkType === 'supervisor' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                สายงานที่มอบหมายให้ประเมิน:
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as SubCommitteeDept)}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
              >
                {SUBCOMMITTEE_DEPTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.id} - {dept.nameTh}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generated URL Display with Quick Actions */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                ลิงก์ส่งต่อที่สร้างขึ้น (Magic Link URL):
              </label>
              <button
                type="button"
                onClick={() => setIsEditingDomain((prev) => !prev)}
                className="text-[11px] text-amber-900 font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                <span>{isEditingDomain ? 'ซ่อนการตั้งค่าโดเมน' : 'เปลี่ยนโดเมน/Public URL'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-mono text-[11px] text-slate-700 select-all break-all">
              {generatedUrl}
            </div>

            {/* Quick Copy Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyFull}
                className="w-full px-3.5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                {copiedFull ? <Check className="w-4 h-4 text-amber-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedFull ? 'คัดลอกลิงก์เต็มแล้ว!' : 'คัดลอกลิงก์เต็ม (Full URL)'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyParamsOnly}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                title="คัดลอกเฉพาะพารามิเตอร์เพื่อนำไปต่อท้ายโดเมนที่ต้องการด้วยตนเอง"
              >
                {copiedParams ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{copiedParams ? 'คัดลอกพารามิเตอร์แล้ว!' : 'คัดลอกเฉพาะพารามิเตอร์ (?k=...)'}</span>
              </button>
            </div>

            {/* Switch on Current Page Option */}
            {onSwitchToContext && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onSwitchToContext({
                      company: selectedCompany,
                      year: selectedYear,
                      evaluatorKey: selectedDirectorKey,
                      isSupervisor: linkType === 'supervisor',
                      dept: selectedDept,
                    });
                    onClose();
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
                  title="สลับสิทธิ์การทำแบบประเมินบนหน้าจอนี้ทันทีเพื่อทดสอบหรือทำแทนกรรมการ"
                >
                  <PlayCircle className="w-4 h-4 text-emerald-700" />
                  <span>⚡ สลับทำแบบประเมินในหน้านี้ทันที (ในนาม {directors.find((d) => d.key === selectedDirectorKey)?.name})</span>
                </button>
              </div>
            )}

            {/* Download Offline Form for LINE/Email (Zero Login, Zero Error) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDownloadOffline}
                className="w-full px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-950 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
                title="ดาวน์โหลดไฟล์แบบประเมินสำหรับส่งทาง LINE (เปิดได้ทุกอุปกรณ์โดยไม่ต้องล็อกอิน Google 100%)"
              >
                <FileDown className="w-4 h-4 text-blue-700" />
                <span>📥 ดาวน์โหลดไฟล์แบบประเมินออฟไลน์ (.html ส่งทาง LINE ทำได้ทันทีโดยไม่ต้องล็อกอิน)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex justify-between items-center flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <a
              href={generatedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-900 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>ทดสอบเปิดลิงก์ในแท็บใหม่</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            {onOpenAdminModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminModal();
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
              >
                จัดการระบบ (สำหรับเลขาฯ)
              </button>
            )}
          </div>
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
  );
};
