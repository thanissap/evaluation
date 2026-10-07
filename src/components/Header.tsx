import React from 'react';
import { CompanyId, FiscalYear, Director, SubmissionStatus } from '../types/evaluation';
import { COMPANIES } from '../data/evaluationData';
import {
  Building2,
  UserCheck,
  CheckCircle,
  Clock,
  Lock,
  KeyRound,
  Share2,
} from 'lucide-react';

interface HeaderProps {
  currentCompany: CompanyId;
  currentYear: FiscalYear;
  currentDirector: Director | undefined;
  status: SubmissionStatus;
  isSupervisorMode: boolean;
  managedYears?: string[];
  onSelectYear?: (year: FiscalYear) => void;
  isSecretaryMode?: boolean;
  onExitSecretaryMode?: () => void;
  onOpenAdminModal: () => void;
  onOpenShareModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCompany,
  currentYear,
  currentDirector,
  status,
  isSupervisorMode,
  managedYears,
  onSelectYear,
  isSecretaryMode,
  onExitSecretaryMode,
  onOpenAdminModal,
  onOpenShareModal,
}) => {
  const currentCompanyInfo = COMPANIES.find((c) => c.id === currentCompany);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      {/* Top Gold Accent Bar */}
      <div className="h-1.5 bg-gradient-to-r from-amber-800 via-amber-500 to-amber-900" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Prominent Company Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-900 via-amber-950 to-stone-900 flex items-center justify-center text-amber-300 font-bold text-lg shadow-xs border border-amber-600/40 shrink-0">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-amber-900 text-white font-extrabold text-xs tracking-wider">
                  {currentCompany}
                </span>
                {managedYears && onSelectYear ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 font-semibold">ปี:</span>
                    <select
                      value={currentYear}
                      onChange={(e) => onSelectYear(e.target.value)}
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 font-extrabold text-xs border border-amber-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      {managedYears.map((y) => (
                        <option key={y} value={y}>พ.ศ. {y}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
                    ประจำปี พ.ศ. {currentYear}
                  </span>
                )}
                {isSecretaryMode && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-extrabold text-xs border border-purple-300 flex items-center gap-1">
                    <span>👔 โหมดเลขาฯ แก้ไข</span>
                    {onExitSecretaryMode && (
                      <button
                        type="button"
                        onClick={onExitSecretaryMode}
                        className="ml-1 text-[10px] text-purple-700 hover:text-purple-950 font-bold underline cursor-pointer"
                        title="ปิดโหมดเลขาฯ"
                      >
                        (ปิด)
                      </button>
                    )}
                  </span>
                )}
                {status === 'SUBMITTED' ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    ส่งผลแล้ว
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-700" />
                    แบบร่าง (Draft)
                  </span>
                )}
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 font-['Plus_Jakarta_Sans',sans-serif]">
                {currentCompanyInfo?.nameTh}
              </h1>
            </div>
          </div>

          {/* Locked Evaluator Persona Badge & Admin Portal Entrance */}
          <div className="flex items-center gap-2.5 justify-between sm:justify-end">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0">
                <UserCheck className="w-3.5 h-3.5 text-amber-800" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <span>ผู้ประเมินตามสิทธิ์</span>
                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate max-w-[180px] sm:max-w-[220px]">
                  {currentDirector?.name || 'กรรมการผู้มีสิทธิ์ประเมิน'}
                </div>
              </div>
            </div>

            {onOpenShareModal && (
              <button
                type="button"
                onClick={onOpenShareModal}
                className="px-3 py-1.5 rounded-xl text-amber-900 hover:bg-amber-100/70 border border-amber-300 bg-amber-50/80 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                title="สร้างและส่งต่อลิงก์ประเมินให้กรรมการหรือหัวหน้างาน (Magic Links)"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-800" />
                <span className="hidden sm:inline">ส่งลิงก์</span>
              </button>
            )}

            {/* Discreet Admin Entrance (ทางเข้าแฝงสำหรับฝ่ายเลขานุการ) */}
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="p-2 rounded-xl text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="ระบบจัดการสำหรับฝ่ายเลขานุการบริษัท"
              aria-label="ระบบจัดการฝ่ายเลขานุการบริษัท"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
