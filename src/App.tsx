import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CompanyId,
  FiscalYear,
  Director,
  EvaluationFormData,
  ScoreValueSec123,
  ScoreValueSec4,
  SubCommitteeDept,
  DirectorPermissions,
} from './types/evaluation';
import {
  COMPANIES,
  SUBCOMMITTEE_DEPTS,
  DeptInfo,
  getStoredDirectors,
  getStoredQuestions,
  getStoredDirectorPermissions,
  DEFAULT_DIRECTOR_PERMISSIONS,
  getStoredFiscalYears,
  saveStoredFiscalYears,
  getEvaluationStorageKey,
  getLegacyEvaluationStorageKey,
} from './data/evaluationData';
import { computeAllGrades } from './utils/grading';
import { exportEvaluationToExcel } from './utils/excelExport';
import { Header } from './components/Header';
import { SectionBoard } from './components/SectionBoard';
import { SectionDirector } from './components/SectionDirector';
import { SectionMD } from './components/SectionMD';
import { SectionStaff } from './components/SectionStaff';
import { AdminUnlockModal } from './components/AdminUnlockModal';
import { DelegationShareModal } from './components/DelegationShareModal';
import { IncompleteCheckModal, MissingItemInfo } from './components/IncompleteCheckModal';
import {
  ShieldAlert,
  Send,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Building2,
  Users,
  Briefcase,
  UserCheck,
  UserCog,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  X,
  Calendar,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  // Read initial context from URL query params
  const initialParams = useMemo(() => {
    const storedYears = getStoredFiscalYears();
    const defaultYear = storedYears[0] || '2569';
    if (typeof window === 'undefined') {
      return {
        hasExplicitCompany: false,
        company: 'CLC' as CompanyId,
        year: defaultYear as FiscalYear,
        evaluatorKey: 'pannee',
        isSupervisor: false,
        dept: 'CU' as SubCommitteeDept,
      };
    }
    const sp = new URLSearchParams(window.location.search);
    const hasExplicitCompany = sp.has('c') || sp.has('company');
    const compVal = (sp.get('c') || sp.get('company') || '').toUpperCase();
    const yearVal = sp.get('y') || sp.get('year') || '';
    const year = (yearVal && storedYears.includes(yearVal) ? yearVal : defaultYear) as FiscalYear;
    const evaluatorKey = sp.get('k') || sp.get('director') || sp.get('evaluator') || 'pannee';
    const isSupervisor = (sp.get('role') || sp.get('mode') || '').toLowerCase() === 'supervisor';
    const rawDept = (sp.get('dept') || sp.get('department') || '').toUpperCase() as SubCommitteeDept;
    const dept = ['CU', 'IA', 'RISK'].includes(rawDept) ? rawDept : 'CU';

    let company: CompanyId = 'CLC';
    if (hasExplicitCompany) {
      company = (compVal === 'CLFG' ? 'CLFG' : 'CLC') as CompanyId;
    } else {
      const allDirs = getStoredDirectors();
      const matchedDir = allDirs.find((d) => d.key === evaluatorKey);
      if (matchedDir?.companySpecific) {
        company = matchedDir.companySpecific;
      } else {
        const allPerms = getStoredDirectorPermissions();
        const p = allPerms[evaluatorKey];
        if (p && !p.clc?.canEvaluateBoard && !p.clc?.canEvaluateDirectors && p.clfg?.canEvaluateBoard) {
          company = 'CLFG';
        }
      }
    }

    return {
      hasExplicitCompany,
      company,
      year,
      evaluatorKey,
      isSupervisor,
      dept,
    };
  }, []);

  const [managedYears, setManagedYears] = useState<string[]>(getStoredFiscalYears());
  const [company, setCompany] = useState<CompanyId>(initialParams.company || 'CLC');
  const [year, setYear] = useState<FiscalYear>(initialParams.year || '2569');
  const [evaluatorKey, setEvaluatorKey] = useState<string>(initialParams.evaluatorKey || 'pannee');
  const [secretaryEditBanner, setSecretaryEditBanner] = useState<string | null>(null);
  const [isSupervisorMode, setIsSupervisorMode] = useState<boolean>(initialParams.isSupervisor || false);
  const [supervisorDept, setSupervisorDept] = useState<SubCommitteeDept>(initialParams.dept || 'CU');
  const [supervisorName, setSupervisorName] = useState<string>('');
  const [supervisorTitle, setSupervisorTitle] = useState<string>('');
  const [selectedStaffDept, setSelectedStaffDept] = useState<SubCommitteeDept>(initialParams.dept || 'CU');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCheckingUnlock, setIsCheckingUnlock] = useState(false);

  // Active section column tab: 's1' | 's2' | 's3' | 's4'
  const [activeSectionTab, setActiveSectionTab] = useState<'s1' | 's2' | 's3' | 's4'>(
    initialParams.isSupervisor ? 's4' : 's1'
  );
  // Active target director in Section 2 (for jump navigation)
  const [activeDirectorInSec2, setActiveDirectorInSec2] = useState<string>('');

  // Dynamic Stores (Directors, Questions, Permissions)
  const [directorsList, setDirectorsList] = useState<Director[]>(getStoredDirectors());
  const [questions, setQuestions] = useState(getStoredQuestions());
  const [permissions, setPermissions] = useState<Record<string, DirectorPermissions>>(
    getStoredDirectorPermissions()
  );

  // Answers & Form State
  const [section1, setSection1] = useState<Record<string, ScoreValueSec123>>({});
  const [section2, setSection2] = useState<Record<string, Record<string, ScoreValueSec123>>>({});
  const [section3, setSection3] = useState<Record<string, ScoreValueSec123>>({});
  const [section4, setSection4] = useState<Record<string, Record<string, ScoreValueSec4>>>({});

  const [section1Comment, setSection1Comment] = useState<string>('');
  const [section2Comments, setSection2Comments] = useState<Record<string, string>>({});
  const [section3Comment, setSection3Comment] = useState<string>('');
  const [section4Comments, setSection4Comments] = useState<Record<string, string>>({});

  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [submittedAt, setSubmittedAt] = useState<string | undefined>();
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toISOString());

  // Modals
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
  const [isSubmitSuccessModalOpen, setIsSubmitSuccessModalOpen] = useState(false);

  // Filter directors based on company
  const availableDirectors = useMemo(() => {
    return directorsList.filter((d) => !d.companySpecific || d.companySpecific === company);
  }, [directorsList, company]);

  // Current Director
  const currentDirector = useMemo(() => {
    let found = availableDirectors.find((d) => d.key === evaluatorKey);
    if (!found) {
      found = directorsList.find((d) => d.key === evaluatorKey);
    }
    if (!found && availableDirectors.length > 0) {
      found = availableDirectors[0];
    }
    return found;
  }, [availableDirectors, directorsList, evaluatorKey]);

  useEffect(() => {
    if (currentDirector) {
      if (currentDirector.companySpecific && currentDirector.companySpecific !== company) {
        setCompany(currentDirector.companySpecific);
      }
      if (currentDirector.key !== evaluatorKey) {
        setEvaluatorKey(currentDirector.key);
      }
    }
  }, [currentDirector]);

  // Auto-clear toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Keyboard shortcut (Ctrl+Alt+A or Alt+A) to open Admin Portal discreetly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        setIsAdminModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll smoothly to evaluation sections nav or top
  const scrollToEvaluationTop = () => {
    setTimeout(() => {
      const navEl = document.getElementById('evaluation-sections-nav');
      if (navEl) {
        const headerOffset = 76;
        const elementPosition = navEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 40);
  };

  // Scroll to Top Floating Button state & listener
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // When activeSectionTab changes, scroll smoothly up to the section header bar
  const isTabMountRef = React.useRef(true);
  useEffect(() => {
    if (isTabMountRef.current) {
      isTabMountRef.current = false;
      return;
    }
    scrollToEvaluationTop();
  }, [activeSectionTab]);

  // Current evaluator permissions based on active company
  const evaluatorPerm = useMemo(() => {
    const raw = permissions[evaluatorKey] || DEFAULT_DIRECTOR_PERMISSIONS[evaluatorKey];
    if (company === 'CLC') {
      const p = raw?.clc;
      return {
        canEvaluateBoard: p?.canEvaluateBoard ?? true,
        canEvaluateDirectors: p?.canEvaluateDirectors ?? true,
        canEvaluateMD: (p?.canEvaluateMD ?? true) && !currentDirector?.isMD,
        canEvaluateCU: p?.canEvaluateCU ?? false,
        canEvaluateIA: p?.canEvaluateIA ?? false,
        canEvaluateRISK: p?.canEvaluateRISK ?? false,
      };
    } else {
      const p = raw?.clfg;
      return {
        canEvaluateBoard: p?.canEvaluateBoard ?? true,
        canEvaluateDirectors: p?.canEvaluateDirectors ?? true,
        canEvaluateMD: (p?.canEvaluateMD ?? true) && !currentDirector?.isMD,
        canEvaluateCU: false,
        canEvaluateIA: false,
        canEvaluateRISK: false,
      };
    }
  }, [permissions, evaluatorKey, company, currentDirector]);

  // Company allowed for this director
  const allowedCompaniesForDirector = useMemo<CompanyId[]>(() => {
    const raw = permissions[evaluatorKey] || DEFAULT_DIRECTOR_PERMISSIONS[evaluatorKey];
    const comps: CompanyId[] = [];
    if (raw?.clc?.canEvaluateBoard || raw?.clc?.canEvaluateDirectors || raw?.clc?.canEvaluateMD || raw?.clc?.canEvaluateCU || raw?.clc?.canEvaluateIA || raw?.clc?.canEvaluateRISK) comps.push('CLC');
    if (raw?.clfg?.canEvaluateBoard || raw?.clfg?.canEvaluateDirectors || raw?.clfg?.canEvaluateMD) comps.push('CLFG');
    return comps.length > 0 ? comps : ['CLC', 'CLFG'];
  }, [permissions, evaluatorKey]);

  // Auto-select initial company if not explicitly provided in URL (unified single link)
  useEffect(() => {
    if (!initialParams.hasExplicitCompany && currentDirector) {
      if (currentDirector.companySpecific) {
        setCompany(currentDirector.companySpecific);
      } else {
        const raw = permissions[evaluatorKey] || DEFAULT_DIRECTOR_PERMISSIONS[evaluatorKey];
        const canClc = raw?.clc?.canEvaluateBoard || raw?.clc?.canEvaluateDirectors;
        const canClfg = raw?.clfg?.canEvaluateBoard || raw?.clfg?.canEvaluateDirectors;
        if (!canClc && canClfg) {
          setCompany('CLFG');
        } else {
          setCompany('CLC');
        }
      }
    }
  }, [initialParams.hasExplicitCompany, currentDirector, evaluatorKey, permissions]);

  // Eligible departments for current director (CLC only)
  const eligibleDepts = useMemo<DeptInfo[]>(() => {
    if (company !== 'CLC') return [];
    return SUBCOMMITTEE_DEPTS.filter((d) => {
      if (d.id === 'CU' && evaluatorPerm.canEvaluateCU) return true;
      if (d.id === 'IA' && evaluatorPerm.canEvaluateIA) return true;
      if (d.id === 'RISK' && evaluatorPerm.canEvaluateRISK) return true;
      return false;
    });
  }, [company, evaluatorPerm]);

  const hasStaffAccess = eligibleDepts.length > 0;

  useEffect(() => {
    if (eligibleDepts.length > 0 && !eligibleDepts.some((d) => d.id === selectedStaffDept)) {
      setSelectedStaffDept(eligibleDepts[0].id);
    }
  }, [eligibleDepts]);

  const isMD = currentDirector?.isMD === true;

  // Standard LocalStorage Key
  const storageKey = useMemo(() => {
    return getEvaluationStorageKey(company, year, evaluatorKey, isSupervisorMode, supervisorDept);
  }, [year, company, evaluatorKey, isSupervisorMode, supervisorDept]);

  // Load from LocalStorage and sync with Central Server
  useEffect(() => {
    isInitialSyncDoneRef.current = false;

    // 1. Initial immediate load from LocalStorage (or legacy key fallback)
    try {
      const primarySaved = localStorage.getItem(storageKey);
      const legacyKey = getLegacyEvaluationStorageKey(company, year, evaluatorKey, isSupervisorMode, supervisorDept);
      const legacySaved = localStorage.getItem(legacyKey);
      const saved = primarySaved || legacySaved;

      if (saved) {
        const parsed: EvaluationFormData = JSON.parse(saved);
        setSection1(parsed.section1 || {});
        if (parsed.section2 && typeof parsed.section2 === 'object') {
          const firstVal = Object.values(parsed.section2)[0];
          if (firstVal && typeof firstVal === 'object') {
            setSection2(parsed.section2);
          } else {
            setSection2({ [evaluatorKey]: parsed.section2 as any });
          }
        } else {
          setSection2({});
        }

        setSection3(parsed.section3 || {});

        if (parsed.section4 && typeof parsed.section4 === 'object') {
          const firstVal = Object.values(parsed.section4)[0];
          if (firstVal && typeof firstVal === 'object') {
            setSection4(parsed.section4 as any);
          } else {
            setSection4({ [supervisorDept || selectedStaffDept]: parsed.section4 as any });
          }
        } else {
          setSection4({});
        }

        setSection1Comment(parsed.section1Comment || '');
        setSection2Comments(parsed.section2Comments || {});
        setSection3Comment(parsed.section3Comment || '');
        setSection4Comments(parsed.section4Comments || {});
        setStatus(parsed.status || 'DRAFT');
        setSubmittedAt(parsed.submittedAt);
        setLastSavedAt(parsed.lastSavedAt || new Date().toISOString());
        if (parsed.supervisorName) setSupervisorName(parsed.supervisorName);
        if (parsed.supervisorTitle) setSupervisorTitle(parsed.supervisorTitle);
      } else {
        setSection1({});
        setSection2({});
        setSection3({});
        setSection4({});
        setSection1Comment('');
        setSection2Comments({});
        setSection3Comment('');
        setSection4Comments({});
        setStatus('DRAFT');
        setSubmittedAt(undefined);
        setLastSavedAt(new Date().toISOString());
      }
    } catch (e) {
      console.error('Error loading initial evaluation state:', e);
    }

    // 2. Query Central Server for latest submission status & data (Picks up Admin Unlock/Reset immediately)
    const expectedId = `${company}_${year}_${evaluatorKey}${
      isSupervisorMode ? `_${supervisorDept}` : ''
    }`;

    fetch(`/api/submissions?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((serverData) => {
        if (Array.isArray(serverData)) {
          let serverMatch = serverData.find((s: any) => s.id === expectedId);
          if (!serverMatch) {
            serverMatch = serverData.find(
              (s: any) =>
                s.evaluatorKey === evaluatorKey &&
                s.year === year &&
                (isSupervisorMode
                  ? s.isSupervisorMode && s.supervisorDept === supervisorDept
                  : !s.isSupervisorMode)
            );
          }

          if (serverMatch) {
            // Server has record for this submission
            if (serverMatch.status === 'DRAFT') {
              // Unlocked by Secretary/Admin! Revert to DRAFT immediately
              setStatus('DRAFT');
              setSubmittedAt(undefined);
              try {
                const draftObj = { ...serverMatch, status: 'DRAFT', submittedAt: undefined };
                localStorage.setItem(storageKey, JSON.stringify(draftObj));
              } catch {}
            } else if (serverMatch.status === 'SUBMITTED') {
              setStatus('SUBMITTED');
              setSubmittedAt(serverMatch.submittedAt);
            }

            // Sync latest answers if present on server
            if (serverMatch.section1) setSection1(serverMatch.section1);
            if (serverMatch.section2) setSection2(serverMatch.section2);
            if (serverMatch.section3) setSection3(serverMatch.section3);
            if (serverMatch.section4) setSection4(serverMatch.section4);
            if (serverMatch.section1Comment !== undefined) setSection1Comment(serverMatch.section1Comment);
            if (serverMatch.section2Comments !== undefined) setSection2Comments(serverMatch.section2Comments);
            if (serverMatch.section3Comment !== undefined) setSection3Comment(serverMatch.section3Comment);
            if (serverMatch.section4Comments !== undefined) setSection4Comments(serverMatch.section4Comments);
            if (serverMatch.supervisorName !== undefined) setSupervisorName(serverMatch.supervisorName || '');
            if (serverMatch.supervisorTitle !== undefined) setSupervisorTitle(serverMatch.supervisorTitle || '');
            if (serverMatch.lastSavedAt) setLastSavedAt(serverMatch.lastSavedAt);

            // Update LocalStorage to keep in perfect sync with server
            try {
              localStorage.setItem(storageKey, JSON.stringify(serverMatch));
            } catch {}
          } else {
            // Server has no record (meaning it was wiped or deleted by Admin)
            setStatus('DRAFT');
            setSubmittedAt(undefined);
            const localSaved = localStorage.getItem(storageKey);
            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (parsed.status === 'SUBMITTED') {
                  setSection1({});
                  setSection2({});
                  setSection3({});
                  setSection4({});
                  setSection1Comment('');
                  setSection2Comments({});
                  setSection3Comment('');
                  setSection4Comments({});
                  localStorage.removeItem(storageKey);
                }
              } catch {}
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Could not sync with central submissions server:', err);
      })
      .finally(() => {
        isInitialSyncDoneRef.current = true;
      });
  }, [storageKey, company, year, evaluatorKey, isSupervisorMode, supervisorDept]);

  const isClearingOrResettingRef = useRef(false);
  const isInitialSyncDoneRef = useRef(false);

  // Save to LocalStorage and server backend
  const saveState = async (newStatus?: 'DRAFT' | 'SUBMITTED', customSubmittedAt?: string) => {
    if (isClearingOrResettingRef.current || !isInitialSyncDoneRef.current) return;
    const curStatus = newStatus || status;
    const curSubmitted = customSubmittedAt !== undefined ? customSubmittedAt : submittedAt;
    const now = new Date().toISOString();

    const dataToSave: EvaluationFormData = {
      year,
      company,
      evaluatorKey,
      evaluatorName: currentDirector?.name || evaluatorKey,
      isSupervisorMode,
      supervisorName,
      supervisorTitle,
      supervisorDept,
      selectedStaffDept,
      status: curStatus,
      submittedAt: curSubmitted,
      lastSavedAt: now,
      section1,
      section2,
      section3,
      section4,
      section1Comment,
      section2Comments,
      section3Comment,
      section4Comments,
    };

    const hasAnyAnswers =
      Object.keys(section1).length > 0 ||
      Object.keys(section2).length > 0 ||
      Object.keys(section3).length > 0 ||
      Object.keys(section4).length > 0;

    // Save to local storage
    try {
      if (hasAnyAnswers || curStatus === 'SUBMITTED') {
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        setLastSavedAt(now);
      }
    } catch (e) {
      console.error('Error saving evaluation state:', e);
    }

    // Save to central server if there are actual answers or submitted
    if (hasAnyAnswers || curStatus === 'SUBMITTED') {
      try {
        await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });
      } catch (e) {
        console.warn('Sync to server note:', e);
      }
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (!isInitialSyncDoneRef.current || isClearingOrResettingRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      saveState();
    }, 600);
    return () => clearTimeout(timer);
  }, [
    section1,
    section2,
    section3,
    section4,
    section1Comment,
    section2Comments,
    section3Comment,
    section4Comments,
    supervisorName,
    supervisorTitle,
  ]);

  const eligibleDirectorKeys = useMemo(() => {
    return availableDirectors.map((d) => d.key);
  }, [availableDirectors]);

  const activeDepts = useMemo(() => {
    if (isSupervisorMode) return [supervisorDept];
    return eligibleDepts.map((d) => d.id);
  }, [isSupervisorMode, supervisorDept, eligibleDepts]);

  const grades = useMemo(() => {
    return computeAllGrades(
      section1,
      section2,
      section3,
      section4,
      !evaluatorPerm.canEvaluateMD || isMD,
      eligibleDirectorKeys,
      activeDepts
    );
  }, [
    section1,
    section2,
    section3,
    section4,
    evaluatorPerm.canEvaluateMD,
    isMD,
    eligibleDirectorKeys,
    activeDepts,
  ]);

  const currentFormData: EvaluationFormData = useMemo(() => {
    return {
      year,
      company,
      evaluatorKey,
      evaluatorName: currentDirector?.name || evaluatorKey,
      isSupervisorMode,
      supervisorName,
      supervisorTitle,
      supervisorDept,
      selectedStaffDept,
      status,
      submittedAt,
      lastSavedAt,
      section1,
      section2,
      section3,
      section4,
      section1Comment,
      section2Comments,
      section3Comment,
      section4Comments,
    };
  }, [
    year,
    company,
    evaluatorKey,
    currentDirector,
    isSupervisorMode,
    supervisorName,
    supervisorTitle,
    supervisorDept,
    selectedStaffDept,
    status,
    submittedAt,
    lastSavedAt,
    section1,
    section2,
    section3,
    section4,
    section1Comment,
    section2Comments,
    section3Comment,
    section4Comments,
  ]);

  // Section 1 actions
  const handleQuickFillSection1 = () => {
    if (status === 'SUBMITTED') return;
    const s1: Record<string, ScoreValueSec123> = {};
    questions.section1.forEach((item) => (s1[item.id] = 4));
    setSection1(s1);
  };

  const handleResetSection1 = async () => {
    isClearingOrResettingRef.current = true;
    setSection1({});
    setSection1Comment('');
    const expectedId = `${company}_${year}_${evaluatorKey}${
      isSupervisorMode ? `_${supervisorDept}` : ''
    }`;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.section1 = {};
      parsed.section1Comment = '';
      parsed.lastSavedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    } catch {}
    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expectedId, company, year, evaluatorKey, isSupervisorMode, supervisorDept, sections: ['s1'] }),
      });
    } catch {}
    setToastMessage('✅ รีเซ็ตคะแนนแบบประเมินส่วนที่ 1 (บอร์ดทั้งชุด) เรียบร้อยแล้ว');
    setTimeout(() => { isClearingOrResettingRef.current = false; }, 1000);
  };

  // Section 2 actions
  const handleQuickFillDirector = (targetKey: string) => {
    if (status === 'SUBMITTED') return;
    const map: Record<string, ScoreValueSec123> = {};
    questions.section2.forEach((item) => (map[item.id] = 4));
    setSection2((prev) => ({ ...prev, [targetKey]: map }));
  };

  const handleQuickFillAllDirectors = () => {
    if (status === 'SUBMITTED') return;
    const fullMap: Record<string, Record<string, ScoreValueSec123>> = {};
    availableDirectors.forEach((dir) => {
      const map: Record<string, ScoreValueSec123> = {};
      questions.section2.forEach((item) => (map[item.id] = 4));
      fullMap[dir.key] = map;
    });
    setSection2(fullMap);
  };

  const handleResetDirector = async (targetKey: string) => {
    isClearingOrResettingRef.current = true;
    setSection2((prev) => {
      const next = { ...prev };
      delete next[targetKey];
      return next;
    });
    setSection2Comments((prev) => {
      const next = { ...prev };
      delete next[targetKey];
      return next;
    });
    const expectedId = `${company}_${year}_${evaluatorKey}${
      isSupervisorMode ? `_${supervisorDept}` : ''
    }`;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed.section2) delete parsed.section2[targetKey];
      if (parsed.section2Comments) delete parsed.section2Comments[targetKey];
      parsed.lastSavedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    } catch {}
    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expectedId, company, year, evaluatorKey, isSupervisorMode, supervisorDept, sections: ['s2'], targetDirectorKey: targetKey }),
      });
    } catch {}
    const targetDirObj = availableDirectors.find((d) => d.key === targetKey);
    setToastMessage(`✅ รีเซ็ตคะแนนของ "${targetDirObj?.name || targetKey}" เรียบร้อยแล้ว`);
    setTimeout(() => { isClearingOrResettingRef.current = false; }, 1000);
  };

  const handleResetAllDirectors = async () => {
    isClearingOrResettingRef.current = true;
    setSection2({});
    setSection2Comments({});
    const expectedId = `${company}_${year}_${evaluatorKey}${
      isSupervisorMode ? `_${supervisorDept}` : ''
    }`;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.section2 = {};
      parsed.section2Comments = {};
      parsed.lastSavedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    } catch {}
    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expectedId, company, year, evaluatorKey, isSupervisorMode, supervisorDept, sections: ['s2'] }),
      });
    } catch {}
    setToastMessage('✅ รีเซ็ตคะแนนของกรรมการทุกคนในส่วนที่ 2 เรียบร้อยแล้ว');
    setTimeout(() => { isClearingOrResettingRef.current = false; }, 1000);
  };

  // Section 3 actions
  const handleQuickFillSection3 = () => {
    if (status === 'SUBMITTED') return;
    const s3: Record<string, ScoreValueSec123> = {};
    questions.section3.forEach((item) => (s3[item.id] = 4));
    setSection3(s3);
  };

  const handleResetSection3 = async () => {
    isClearingOrResettingRef.current = true;
    setSection3({});
    setSection3Comment('');
    const expectedId = `${company}_${year}_${evaluatorKey}${
      isSupervisorMode ? `_${supervisorDept}` : ''
    }`;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.section3 = {};
      parsed.section3Comment = '';
      parsed.lastSavedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    } catch {}
    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expectedId, company, year, evaluatorKey, isSupervisorMode, supervisorDept, sections: ['s3'] }),
      });
    } catch {}
    setToastMessage('✅ รีเซ็ตคะแนนแบบประเมินผู้จัดการใหญ่ (ส่วนที่ 3) เรียบร้อยแล้ว');
    setTimeout(() => { isClearingOrResettingRef.current = false; }, 1000);
  };

  // Section 4 actions
  const handleQuickFillDept = (deptId: string) => {
    if (status === 'SUBMITTED') return;
    const s4Map: Record<string, ScoreValueSec4> = {};
    questions.section4.forEach((item) => (s4Map[item.id] = 5));
    setSection4((prev) => ({ ...prev, [deptId]: s4Map }));
  };

  const handleResetDept = async (deptId: string) => {
    isClearingOrResettingRef.current = true;
    setSection4((prev) => {
      const next = { ...prev };
      delete next[deptId];
      return next;
    });
    setSection4Comments((prev) => {
      const next = { ...prev };
      delete next[deptId];
      return next;
    });
    const expectedId = `${company}_${year}_${evaluatorKey}${
      isSupervisorMode ? `_${supervisorDept}` : ''
    }`;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed.section4) delete parsed.section4[deptId];
      if (parsed.section4Comments) delete parsed.section4Comments[deptId];
      parsed.lastSavedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    } catch {}
    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expectedId, company, year, evaluatorKey, isSupervisorMode, supervisorDept, sections: ['s4'], deptId }),
      });
    } catch {}
    setToastMessage(`✅ รีเซ็ตคะแนนสายงาน ${deptId} เรียบร้อยแล้ว`);
    setTimeout(() => { isClearingOrResettingRef.current = false; }, 1000);
  };

  // Instant Check Unlock Status function for directors/supervisors
  const handleCheckUnlockStatus = async () => {
    setIsCheckingUnlock(true);
    try {
      const res = await fetch(`/api/submissions?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (res.ok) {
        const serverData = await res.json();
        const expectedId = `${company}_${year}_${evaluatorKey}${
          isSupervisorMode ? `_${supervisorDept}` : ''
        }`;
        let match = serverData.find((s: any) => s.id === expectedId);
        if (!match) {
          match = serverData.find(
            (s: any) =>
              s.evaluatorKey === evaluatorKey &&
              s.year === year &&
              (isSupervisorMode
                ? s.isSupervisorMode && s.supervisorDept === supervisorDept
                : !s.isSupervisorMode)
          );
        }
        if (match) {
          if (match.status === 'DRAFT') {
            setStatus('DRAFT');
            setSubmittedAt(undefined);
            try {
              localStorage.setItem(
                storageKey,
                JSON.stringify({ ...match, status: 'DRAFT', submittedAt: undefined })
              );
            } catch {}
            setToastMessage('✅ ฝ่ายเลขานุการได้ปลดล็อกแบบประเมินให้ท่านแล้ว สามารถแก้ไขคะแนนได้ทันที');
          } else {
            setToastMessage('สถานะในระบบกลางยังคงเป็น "ส่งผลแล้ว" (ฝ่ายเลขาฯ ยังไม่ได้กดปลดล็อก)');
          }
        } else {
          setStatus('DRAFT');
          setSubmittedAt(undefined);
          setToastMessage('✅ ฟอร์มได้รับการปรับสถานะเป็นแบบร่างเรียบร้อยแล้ว');
        }
      }
    } catch {
      setToastMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCheckingUnlock(false);
    }
  };

  // Switch Company Handler
  const handleSelectCompany = (newComp: CompanyId) => {
    if (company === newComp) return;
    setCompany(newComp);
    // If active section is Section 4 and switching to CLFG, move to Section 1
    if (newComp === 'CLFG' && activeSectionTab === 's4') {
      setActiveSectionTab('s1');
    }
    scrollToEvaluationTop();
  };

  // Section completion status
  const s1Answered = Object.keys(section1).filter((k) => section1[k] !== null && section1[k] !== undefined).length;
  const isS1Complete = s1Answered === questions.section1.length;

  const s2DirectorsCompleted = availableDirectors.filter((d) => {
    const s = section2[d.key] || {};
    return Object.keys(s).filter((k) => s[k] !== null && s[k] !== undefined).length === questions.section2.length;
  }).length;
  const isS2Complete = s2DirectorsCompleted === availableDirectors.length;

  const s3Answered = Object.keys(section3).filter((k) => section3[k] !== null && section3[k] !== undefined).length;
  const isS3Complete = isMD || s3Answered === questions.section3.length;

  const s4CompleteDepts = activeDepts.filter((deptId) => {
    const s = section4[deptId] || {};
    return Object.keys(s).filter((k) => s[k] !== null && s[k] !== undefined).length === questions.section4.length;
  }).length;
  const isS4Complete = company === 'CLC' && (hasStaffAccess || isSupervisorMode) ? s4CompleteDepts === activeDepts.length : true;

  // Find unanswered questions
  const missingItems = useMemo<MissingItemInfo[]>(() => {
    const list: MissingItemInfo[] = [];

    if (!isSupervisorMode) {
      if (evaluatorPerm.canEvaluateBoard) {
        questions.section1.forEach((item) => {
          if (section1[item.id] === undefined || section1[item.id] === null) {
            list.push({
              sectionTitle: 'ชุดที่ 1 บอร์ดทั้งชุด',
              itemId: `item-${item.id}`,
              code: item.code,
              title: item.title,
            });
          }
        });
      }

      if (evaluatorPerm.canEvaluateDirectors) {
        availableDirectors.forEach((dir) => {
          const dirScores = section2[dir.key] || {};
          questions.section2.forEach((item) => {
            if (dirScores[item.id] === undefined || dirScores[item.id] === null) {
              list.push({
                sectionTitle: 'ชุดที่ 2 รายบุคคล',
                itemId: `item-d-${dir.key}-${item.id}`,
                code: item.code,
                title: item.title,
                targetDirectorName: dir.name,
              });
            }
          });
        });
      }

      if (evaluatorPerm.canEvaluateMD && !isMD) {
        questions.section3.forEach((item) => {
          if (section3[item.id] === undefined || section3[item.id] === null) {
            list.push({
              sectionTitle: 'ชุดที่ 3 ผู้จัดการใหญ่',
              itemId: `item-m-${item.id}`,
              code: item.code,
              title: item.title,
            });
          }
        });
      }
    }

    if (company === 'CLC' && (hasStaffAccess || isSupervisorMode)) {
      activeDepts.forEach((deptId) => {
        const deptScores = section4[deptId] || {};
        questions.section4.forEach((item) => {
          if (deptScores[item.id] === undefined || deptScores[item.id] === null) {
            list.push({
              sectionTitle: 'ชุดที่ 4 พนักงาน',
              itemId: `item-s-${deptId}-${item.id}`,
              code: item.code,
              title: item.title,
              deptName: deptId,
            });
          }
        });
      });
    }

    return list;
  }, [
    isSupervisorMode,
    evaluatorPerm,
    isMD,
    company,
    hasStaffAccess,
    activeDepts,
    availableDirectors,
    questions,
    section1,
    section2,
    section3,
    section4,
  ]);

  const isIncomplete = missingItems.length > 0;

  const handleInitiateSubmit = () => {
    if (isIncomplete) {
      setIsIncompleteModalOpen(true);
    } else {
      setIsSubmitConfirmOpen(true);
    }
  };

  const handleFinalSubmitConfirm = async () => {
    const now = new Date().toISOString();
    setStatus('SUBMITTED');
    setSubmittedAt(now);
    await saveState('SUBMITTED', now);
    setIsSubmitConfirmOpen(false);
    setIsIncompleteModalOpen(false);
    setIsSubmitSuccessModalOpen(true);
  };

  const handleJumpToItem = (itemId: string) => {
    // Switch to appropriate section tab based on itemId prefix
    if (itemId.startsWith('item-d-')) {
      const parts = itemId.split('-');
      // format: item-d-${targetDirKey}-${questionId}
      const targetDirKey = parts[2];
      if (targetDirKey) {
        setActiveDirectorInSec2(targetDirKey);
      }
      setActiveSectionTab('s2');
    } else if (itemId.startsWith('item-m-')) {
      setActiveSectionTab('s3');
    } else if (itemId.startsWith('item-s-')) {
      const parts = itemId.split('-');
      // format: item-s-${deptId}-${questionId}
      const deptId = parts[2] as SubCommitteeDept;
      if (deptId && ['CU', 'IA', 'RISK'].includes(deptId)) {
        setSelectedStaffDept(deptId);
      }
      setActiveSectionTab('s4');
    } else {
      setActiveSectionTab('s1');
    }

    setTimeout(() => {
      const el = document.getElementById(itemId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-500/80', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-500/80');
        }, 2500);
      }
    }, 200);
  };

  const handleAdminUnlock = () => {
    setStatus('DRAFT');
    setSubmittedAt(undefined);
    saveState('DRAFT', undefined);
  };

  const handleAdminReset = () => {
    isClearingOrResettingRef.current = true;
    setSection1({});
    setSection2({});
    setSection3({});
    setSection4({});
    setSection1Comment('');
    setSection2Comments({});
    setSection3Comment('');
    setSection4Comments({});
    setStatus('DRAFT');
    setSubmittedAt(undefined);
    const now = new Date().toISOString();
    setLastSavedAt(now);
    localStorage.removeItem(storageKey);
  };

  const handleSaveManagedYears = async (updated: string[]) => {
    setManagedYears(updated);
    saveStoredFiscalYears(updated);
    try {
      await fetch('/api/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ years: updated }),
      });
    } catch (e) {
      console.warn('Error saving years to server:', e);
    }
    if (!updated.includes(year)) {
      setYear((updated[0] || '2569') as FiscalYear);
    }
  };

  const handleEditDirectorSubmission = (
    targetEvaluatorKey: string,
    targetCompany: CompanyId,
    targetYear: string,
    submission?: any
  ) => {
    const dir = directorsList.find((d) => d.key === targetEvaluatorKey);
    setSecretaryEditBanner(
      `คุณกำลังแก้ไขคะแนนแทน: ${dir?.name || targetEvaluatorKey} (${targetCompany} - พ.ศ. ${targetYear})`
    );
    setCompany(targetCompany);
    setYear(targetYear as FiscalYear);
    setEvaluatorKey(targetEvaluatorKey);

    if (submission?.isSupervisorMode) {
      setIsSupervisorMode(true);
      setSupervisorDept(submission.supervisorDept || 'CU');
      setSupervisorName(submission.supervisorName || '');
      setSupervisorTitle(submission.supervisorTitle || '');
    } else {
      setIsSupervisorMode(false);
    }

    if (submission) {
      setSection1(submission.section1 || {});
      setSection2(submission.section2 || {});
      setSection3(submission.section3 || {});
      setSection4(submission.section4 || {});
      setSection1Comment(submission.section1Comment || '');
      setSection2Comments(submission.section2Comments || {});
      setSection3Comment(submission.section3Comment || '');
      setSection4Comments(submission.section4Comments || {});
      setStatus(submission.status || 'DRAFT');
      setSubmittedAt(submission.submittedAt);
    }
    setIsAdminModalOpen(false);
  };

  const handleSwitchContext = ({
    company: newCompany,
    year: newYear,
    evaluatorKey: newKey,
    isSupervisor: newIsSupervisor,
    dept: newDept,
  }: {
    company: CompanyId;
    year: FiscalYear;
    evaluatorKey: string;
    isSupervisor: boolean;
    dept: SubCommitteeDept;
  }) => {
    setCompany(newCompany);
    setYear(newYear);
    setEvaluatorKey(newKey);
    setIsSupervisorMode(newIsSupervisor);
    if (newIsSupervisor) {
      setSupervisorDept(newDept);
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('c', newCompany);
      url.searchParams.set('y', newYear);
      url.searchParams.set('k', newKey);
      if (newIsSupervisor) {
        url.searchParams.set('role', 'supervisor');
        url.searchParams.set('dept', newDept);
      } else {
        url.searchParams.delete('role');
        url.searchParams.delete('dept');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}

    const dirObj = directorsList.find((d) => d.key === newKey);
    const targetLabel = newIsSupervisor
      ? `หัวหน้างานสายงาน ${newDept} (มอบหมายโดย ${dirObj?.name || newKey})`
      : dirObj?.name || newKey;
    setToastMessage(`⚡ สลับไปยังสิทธิ์: ${targetLabel} (${newCompany} พ.ศ. ${newYear})`);
  };

  const handleAdminFillSample = () => {
    handleQuickFillSection1();
    handleQuickFillAllDirectors();
    if (evaluatorPerm.canEvaluateMD && !isMD) {
      handleQuickFillSection3();
    }
    if (company === 'CLC' && (hasStaffAccess || isSupervisorMode)) {
      activeDepts.forEach((d) => handleQuickFillDept(d));
    }
  };

  const handleExportExcel = () => {
    exportEvaluationToExcel(currentFormData, grades, availableDirectors, questions);
  };

  const isFormLocked = status === 'SUBMITTED';

  interface TabItem {
    id: 's1' | 's2' | 's3' | 's4';
    label: string;
    icon: any;
    complete: boolean;
    progress: string;
  }

  // Available section tabs for current director
  const availableTabs = useMemo<TabItem[]>(() => {
    if (isSupervisorMode) {
      return [
        {
          id: 's4',
          label: '4. แบบประเมินพนักงานสายงานกำกับ (HR-58)',
          icon: UserCog,
          complete: isS4Complete,
          progress: `${s4CompleteDepts}/${activeDepts.length} สายงาน`,
        },
      ];
    }
    const tabs: TabItem[] = [
      {
        id: 's1',
        label: '1. คณะกรรมการทั้งชุด (27 ข้อ)',
        icon: Users,
        complete: isS1Complete,
        progress: `${s1Answered}/27`,
      },
      {
        id: 's2',
        label: '2. กรรมการรายบุคคล (11 ข้อ x ทุกท่าน)',
        icon: UserCheck,
        complete: isS2Complete,
        progress: `${s2DirectorsCompleted}/${availableDirectors.length} ท่าน`,
      },
    ];
    if (evaluatorPerm.canEvaluateMD) {
      tabs.push({
        id: 's3',
        label: '3. ผู้จัดการใหญ่ (45 ข้อ)',
        icon: Briefcase,
        complete: isS3Complete,
        progress: isMD ? 'ยกเว้นตนเอง' : `${s3Answered}/45`,
      });
    }
    if (company === 'CLC' && hasStaffAccess) {
      tabs.push({
        id: 's4',
        label: '4. พนักงานสายงานกำกับ (20 ข้อ)',
        icon: UserCog,
        complete: isS4Complete,
        progress: `${s4CompleteDepts}/${activeDepts.length} สายงาน`,
      });
    }
    return tabs;
  }, [
    isSupervisorMode,
    evaluatorPerm.canEvaluateMD,
    company,
    hasStaffAccess,
    isS1Complete,
    isS2Complete,
    isS3Complete,
    isS4Complete,
    s1Answered,
    s2DirectorsCompleted,
    availableDirectors.length,
    isMD,
    s3Answered,
    s4CompleteDepts,
    activeDepts.length,
  ]);

  // Ensure activeSectionTab is valid
  useEffect(() => {
    if (!availableTabs.some((t) => t.id === activeSectionTab)) {
      setActiveSectionTab(availableTabs[0]?.id || 's1');
    }
  }, [availableTabs, activeSectionTab]);

  return (
    <div className="min-h-screen bg-slate-100/70 pb-28">
      {/* Header */}
      <Header
        currentCompany={company}
        currentYear={year}
        currentDirector={currentDirector}
        status={status}
        isSupervisorMode={isSupervisorMode}
        managedYears={managedYears}
        onSelectYear={(y) => setYear(y)}
        isSecretaryMode={Boolean(secretaryEditBanner)}
        onExitSecretaryMode={() => setSecretaryEditBanner(null)}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      {/* Secretary Edit Mode Sticky Banner */}
      {secretaryEditBanner && (
        <div className="bg-purple-950 text-white px-4 py-3 border-b border-purple-700 shadow-md sticky top-[69px] z-20 flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-purple-800 text-purple-200 border border-purple-600">
              <UserCog className="w-5 h-5" />
            </span>
            <div>
              <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <span>โหมดเลขานุการบริษัทแก้ไขข้อมูลแทน</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-purple-700 text-purple-200 font-bold">
                  Secretary Edit Mode
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">{secretaryEditBanner}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                saveState('SUBMITTED', new Date().toISOString());
                setStatus('SUBMITTED');
                alert('บันทึกและส่งผลการประเมินแทนกรรมการเรียบร้อยแล้ว');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>บันทึก & ส่งผลแทน</span>
            </button>
            <button
              type="button"
              onClick={() => setSecretaryEditBanner(null)}
              className="px-3 py-1.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition-all border border-purple-600 cursor-pointer"
            >
              ✕ ปิดโหมดแก้ไข
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Supervisor Mode Banner */}
        {isSupervisorMode && (
          <div id="evaluation-sections-nav" className="mb-5 rounded-2xl bg-amber-900 text-white p-4 sm:p-5 border border-amber-700 shadow-md scroll-mt-20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-800 text-amber-200 border border-amber-600 shrink-0">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-800 text-amber-200 uppercase tracking-wider">
                    โหมดปฏิบัติการแทน (Supervisor Mode)
                  </span>
                  <span className="text-xs text-amber-200 font-semibold">สายงาน: {supervisorDept}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                  การประเมินผลการปฏิบัติงานของพนักงาน โดยได้รับมอบหมายจาก {currentDirector?.name}
                </h2>
                <p className="text-xs text-amber-100/90 mt-0.5">
                  ระบบล็อกการแสดงผลเฉพาะแบบประเมินส่วนที่ 4 (พนักงานสายงานกำกับ) เพื่อรักษาความลับของคณะกรรมการบริษัท
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Company Switcher Card (Highlighted & Intuitive) */}
        {!isSupervisorMode && (
          <div className="mb-5 bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-800 shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  เลือกบริษัทที่ต้องการทำแบบประเมิน:
                </span>
                <span className="text-[11px] text-slate-500 hidden md:inline">
                  (กรณีที่ท่านดำรงตำแหน่งกรรมการทั้ง 2 บริษัท สามารถกดสลับบริษัทได้ทันที)
                </span>
              </div>

              {/* Two Prominent Company Toggle Buttons */}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSelectCompany('CLC')}
                  disabled={!allowedCompaniesForDirector.includes('CLC')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    company === 'CLC'
                      ? 'bg-amber-900 text-white border-amber-950 shadow-sm ring-2 ring-amber-500/40 cursor-default'
                      : !allowedCompaniesForDirector.includes('CLC')
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 cursor-pointer'
                  }`}
                  title={!allowedCompaniesForDirector.includes('CLC') ? 'ไม่มีสิทธิ์ประเมินในบริษัทนี้' : 'สลับไปยัง CLC'}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>CLC (เครดิตฟองซิเอร์)</span>
                  {!allowedCompaniesForDirector.includes('CLC') && (
                    <span className="text-[10px] text-slate-400 font-normal">(ไม่มีสิทธิ์)</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectCompany('CLFG')}
                  disabled={!allowedCompaniesForDirector.includes('CLFG')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    company === 'CLFG'
                      ? 'bg-blue-900 text-white border-blue-950 shadow-sm ring-2 ring-blue-500/40 cursor-default'
                      : !allowedCompaniesForDirector.includes('CLFG')
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 cursor-pointer'
                  }`}
                  title={!allowedCompaniesForDirector.includes('CLFG') ? 'ไม่มีสิทธิ์ประเมินในบริษัทนี้' : 'สลับไปยัง CLFG'}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>CLFG (ไฟแนนเชียล กรุ๊ป)</span>
                  {!allowedCompaniesForDirector.includes('CLFG') && (
                    <span className="text-[10px] text-slate-400 font-normal">(ไม่มีสิทธิ์)</span>
                  )}
                </button>
              </div>
            </div>

            {company === 'CLFG' && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                * หมายเหตุ: บมจ.แคปปิตอล ลิ้งค์ ไฟแนนเชียล กรุ๊ป (CLFG) จะมีเฉพาะแบบประเมินชุดที่ 1, 2, 3 (แบบประเมินพนักงานสายงานกำกับ CU, IA, Risk มีเฉพาะของ บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์ - CLC)
              </div>
            )}
          </div>
        )}

        {/* Lock Banner if SUBMITTED */}
        {isFormLocked && (
          <div className="mb-5 rounded-2xl bg-emerald-900 text-white p-4 sm:p-5 border border-emerald-700 shadow-sm flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-800 text-emerald-200 shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  ผลการประเมินชุดนี้ได้รับการยืนยันและส่งผลเรียบร้อยแล้ว (SUBMITTED)
                </h3>
                <p className="text-xs text-emerald-100">
                  ส่งเมื่อ {submittedAt ? new Date(submittedAt).toLocaleString('th-TH') : '-'} · บันทึกผลสำเร็จ (หากฝ่ายเลขาฯ ปลดล็อกแล้ว สามารถกดตรวจสอบได้ทันที)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCheckUnlockStatus}
                disabled={isCheckingUnlock}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-amber-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                title="กดเพื่อตรวจสอบว่าฝ่ายเลขานุการได้ทำการปลดล็อกให้ท่านแล้วหรือยัง"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUnlock ? 'animate-spin' : ''}`} />
                <span>{isCheckingUnlock ? 'กำลังตรวจสอบ...' : 'ตรวจสอบการปลดล็อกล่าสุด'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>ดาวน์โหลด Excel สรุปผล</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SEGMENTED NAVIGATION COLUMNS / TABS (Touch & Mobile Optimized) */}
        {/* ============================================================== */}
        {!isSupervisorMode && (
          <div id="evaluation-sections-nav" className="mb-6 scroll-mt-20">
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>เลือกส่วนแบบประเมินที่ต้องการทำ:</span>
              <span className="text-[11px] text-slate-500 font-normal">
                (แตะเลือกเพื่อเปิดทำทีละส่วนอย่างชัดเจน)
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {availableTabs.map((tab) => {
                const isActive = activeSectionTab === tab.id;
                const IconComponent = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSectionTab(tab.id);
                      scrollToEvaluationTop();
                    }}
                    className={`
                      p-3 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[80px] sm:min-h-[92px]
                      ${
                        isActive
                          ? 'bg-amber-950 text-white border-amber-900 shadow-md ring-2 ring-amber-500/50 scale-[1.01]'
                          : 'bg-white text-slate-800 border-slate-200/90 shadow-2xs hover:border-amber-400 hover:bg-amber-50/30'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-amber-800 text-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                      </div>
                      {tab.complete ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isActive ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}>
                          ครบถ้วน ✓
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-amber-800/80 text-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                          {tab.progress}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className={`text-xs sm:text-sm font-extrabold leading-tight ${isActive ? 'text-white' : 'text-slate-900'}`}>
                        {tab.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ACTIVE SECTION DISPLAY */}
        {/* ============================================================== */}
        {activeSectionTab === 's1' && !isSupervisorMode && evaluatorPerm.canEvaluateBoard && (
          <div>
            <SectionBoard
              items={questions.section1}
              scores={section1}
              comment={section1Comment}
              disabled={isFormLocked}
              onScoreChange={(id, val) => setSection1((prev) => ({ ...prev, [id]: val }))}
              onCommentChange={(val) => setSection1Comment(val)}
              onQuickFillExcellent={handleQuickFillSection1}
              onResetSection={handleResetSection1}
            />
            {/* Step Navigation Button */}
            <div className="flex justify-end mb-8">
              <button
                type="button"
                onClick={() => {
                  setActiveSectionTab('s2');
                  scrollToEvaluationTop();
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
              >
                <span>ไปยังส่วนถัดไป: 2. กรรมการรายบุคคล</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {activeSectionTab === 's2' && !isSupervisorMode && evaluatorPerm.canEvaluateDirectors && (
          <div>
            <SectionDirector
              items={questions.section2}
              directors={availableDirectors}
              evaluatorKey={evaluatorKey}
              selectedTargetDirectorKey={activeDirectorInSec2}
              onSelectTargetDirectorKey={(k) => setActiveDirectorInSec2(k)}
              crossScores={section2}
              comments={section2Comments}
              disabled={isFormLocked}
              onScoreChange={(targetKey, itemId, val) => {
                setSection2((prev) => ({
                  ...prev,
                  [targetKey]: {
                    ...(prev[targetKey] || {}),
                    [itemId]: val,
                  },
                }));
              }}
              onCommentChange={(targetKey, val) => {
                setSection2Comments((prev) => ({
                  ...prev,
                  [targetKey]: val,
                }));
              }}
              onQuickFillDirector={handleQuickFillDirector}
              onQuickFillAllDirectors={handleQuickFillAllDirectors}
              onResetDirector={handleResetDirector}
              onResetAllDirectors={() => {
                setSection2({});
                setSection2Comments({});
              }}
            />
            {/* Step Navigation Buttons */}
            <div className="flex items-center justify-between mb-8">
              <button
                type="button"
                onClick={() => {
                  setActiveSectionTab('s1');
                  scrollToEvaluationTop();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>กลับไป: 1. บอร์ดทั้งชุด</span>
              </button>
              {evaluatorPerm.canEvaluateMD && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSectionTab('s3');
                    scrollToEvaluationTop();
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
                >
                  <span>ไปยังส่วนถัดไป: 3. ผู้จัดการใหญ่</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {activeSectionTab === 's3' && !isSupervisorMode && evaluatorPerm.canEvaluateMD && (
          <div>
            <SectionMD
              items={questions.section3}
              evaluatorKey={evaluatorKey}
              scores={section3}
              comment={section3Comment}
              disabled={isFormLocked}
              onScoreChange={(id, val) => setSection3((prev) => ({ ...prev, [id]: val }))}
              onCommentChange={(val) => setSection3Comment(val)}
              onQuickFillExcellent={handleQuickFillSection3}
              onResetSection={handleResetSection3}
            />
            {/* Step Navigation Buttons */}
            <div className="flex items-center justify-between mb-8">
              <button
                type="button"
                onClick={() => {
                  setActiveSectionTab('s2');
                  scrollToEvaluationTop();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>กลับไป: 2. กรรมการรายบุคคล</span>
              </button>
              {company === 'CLC' && hasStaffAccess && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSectionTab('s4');
                    scrollToEvaluationTop();
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
                >
                  <span>ไปยังส่วนถัดไป: 4. พนักงานสายงานกำกับ</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {(activeSectionTab === 's4' || isSupervisorMode) && company === 'CLC' && (hasStaffAccess || isSupervisorMode) && (
          <div>
            <SectionStaff
              items={questions.section4}
              eligibleDepts={eligibleDepts}
              selectedDept={isSupervisorMode ? supervisorDept : selectedStaffDept}
              isSupervisorMode={isSupervisorMode}
              supervisorName={supervisorName}
              supervisorTitle={supervisorTitle}
              deptScores={section4}
              comments={section4Comments}
              disabled={isFormLocked}
              onDeptChange={(d) => setSelectedStaffDept(d)}
              onSupervisorNameChange={(val) => setSupervisorName(val)}
              onSupervisorTitleChange={(val) => setSupervisorTitle(val)}
              onScoreChange={(deptId, itemId, val) => {
                setSection4((prev) => ({
                  ...prev,
                  [deptId]: {
                    ...(prev[deptId] || {}),
                    [itemId]: val,
                  },
                }));
              }}
              onCommentChange={(deptId, val) => {
                setSection4Comments((prev) => ({
                  ...prev,
                  [deptId]: val,
                }));
              }}
              onQuickFillDept={handleQuickFillDept}
              onResetDept={handleResetDept}
            />
            {/* Step Navigation Buttons */}
            {!isSupervisorMode && (
              <div className="flex items-center justify-start mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSectionTab(evaluatorPerm.canEvaluateMD ? 's3' : 's2');
                    scrollToEvaluationTop();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>กลับไปส่วนก่อนหน้า</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Floating Bottom Submission Bar */}
        {status !== 'SUBMITTED' && (
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg p-3 sm:p-4">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isIncomplete ? (
                  <div className="flex items-center gap-2 text-amber-900 text-xs font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>ยังมีข้อที่ยังไม่ได้ตอบอีก {missingItems.length} ข้อ</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>ตอบครบถ้วนทุกข้อแล้ว พร้อมส่งผลการประเมิน</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleInitiateSubmit}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer active:scale-95 ring-2 ring-amber-500/30"
                >
                  <Send className="w-4 h-4 text-amber-300" />
                  <span>ยืนยันและส่งผลการประเมิน (Submit Final)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Corporate Footer */}
        <footer className="mt-12 pt-6 pb-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © พ.ศ. {year} เครือ บมจ.แคปปิตอล ลิ้งค์ ไฟแนนเชียล กรุ๊ป (CLFG) และ บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์ (CLC)
          </div>
          <div className="flex items-center gap-4">
            <span>ระบบประเมินผลการปฏิบัติงานประจำปีตามหลักบรรษัทภิบาล</span>
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-[11px]"
              title="สำหรับฝ่ายเลขานุการบริษัท"
            >
              ฝ่ายเลขานุการบริษัท
            </button>
          </div>
        </footer>

        {/* Floating Scroll to Top Button (ปุ่มเลื่อนไปบนสุด) */}
        {showScrollTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className={`fixed ${
              status === 'SUBMITTED' ? 'bottom-6' : 'bottom-20 sm:bottom-22'
            } right-4 sm:right-6 z-30 px-3.5 py-2.5 rounded-full bg-slate-900/90 hover:bg-amber-950 text-white shadow-xl hover:shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 animate-in fade-in slide-in-from-bottom-3 hover:-translate-y-0.5 group`}
            title="เลื่อนขึ้นบนสุด (Scroll to Top)"
            aria-label="เลื่อนขึ้นบนสุด"
          >
            <div className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center group-hover:bg-amber-500/50 transition-colors">
              <ChevronUp className="w-4 h-4 text-amber-300 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span>เลื่อนไปบนสุด</span>
          </button>
        )}
      </main>

      {/* Confirmation Modal Before Final Submit */}
      {isSubmitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center mb-4">
              <Send className="w-6 h-6 text-amber-800" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              ยืนยันการส่งผลการประเมินประจำปี?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              เมื่อส่งผลแล้ว ฟอร์มจะถูกล็อกเพื่อความโปร่งใส หากมีความจำเป็นต้องปรับปรุงคะแนนในภายหลัง โปรดประสานงานฝ่ายเลขานุการบริษัท
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div><strong>ผู้ประเมิน:</strong> {currentDirector?.name}</div>
              <div><strong>บริษัท / ปี:</strong> {company} / {year}</div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsSubmitConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ตรวจสอบอีกครั้ง
              </button>
              <button
                type="button"
                onClick={handleFinalSubmitConfirm}
                className="px-5 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                ยืนยันส่งผลการประเมิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal After Final Submit */}
      {isSubmitSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4 border border-emerald-300">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              ส่งผลการประเมินประจำปีเรียบร้อยแล้ว
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              ข้อมูลคะแนนของท่านถูกบันทึกและส่งตรงไปยังระบบของฝ่ายเลขานุการบริษัทเรียบร้อยแล้วทันที ขอบคุณสำหรับความร่วมมือในการประเมินผลการปฏิบัติงาน
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1">
              <div><strong>ผู้ประเมิน:</strong> {currentDirector?.name}</div>
              <div><strong>บริษัท / ปี:</strong> {company} / {year}</div>
              <div><strong>สถานะ:</strong> <span className="text-emerald-700 font-bold">ส่งผลสำเร็จแล้ว (SUBMITTED)</span></div>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsSubmitSuccessModalOpen(false)}
                className="w-full px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                ตกลง / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Incomplete Questions Checklist Modal */}
      <IncompleteCheckModal
        isOpen={isIncompleteModalOpen}
        onClose={() => setIsIncompleteModalOpen(false)}
        missingItems={missingItems}
        onProceedAnyway={() => {
          setIsIncompleteModalOpen(false);
          setIsSubmitConfirmOpen(true);
        }}
        onJumpToItem={handleJumpToItem}
      />

      {/* Delegation & Magic Link Share Modal */}
      <DelegationShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        company={company}
        year={year}
        directors={directorsList}
        currentDirectorKey={evaluatorKey}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onSwitchToContext={handleSwitchContext}
      />

      {/* Admin Panel Modal */}
      <AdminUnlockModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentFormData={currentFormData}
        directors={directorsList}
        questions={questions}
        permissions={permissions}
        managedYears={managedYears}
        onSaveManagedYears={handleSaveManagedYears}
        onEditDirectorSubmission={handleEditDirectorSubmission}
        onUnlockForm={handleAdminUnlock}
        onResetForm={handleAdminReset}
        onFillSampleData={handleAdminFillSample}
        onSaveQuestions={(updated) => setQuestions(updated)}
        onSavePermissions={(updated) => setPermissions(updated)}
        onSaveDirectors={(updated) => setDirectorsList(updated)}
        onSwitchToContext={handleSwitchContext}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-auto p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
