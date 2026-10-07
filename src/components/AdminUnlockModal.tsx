import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  AlertCircle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  Database,
  Edit3,
  SlidersHorizontal,
  Save,
  RotateCcw,
  X,
  Plus,
  Table,
  FileSpreadsheet,
  Users,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Award,
  Building2,
  ShieldCheck,
  UserCheck,
  CheckSquare,
  Square,
  Calendar,
  ChevronDown,
  Info,
  MessageSquare,
  Quote,
  Globe,
  AlertTriangle,
  Download,
  Upload,
  History,
  FileText,
  FileJson,
  Search,
  Filter,
  PlayCircle,
  ArrowDownToLine,
  FileDown,
} from 'lucide-react';
import {
  EvaluationFormData,
  Director,
  DirectorPermissions,
  EvaluationItem,
  CompanyId,
  FiscalYear,
  SubCommitteeDept,
} from '../types/evaluation';
import {
  DEFAULT_DIRECTOR_PERMISSIONS,
  DEFAULT_DIRECTORS,
  DEFAULT_SECTION_1_ITEMS,
  DEFAULT_SECTION_2_ITEMS,
  DEFAULT_SECTION_3_ITEMS,
  DEFAULT_SECTION_4_ITEMS,
  COMPANIES,
  FISCAL_YEARS,
  SUBCOMMITTEE_DEPTS,
  getEvaluationStorageKey,
  getLegacyEvaluationStorageKey,
} from '../data/evaluationData';
import { getGradeForDirectorAvg, getGradeBadgeStyle, getGradeForStaffScore } from '../utils/grading';
import { generateOfflineEvaluationHtml } from '../utils/offlineFormGenerator';
import * as XLSX from 'xlsx';

interface AdminUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormData: EvaluationFormData;
  directors: Director[];
  questions: {
    section1: EvaluationItem[];
    section2: EvaluationItem[];
    section3: EvaluationItem[];
    section4: EvaluationItem[];
  };
  permissions: Record<string, DirectorPermissions>;
  managedYears: string[];
  onSaveManagedYears: (updated: string[]) => void;
  onEditDirectorSubmission?: (
    evaluatorKey: string,
    company: CompanyId,
    year: string,
    submission?: any
  ) => void;
  onUnlockForm: () => void;
  onResetForm: () => void;
  onFillSampleData: () => void;
  onSaveQuestions: (updated: {
    section1: EvaluationItem[];
    section2: EvaluationItem[];
    section3: EvaluationItem[];
    section4: EvaluationItem[];
  }) => void;
  onSavePermissions: (updated: Record<string, DirectorPermissions>) => void;
  onSaveDirectors: (updated: Director[]) => void;
  onSwitchToContext?: (params: {
    company: CompanyId;
    year: FiscalYear;
    evaluatorKey: string;
    isSupervisor: boolean;
    dept: SubCommitteeDept;
  }) => void;
}

export const AdminUnlockModal: React.FC<AdminUnlockModalProps> = ({
  isOpen,
  onClose,
  currentFormData,
  directors,
  questions,
  permissions,
  managedYears,
  onSaveManagedYears,
  onEditDirectorSubmission,
  onUnlockForm,
  onResetForm,
  onFillSampleData,
  onSaveQuestions,
  onSavePermissions,
  onSaveDirectors,
  onSwitchToContext,
}) => {
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('clg_admin_auth') === 'true';
  });
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | 'boardDirectorSummary'
    | 'sheetSummary'
    | 'permissions'
    | 'links'
    | 'directors'
    | 'questions'
    | 'yearsAndSystem'
    | 'submissionsManagement'
    | 'backups'
    | 'auditLogs'
  >('boardDirectorSummary');

  // Selected year for summary & submissions
  const [summaryYear, setSummaryYear] = useState<string>(
    currentFormData.year || managedYears[0] || '2569'
  );
  const [newYearInput, setNewYearInput] = useState('');
  const [yearSaveNotice, setYearSaveNotice] = useState(false);
  const [editingYearKey, setEditingYearKey] = useState<string | null>(null);
  const [editingYearVal, setEditingYearVal] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'DRAFT' | 'NONE'>('ALL');

  // Granular Reset State
  const [resetTargetKey, setResetTargetKey] = useState<string>(directors[0]?.key || 'pannee');
  const [resetSectionsSelected, setResetSectionsSelected] = useState<{
    s1: boolean;
    s2: boolean;
    s3: boolean;
    s4: boolean;
  }>({
    s1: true,
    s2: true,
    s3: true,
    s4: true,
  });
  const [confirmResetSelected, setConfirmResetSelected] = useState(false);
  const [confirmResetPersonAll, setConfirmResetPersonAll] = useState(false);
  const [confirmResetSystemAll, setConfirmResetSystemAll] = useState(false);
  const [isResetCenterModalOpen, setIsResetCenterModalOpen] = useState(false);
  const [resetTargetScope, setResetTargetScope] = useState<'person' | 'system'>('person');

  // Directors state
  const [localDirectors, setLocalDirectors] = useState<Director[]>(directors);
  const [newDirName, setNewDirName] = useState('');
  const [newDirTitle, setNewDirTitle] = useState('');
  const [dirSaveNotice, setDirSaveNotice] = useState(false);

  // Question editing state
  const [editableSection, setEditableSection] = useState<'s1' | 's2' | 's3' | 's4'>('s1');
  const [localQuestions, setLocalQuestions] = useState(questions);
  const [newQCode, setNewQCode] = useState('');
  const [newQTitle, setNewQTitle] = useState('');
  const [questionSaveNotice, setQuestionSaveNotice] = useState(false);

  // Permission editing state
  const [localPermissions, setLocalPermissions] = useState<Record<string, DirectorPermissions>>(permissions);
  const [permSaveNotice, setPermSaveNotice] = useState(false);

  // Submissions (fetched from server & local storage)
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Selected company for Director Breakdown Summary
  const [summaryCompany, setSummaryCompany] = useState<CompanyId>('CLC');
  const [summarySection, setSummarySection] = useState<'board' | 'directors' | 'md' | 'comments'>('board');
  const [selectedTargetDirectorKey, setSelectedTargetDirectorKey] = useState<string>('');

  // Selected dept for Staff Google Sheet Master Table
  const [selectedSheetDept, setSelectedSheetDept] = useState<'CU' | 'IA' | 'RISK'>('CU');

  // Link generator settings inside admin
  const [selectedLinkYear, setSelectedLinkYear] = useState<FiscalYear>(currentFormData.year);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);

  // Delegating director per department for supervisor delegation links
  const [delegatingDirectors, setDelegatingDirectors] = useState<Record<SubCommitteeDept, string>>({
    CU: 'chaianan',
    RISK: 'chaianan',
    IA: 'ruangwit',
  });

  // Base URL for generated links (defaults to current live Google AI Studio URL)
  const [customBaseUrl, setCustomBaseUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('clg_public_domain');
      if (stored && !stored.includes('ais-pre-')) return stored;
      return window.location.origin + window.location.pathname;
    }
    return '';
  });
  const [serverUrls, setServerUrls] = useState<{ sharedUrl: string; devUrl: string }>({
    sharedUrl: '',
    devUrl: '',
  });
  const [isEditingBaseUrl, setIsEditingBaseUrl] = useState(false);

  // Backup & Disaster Recovery States
  interface BackupSnapshot {
    id: string;
    filename: string;
    timestamp: string;
    reason: string;
    submissionsCount: number;
    sizeBytes: number;
  }

  interface AuditLogEntry {
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    details: string;
    target?: string;
    metadata?: any;
  }

  const [backupsList, setBackupsList] = useState<BackupSnapshot[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupReasonInput, setBackupReasonInput] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [snapshotToRestore, setSnapshotToRestore] = useState<BackupSnapshot | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [uploadedBackupPreview, setUploadedBackupPreview] = useState<{
    submissionsCount: number;
    submissions: any[];
    exportTimestamp?: string;
    organization?: string;
  } | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  // Audit Logs State
  const [auditLogsList, setAuditLogsList] = useState<AuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('ALL');
  const [logActorFilter, setLogActorFilter] = useState('ALL');

  // Deletion confirmation state with explicit double-check
  const [deleteConfirmSubmission, setDeleteConfirmSubmission] = useState<{
    sub: any;
    name: string;
  } | null>(null);
  const [masterClearConfirmInput, setMasterClearConfirmInput] = useState('');
  const [isMasterClearModalOpen, setIsMasterClearModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load submissions from server & local storage
  const loadAllSubmissions = async () => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch from server
    try {
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData)) {
          serverData.forEach((item) => {
            const id = `${item.company}_${item.year}_${item.evaluatorKey}${
              item.isSupervisorMode ? `_${item.supervisorDept}` : ''
            }`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              list.push(item);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch server submissions:', e);
    }

    // 2. Fetch from localStorage (in case client is testing locally)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('clg_eval_')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const id = `${parsed.company}_${parsed.year}_${parsed.evaluatorKey}${
                parsed.isSupervisorMode ? `_${parsed.supervisorDept}` : ''
              }`;
              if (!seenIds.has(id)) {
                seenIds.add(id);
                list.push(parsed);
              }
            } catch {}
          }
        }
      }
    } catch {}

    setAllSubmissions(list);
    setLastRefreshedAt(new Date().toLocaleTimeString('th-TH'));
  };

  const handleSavePublicBaseUrl = async (newUrl: string) => {
    const trimmed = newUrl.trim();
    setCustomBaseUrl(trimmed);
    try {
      localStorage.setItem('clg_public_domain', trimmed);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicBaseUrl: trimmed }),
      });
      showActionNotice('✅ บันทึกโดเมนสาธารณะเรียบร้อยแล้ว ลิงก์ทั้งหมดจะใช้โดเมนนี้');
    } catch {
      showActionNotice('⚠️ บันทึกลงหน่วยความจำเครื่องนี้เรียบร้อยแล้ว');
    }
  };

  const handleDownloadDirectorOfflineForm = (dir: Director) => {
    const perm = localPermissions[dir.key] || DEFAULT_DIRECTOR_PERMISSIONS[dir.key];
    const canClc = perm?.clc?.canEvaluateBoard || perm?.clc?.canEvaluateDirectors;
    const targetComp: CompanyId = canClc ? 'CLC' : 'CLFG';

    const htmlContent = generateOfflineEvaluationHtml({
      director: dir,
      company: targetComp,
      year: selectedLinkYear,
      questions: localQuestions,
      permissions: localPermissions,
      allDirectors: localDirectors,
    });

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `แบบประเมิน_${dir.name}_${targetComp}_${selectedLinkYear}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showActionNotice(`📥 ดาวน์โหลดแบบประเมินออฟไลน์ของ "${dir.name}" เรียบร้อยแล้ว (เปิดได้ทุกอุปกรณ์โดยไม่ต้องล็อกอิน Google)`);
  };

  const handleDownloadSupervisorOfflineForm = (deptId: SubCommitteeDept) => {
    const delegatingDirKey = delegatingDirectors[deptId];
    const delegatingDir = localDirectors.find((d) => d.key === delegatingDirKey) || localDirectors[0];

    const htmlContent = generateOfflineEvaluationHtml({
      director: delegatingDir,
      company: 'CLC',
      year: selectedLinkYear,
      isSupervisor: true,
      supervisorDept: deptId,
      questions: localQuestions,
      permissions: localPermissions,
      allDirectors: localDirectors,
    });

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `แบบประเมินพนักงานสายงาน${deptId}_ผู้รับมอบหมาย_${selectedLinkYear}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showActionNotice(`📥 ดาวน์โหลดแบบประเมินพนักงานสายงาน ${deptId} เรียบร้อยแล้ว (เปิดได้ทุกอุปกรณ์โดยไม่ต้องล็อกอิน Google)`);
  };

  useEffect(() => {
    if (isOpen) {
      setLocalQuestions(questions);
      setLocalPermissions(permissions);
      setLocalDirectors(directors);

      const localPublic = localStorage.getItem('clg_public_domain');
      if (localPublic && !localPublic.includes('ais-pre-')) {
        setCustomBaseUrl(localPublic);
      } else {
        const detectedBase = window.location.origin + window.location.pathname;
        setCustomBaseUrl(detectedBase);
      }

      loadAllSubmissions();
      loadBackups();
      loadAuditLogs();

      // Fetch server config for public shared app URL
      fetch('/api/config')
        .then((r) => r.json())
        .then((data) => {
          if (data) {
            setServerUrls({
              sharedUrl: data.sharedUrl || '',
              devUrl: data.devUrl || '',
            });
            if (data.publicBaseUrl) {
              setCustomBaseUrl(data.publicBaseUrl);
            } else if (!localPublic && data.sharedUrl) {
              setCustomBaseUrl(data.sharedUrl + window.location.pathname);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, questions, permissions, directors]);

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setBackupsList(data);
      }
    } catch (e) {
      console.warn('Could not fetch backups:', e);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAuditLogsList(data);
      }
    } catch (e) {
      console.warn('Could not fetch logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const reason = backupReasonInput.trim() || 'สำรองข้อมูลโดยเลขานุการบริษัท';
      const res = await fetch('/api/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, actor: 'เลขานุการบริษัท' }),
      });
      if (res.ok) {
        setBackupReasonInput('');
        await loadBackups();
        await loadAuditLogs();
        showActionNotice('✅ บันทึกจุดสำรองข้อมูล Snapshot สำเร็จ');
      } else {
        showActionNotice('❌ ไม่สามารถสร้างจุดสำรองข้อมูลได้');
      }
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการสร้างจุดสำรองข้อมูล');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot: BackupSnapshot) => {
    setIsRestoringBackup(true);
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: snapshot.filename, actor: 'เลขานุการบริษัท' }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadAllSubmissions();
        await loadBackups();
        await loadAuditLogs();
        setSnapshotToRestore(null);
        showActionNotice(`✅ เรียกคืนข้อมูลสำเร็จ (${data.restoredCount || 0} รายการ) ระบบได้สร้าง Snapshot นิรภัยก่อนกู้คืนไว้ให้อัตโนมัติ`);
      } else {
        showActionNotice('❌ ไม่สามารถเรียกคืนข้อมูลได้');
      }
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการเรียกคืนข้อมูล');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleDeleteSnapshot = async (snapshot: BackupSnapshot) => {
    if (!confirm(`คุณต้องการลบไฟล์สำรอง Snapshot "${snapshot.filename}" หรือไม่?`)) return;
    try {
      const res = await fetch('/api/backups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: snapshot.filename, actor: 'เลขานุการบริษัท' }),
      });
      if (res.ok) {
        await loadBackups();
        await loadAuditLogs();
        showActionNotice('✅ ลบ Snapshot เรียบร้อยแล้ว');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadFullBackup = () => {
    window.location.href = '/api/backups/download';
    showActionNotice('📥 เริ่มดาวน์โหลดไฟล์สำรองฉบับเต็ม (.json) แล้ว');
    setTimeout(() => {
      loadAuditLogs();
    }, 1500);
  };

  const handleFileUploadAndPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const subs = Array.isArray(parsed.submissions) ? parsed.submissions : Array.isArray(parsed) ? parsed : null;
        if (!subs) {
          showActionNotice('❌ โครงสร้างไฟล์สำรองไม่ถูกต้อง ไม่พบรายการ submissions');
          return;
        }
        setUploadedBackupPreview({
          submissionsCount: subs.length,
          submissions: subs,
          exportTimestamp: parsed.exportTimestamp || parsed.timestamp,
          organization: parsed.organization,
        });
        showActionNotice(`✅ ตรวจสอบไฟล์สำเร็จ พบข้อมูลผลการประเมิน ${subs.length} ชุด`);
      } catch (err) {
        console.error(err);
        showActionNotice('❌ ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบไฟล์');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImportFile = async () => {
    if (!uploadedBackupPreview) return;
    setIsImportingBackup(true);
    try {
      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissions: uploadedBackupPreview.submissions,
          actor: 'เลขานุการบริษัท (นำเข้าจากไฟล์)',
        }),
      });
      if (res.ok) {
        await loadAllSubmissions();
        await loadBackups();
        await loadAuditLogs();
        setUploadedBackupPreview(null);
        setUploadedFileName('');
        showActionNotice('✅ นำเข้าข้อมูลผลการประเมินสำเร็จ และระบบได้สร้าง Safety Snapshot ก่อนบันทึกทับให้อัตโนมัติ');
      } else {
        showActionNotice('❌ ไม่สามารถนำเข้าข้อมูลจากไฟล์ได้');
      }
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการนำเข้าไฟล์');
    } finally {
      setIsImportingBackup(false);
    }
  };

  const handleDownloadLogsCsv = () => {
    if (auditLogsList.length === 0) {
      showActionNotice('⚠️ ไม่มีรายการบันทึกที่จะดาวน์โหลด');
      return;
    }
    const headers = ['Timestamp', 'Action', 'Actor', 'Details', 'Target'];
    const rows = auditLogsList.map((l) => [
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${l.actor || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${(l.target || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showActionNotice('📥 ดาวน์โหลดประวัติระบบ (Audit Logs CSV) เรียบร้อยแล้ว');
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pin.trim().toLowerCase();
    if (clean === 'clc2026' || clean === 'clg2025' || clean === 'admin') {
      setIsAuthorized(true);
      setPinError(false);
      try {
        sessionStorage.setItem('clg_admin_auth', 'true');
      } catch {}
    } else {
      setPinError(true);
    }
  };

  // ----------------------------------------------------
  // Director CRUD
  // ----------------------------------------------------
  const handleAddDirector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirName.trim()) return;
    const newKey = `dir_${Date.now()}`;
    const newDir: Director = {
      key: newKey,
      name: newDirName.trim(),
      title: newDirTitle.trim() || 'กรรมการ',
    };
    const updated = [...localDirectors, newDir];
    setLocalDirectors(updated);
    setNewDirName('');
    setNewDirTitle('');
    localStorage.setItem('clg_custom_directors', JSON.stringify(updated));
    onSaveDirectors(updated);
    setDirSaveNotice(true);
    setTimeout(() => setDirSaveNotice(false), 2000);
  };

  const handleDeleteDirector = (key: string) => {
    if (confirm(`คุณต้องการลบรายชื่อกรรมการ ${key} หรือไม่?`)) {
      const updated = localDirectors.filter((d) => d.key !== key);
      setLocalDirectors(updated);
      localStorage.setItem('clg_custom_directors', JSON.stringify(updated));
      onSaveDirectors(updated);
    }
  };

  const handleUpdateDirector = (key: string, field: 'name' | 'title', value: string) => {
    const updated = localDirectors.map((d) =>
      d.key === key ? { ...d, [field]: value } : d
    );
    setLocalDirectors(updated);
    localStorage.setItem('clg_custom_directors', JSON.stringify(updated));
    onSaveDirectors(updated);
  };

  const handleRestoreDefaultDirectors = () => {
    if (confirm('คืนค่ารายชื่อกรรมการกลับสู่ค่าเริ่มต้น 10 ท่านหรือไม่?')) {
      setLocalDirectors(DEFAULT_DIRECTORS);
      localStorage.removeItem('clg_custom_directors');
      onSaveDirectors(DEFAULT_DIRECTORS);
    }
  };

  // ----------------------------------------------------
  // Question CRUD
  // ----------------------------------------------------
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQTitle.trim()) return;
    const secKey = editableSection === 's1' ? 'section1' : editableSection === 's2' ? 'section2' : editableSection === 's3' ? 'section3' : 'section4';
    const newId = `q_${Date.now()}`;
    const newItem: EvaluationItem = {
      id: newId,
      code: newQCode.trim() || `ข้อ ${localQuestions[secKey].length + 1}`,
      title: newQTitle.trim(),
    };
    const updated = {
      ...localQuestions,
      [secKey]: [...localQuestions[secKey], newItem],
    };
    setLocalQuestions(updated);
    setNewQCode('');
    setNewQTitle('');
    localStorage.setItem('clg_custom_questions', JSON.stringify(updated));
    onSaveQuestions(updated);
    setQuestionSaveNotice(true);
    setTimeout(() => setQuestionSaveNotice(false), 2000);
  };

  const handleDeleteQuestion = (sec: 's1' | 's2' | 's3' | 's4', id: string) => {
    if (confirm('คุณต้องการลบหัวข้อคำถามนี้หรือไม่?')) {
      const secKey = sec === 's1' ? 'section1' : sec === 's2' ? 'section2' : sec === 's3' ? 'section3' : 'section4';
      const updated = {
        ...localQuestions,
        [secKey]: localQuestions[secKey].filter((q) => q.id !== id),
      };
      setLocalQuestions(updated);
      localStorage.setItem('clg_custom_questions', JSON.stringify(updated));
      onSaveQuestions(updated);
    }
  };

  const handleUpdateQuestion = (sec: 's1' | 's2' | 's3' | 's4', id: string, field: 'title' | 'code', val: string) => {
    const secKey = sec === 's1' ? 'section1' : sec === 's2' ? 'section2' : sec === 's3' ? 'section3' : 'section4';
    const updated = {
      ...localQuestions,
      [secKey]: localQuestions[secKey].map((q) => (q.id === id ? { ...q, [field]: val } : q)),
    };
    setLocalQuestions(updated);
    localStorage.setItem('clg_custom_questions', JSON.stringify(updated));
    onSaveQuestions(updated);
  };

  const handleRestoreDefaultQuestions = () => {
    if (confirm('คืนค่าหัวข้อการประเมินกลับสู่มาตรฐาน PDF หรือไม่?')) {
      const defaults = {
        section1: DEFAULT_SECTION_1_ITEMS,
        section2: DEFAULT_SECTION_2_ITEMS,
        section3: DEFAULT_SECTION_3_ITEMS,
        section4: DEFAULT_SECTION_4_ITEMS,
      };
      setLocalQuestions(defaults);
      localStorage.removeItem('clg_custom_questions');
      onSaveQuestions(defaults);
    }
  };

  // ----------------------------------------------------
  // Permissions Matrix Management
  // ----------------------------------------------------
  const handleToggleClcPermission = (dirKey: string, field: keyof DirectorPermissions['clc']) => {
    setLocalPermissions((prev) => {
      const existing = prev[dirKey] || DEFAULT_DIRECTOR_PERMISSIONS[dirKey] || {
        clc: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true, canEvaluateCU: false, canEvaluateIA: false, canEvaluateRISK: false },
        clfg: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true },
      };
      return {
        ...prev,
        [dirKey]: {
          ...existing,
          clc: {
            ...existing.clc,
            [field]: !existing.clc[field],
          },
        },
      };
    });
  };

  const handleToggleClfgPermission = (dirKey: string, field: keyof DirectorPermissions['clfg']) => {
    setLocalPermissions((prev) => {
      const existing = prev[dirKey] || DEFAULT_DIRECTOR_PERMISSIONS[dirKey] || {
        clc: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true, canEvaluateCU: false, canEvaluateIA: false, canEvaluateRISK: false },
        clfg: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true },
      };
      return {
        ...prev,
        [dirKey]: {
          ...existing,
          clfg: {
            ...existing.clfg,
            [field]: !existing.clfg[field],
          },
        },
      };
    });
  };

  // Batch Toggle Column for CLC
  const handleBatchToggleClc = (field: keyof DirectorPermissions['clc']) => {
    // Check if all currently true
    const allTrue = localDirectors.every((d) => {
      const p = localPermissions[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key];
      return p?.clc?.[field] === true;
    });
    const targetValue = !allTrue;

    setLocalPermissions((prev) => {
      const next = { ...prev };
      localDirectors.forEach((d) => {
        const existing = next[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key] || {
          clc: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true, canEvaluateCU: false, canEvaluateIA: false, canEvaluateRISK: false },
          clfg: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true },
        };
        next[d.key] = {
          ...existing,
          clc: {
            ...existing.clc,
            [field]: targetValue,
          },
        };
      });
      return next;
    });
  };

  // Batch Toggle Column for CLFG
  const handleBatchToggleClfg = (field: keyof DirectorPermissions['clfg']) => {
    const allTrue = localDirectors.every((d) => {
      const p = localPermissions[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key];
      return p?.clfg?.[field] === true;
    });
    const targetValue = !allTrue;

    setLocalPermissions((prev) => {
      const next = { ...prev };
      localDirectors.forEach((d) => {
        const existing = next[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key] || {
          clc: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true, canEvaluateCU: false, canEvaluateIA: false, canEvaluateRISK: false },
          clfg: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true },
        };
        next[d.key] = {
          ...existing,
          clfg: {
            ...existing.clfg,
            [field]: targetValue,
          },
        };
      });
      return next;
    });
  };

  const handleSavePermissions = () => {
    localStorage.setItem('clg_director_permissions', JSON.stringify(localPermissions));
    onSavePermissions(localPermissions);
    setPermSaveNotice(true);
    setTimeout(() => setPermSaveNotice(false), 2000);
  };

  const handleRestoreDefaultPermissions = () => {
    if (confirm('คืนค่าสิทธิการประเมินของกรรมการทุกท่านกลับสู่ค่าเริ่มต้นตามเกณฑ์ธรรมาภิบาลหรือไม่?')) {
      setLocalPermissions(DEFAULT_DIRECTOR_PERMISSIONS);
      localStorage.removeItem('clg_director_permissions');
      onSavePermissions(DEFAULT_DIRECTOR_PERMISSIONS);
      setPermSaveNotice(true);
      setTimeout(() => setPermSaveNotice(false), 2000);
    }
  };

  const showActionNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Year Management Handlers
  const handleAddNewYear = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newYearInput.trim();
    if (!trimmed) return;
    if (!/^\d{4}$/.test(trimmed)) {
      alert('กรุณากรอกปี พ.ศ. เป็นตัวเลข 4 หลัก เช่น 2572');
      return;
    }
    if (managedYears.includes(trimmed)) {
      alert(`ปี พ.ศ. ${trimmed} มีอยู่ในระบบแล้ว`);
      return;
    }
    const updated = [...managedYears, trimmed].sort();
    onSaveManagedYears(updated);
    setNewYearInput('');
    setYearSaveNotice(true);
    setTimeout(() => setYearSaveNotice(false), 2500);
  };

  const handleDeleteYear = (yearToDelete: string) => {
    if (managedYears.length <= 1) {
      alert('ไม่สามารถลบปีสุดท้ายได้ ระบบต้องมีปีประเมินอย่างน้อย 1 ปี');
      return;
    }
    if (confirm(`คุณต้องการลบปี พ.ศ. ${yearToDelete} ออกจากระบบใช่หรือไม่?`)) {
      const updated = managedYears.filter((y) => y !== yearToDelete);
      onSaveManagedYears(updated);
      if (summaryYear === yearToDelete) {
        setSummaryYear(updated[0]);
      }
      setYearSaveNotice(true);
      setTimeout(() => setYearSaveNotice(false), 2500);
    }
  };

  const handleStartEditYear = (y: string) => {
    setEditingYearKey(y);
    setEditingYearVal(y);
  };

  const handleSaveEditYear = (oldYear: string) => {
    const trimmed = editingYearVal.trim();
    if (!trimmed) return;
    if (!/^\d{4}$/.test(trimmed)) {
      alert('กรุณากรอกปี พ.ศ. เป็นตัวเลข 4 หลัก เช่น 2572');
      return;
    }
    if (trimmed !== oldYear && managedYears.includes(trimmed)) {
      alert(`ปี พ.ศ. ${trimmed} มีอยู่ในระบบแล้ว`);
      return;
    }
    const updated = managedYears.map((y) => (y === oldYear ? trimmed : y)).sort();
    onSaveManagedYears(updated);
    if (summaryYear === oldYear) {
      setSummaryYear(trimmed);
    }
    setEditingYearKey(null);
    setEditingYearVal('');
    setYearSaveNotice(true);
    setTimeout(() => setYearSaveNotice(false), 2500);
  };

  // Submissions & Per-Director Unlock Handlers
  const handleUnlockDirectorSubmission = async (targetSubmission: any, directorName: string) => {
    try {
      const payload = {
        id: targetSubmission.id,
        company: targetSubmission.company,
        year: targetSubmission.year,
        evaluatorKey: targetSubmission.evaluatorKey,
        isSupervisorMode: targetSubmission.isSupervisorMode,
        supervisorDept: targetSubmission.supervisorDept,
      };
      const res = await fetch('/api/submissions/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const storageKey = getEvaluationStorageKey(
          targetSubmission.company,
          targetSubmission.year,
          targetSubmission.evaluatorKey,
          targetSubmission.isSupervisorMode,
          targetSubmission.supervisorDept
        );
        const legacyKey = getLegacyEvaluationStorageKey(
          targetSubmission.company,
          targetSubmission.year,
          targetSubmission.evaluatorKey,
          targetSubmission.isSupervisorMode,
          targetSubmission.supervisorDept
        );
        [storageKey, legacyKey].forEach((key) => {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              parsed.status = 'DRAFT';
              delete parsed.submittedAt;
              localStorage.setItem(key, JSON.stringify(parsed));
            } catch {}
          }
        });

        const isCurrentActive =
          currentFormData.evaluatorKey === targetSubmission.evaluatorKey &&
          currentFormData.company === targetSubmission.company &&
          currentFormData.year === targetSubmission.year &&
          (targetSubmission.isSupervisorMode
            ? currentFormData.isSupervisorMode && currentFormData.supervisorDept === targetSubmission.supervisorDept
            : !currentFormData.isSupervisorMode);

        if (isCurrentActive) {
          onUnlockForm();
        }
        await loadAllSubmissions();
        showActionNotice(`✅ ปลดล็อกฟอร์มของ "${directorName}" เรียบร้อยแล้ว (สถานะกลับเป็น DRAFT ให้แก้ไขได้ทันที)`);
      } else {
        showActionNotice(`❌ ไม่สามารถปลดล็อกได้จากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง`);
      }
    } catch (e) {
      console.error(e);
      showActionNotice(`❌ เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อปลดล็อก`);
    }
  };

  const handleDeleteDirectorSubmission = async (targetSubmission: any, directorName: string) => {
    if (
      !confirm(
        `⚠️ คุณต้องการลบข้อมูลผลการประเมินของ "${directorName}" ออกจากระบบใช่หรือไม่?\n\n(ระบบได้ทำการสำรองข้อมูลฉุกเฉิน Snapshot อัตโนมัติไว้แล้วในแท็บ '9. สำรอง & กู้คืนข้อมูล' หากลบผิดพลาดสามารถกู้คืนได้ทันที)`
      )
    ) {
      return;
    }
    try {
      await fetch('/api/submissions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetSubmission.id,
          company: targetSubmission.company,
          year: targetSubmission.year,
          evaluatorKey: targetSubmission.evaluatorKey,
          isSupervisorMode: targetSubmission.isSupervisorMode,
          supervisorDept: targetSubmission.supervisorDept,
          actor: 'เลขานุการบริษัท',
        }),
      });
      const storageKey = getEvaluationStorageKey(
        targetSubmission.company,
        targetSubmission.year,
        targetSubmission.evaluatorKey,
        targetSubmission.isSupervisorMode,
        targetSubmission.supervisorDept
      );
      localStorage.removeItem(storageKey);
      if (
        currentFormData.evaluatorKey === targetSubmission.evaluatorKey &&
        currentFormData.company === targetSubmission.company &&
        currentFormData.year === targetSubmission.year
      ) {
        onResetForm();
      }
      await loadAllSubmissions();
      await loadBackups();
      await loadAuditLogs();
      showActionNotice(`🗑️ ลบข้อมูลของ "${directorName}" เรียบร้อยแล้ว (ระบบได้สร้างจุดสำรองนิรภัยไว้ให้แล้ว)`);
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const handleEditAsSecretary = (dirKey: string, _dirName: string, sub?: any) => {
    if (onEditDirectorSubmission) {
      onEditDirectorSubmission(dirKey, summaryCompany, summaryYear, sub);
    }
  };

  const handleOpenResetDialog = (targetKey?: string) => {
    if (targetKey) {
      setResetTargetKey(targetKey);
      setResetTargetScope('person');
    }
    setConfirmResetSelected(false);
    setConfirmResetPersonAll(false);
    setConfirmResetSystemAll(false);
    setIsResetCenterModalOpen(true);
  };

  // Granular Reset: Selective Sections for Person
  const handleResetSelectiveSectionsForPerson = async () => {
    if (!resetTargetKey) {
      showActionNotice('⚠️ กรุณาเลือกกรรมการหรือผู้ประเมินที่ต้องการล้างคะแนน');
      return;
    }

    const sectionsToReset: string[] = [];
    if (resetSectionsSelected.s1) sectionsToReset.push('s1');
    if (resetSectionsSelected.s2) sectionsToReset.push('s2');
    if (resetSectionsSelected.s3) sectionsToReset.push('s3');
    if (resetSectionsSelected.s4) sectionsToReset.push('s4');

    if (sectionsToReset.length === 0) {
      showActionNotice('⚠️ กรุณาเลือกแบบประเมินอย่างน้อย 1 ส่วนที่ต้องการล้างคะแนน');
      return;
    }

    const isSupervisorTarget = resetTargetKey.startsWith('sup_');
    let targetSub: any = null;
    let targetName = '';
    let evalKey = '';
    let isSup = false;
    let sDept = 'CU';

    if (isSupervisorTarget) {
      const supDept = resetTargetKey.replace('sup_', '');
      targetSub = submissionsForCompany.find(
        (s) => s.isSupervisorMode && s.supervisorDept === supDept
      );
      targetName = targetSub?.supervisorName || `หัวหน้างานสายงาน ${supDept}`;
      evalKey = targetSub?.evaluatorKey || currentFormData.evaluatorKey;
      isSup = true;
      sDept = supDept;
    } else {
      targetSub = submissionsForCompany.find(
        (s) => s.evaluatorKey === resetTargetKey && !s.isSupervisorMode
      );
      const dir = directors.find((d) => d.key === resetTargetKey);
      targetName = dir?.name || targetSub?.evaluatorName || resetTargetKey;
      evalKey = resetTargetKey;
    }

    const sectionLabels = sectionsToReset
      .map((s) => {
        if (s === 's1') return 'ส่วนที่ 1 (บอร์ดทั้งชุด)';
        if (s === 's2') return 'ส่วนที่ 2 (กรรมการรายบุคคล)';
        if (s === 's3') return 'ส่วนที่ 3 (ผู้จัดการใหญ่)';
        if (s === 's4') return 'ส่วนที่ 4 (พนักงานสายงาน)';
        return s;
      })
      .join(', ');

    const subId =
      targetSub?.id ||
      `${summaryCompany}_${summaryYear}_${evalKey}${isSup ? `_${sDept}` : ''}`;

    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subId,
          company: summaryCompany,
          year: summaryYear,
          evaluatorKey: evalKey,
          isSupervisorMode: isSup,
          supervisorDept: sDept,
          sections: sectionsToReset,
        }),
      });

      const storageKey = getEvaluationStorageKey(
        summaryCompany,
        summaryYear as any,
        evalKey,
        isSup,
        sDept
      );
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          parsed.status = 'DRAFT';
          delete parsed.submittedAt;
          if (resetSectionsSelected.s1) {
            parsed.section1 = {};
            parsed.section1Comment = '';
          }
          if (resetSectionsSelected.s2) {
            parsed.section2 = {};
            parsed.section2Comments = {};
          }
          if (resetSectionsSelected.s3) {
            parsed.section3 = {};
            parsed.section3Comment = '';
          }
          if (resetSectionsSelected.s4) {
            parsed.section4 = {};
            parsed.section4Comments = {};
          }
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        } catch {}
      }

      if (
        currentFormData.evaluatorKey === evalKey &&
        currentFormData.company === summaryCompany &&
        currentFormData.year === summaryYear
      ) {
        onUnlockForm();
      }

      await loadAllSubmissions();
      setConfirmResetSelected(false);
      showActionNotice(
        `✅ ล้างคะแนน ${sectionLabels} ของ "${targetName}" เรียบร้อยแล้ว (สถานะกลับเป็น DRAFT)`
      );
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการล้างคะแนน');
    }
  };

  // Granular Reset: Wipe ALL for Person
  const handleResetAllForPerson = async () => {
    if (!resetTargetKey) {
      showActionNotice('⚠️ กรุณาเลือกกรรมการหรือผู้ประเมินที่ต้องการล้างคะแนน');
      return;
    }

    const isSupervisorTarget = resetTargetKey.startsWith('sup_');
    let targetSub: any = null;
    let targetName = '';
    let evalKey = '';
    let isSup = false;
    let sDept = 'CU';

    if (isSupervisorTarget) {
      const supDept = resetTargetKey.replace('sup_', '');
      targetSub = submissionsForCompany.find(
        (s) => s.isSupervisorMode && s.supervisorDept === supDept
      );
      targetName = targetSub?.supervisorName || `หัวหน้างานสายงาน ${supDept}`;
      evalKey = targetSub?.evaluatorKey || currentFormData.evaluatorKey;
      isSup = true;
      sDept = supDept;
    } else {
      targetSub = submissionsForCompany.find(
        (s) => s.evaluatorKey === resetTargetKey && !s.isSupervisorMode
      );
      const dir = directors.find((d) => d.key === resetTargetKey);
      targetName = dir?.name || targetSub?.evaluatorName || resetTargetKey;
      evalKey = resetTargetKey;
    }

    const subId =
      targetSub?.id ||
      `${summaryCompany}_${summaryYear}_${evalKey}${isSup ? `_${sDept}` : ''}`;

    try {
      await fetch('/api/submissions/reset-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subId,
          company: summaryCompany,
          year: summaryYear,
          evaluatorKey: evalKey,
          isSupervisorMode: isSup,
          supervisorDept: sDept,
          resetAll: true,
        }),
      });

      const storageKey = getEvaluationStorageKey(
        summaryCompany,
        summaryYear as any,
        evalKey,
        isSup,
        sDept
      );
      localStorage.removeItem(storageKey);

      if (
        currentFormData.evaluatorKey === evalKey &&
        currentFormData.company === summaryCompany &&
        currentFormData.year === summaryYear
      ) {
        onResetForm();
      }

      await loadAllSubmissions();
      setConfirmResetPersonAll(false);
      showActionNotice(
        `✅ ล้างคะแนนทั้งหมดของ "${targetName}" เรียบร้อยแล้ว (กลับเป็นค่าเริ่มต้น)`
      );
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการล้างคะแนน');
    }
  };

  const handleClearAllSystemSubmissions = async () => {
    const confirmation = prompt(
      '🚨 คำเตือนความปลอดภัย: คุณกำลังจะล้างข้อมูลผลการประเมินทั้งหมดในระบบกลาง!\n\n(ระบบได้ทำการสำรองข้อมูลฉุกเฉิน Snapshot ให้อัตโนมัติก่อนล้างข้อมูล)\n\nกรุณาพิมพ์ "DELETE" เพื่อยืนยันการล้างข้อมูลทั้งระบบ:'
    );
    if (confirmation !== 'DELETE') {
      showActionNotice('ยกเลิกการล้างข้อมูลระบบ (ไม่ตรงกับคำยืนยัน)');
      return;
    }
    try {
      await fetch('/api/submissions/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'เลขานุการบริษัท (Master Clear)' }),
      });
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('clg_eval_')) {
          localStorage.removeItem(k);
        }
      }
      setAllSubmissions([]);
      onResetForm();
      setConfirmResetSystemAll(false);
      await loadBackups();
      await loadAuditLogs();
      showActionNotice('✅ ล้างข้อมูลทั้งระบบเรียบร้อยแล้ว (ระบบได้บันทึก Snapshot สำรองไว้แล้ว สามารถกู้คืนได้ทุกเวลาในแท็บ 9)');
    } catch (e) {
      console.error(e);
      showActionNotice('❌ เกิดข้อผิดพลาดในการล้างข้อมูลระบบ');
    }
  };

  // Filter directors applicable for selected company in summary
  const evaluatorsForCompany = useMemo(() => {
    return localDirectors.filter((d) => {
      const perm = localPermissions[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key];
      if (summaryCompany === 'CLC') {
        return perm?.clc?.canEvaluateBoard || perm?.clc?.canEvaluateDirectors;
      }
      return perm?.clfg?.canEvaluateBoard || perm?.clfg?.canEvaluateDirectors;
    });
  }, [localDirectors, localPermissions, summaryCompany]);

  // Evaluator submissions for selected company and year
  const submissionsForCompany = useMemo(() => {
    return allSubmissions.filter((s) => s.company === summaryCompany && s.year === summaryYear);
  }, [allSubmissions, summaryCompany, summaryYear]);

  // ----------------------------------------------------
  // Detailed Scores Matrix: Section 1 (Board) Breakdown
  // ----------------------------------------------------
  const boardDetailedMatrix = useMemo(() => {
    const items = localQuestions.section1;

    const rows = items.map((q) => {
      let qSum = 0;
      let qCount = 0;

      const evalScores = evaluatorsForCompany.map((ev) => {
        const sub = submissionsForCompany.find((s) => s.evaluatorKey === ev.key && !s.isSupervisorMode);
        const scoreVal = sub?.section1?.[q.id];
        if (typeof scoreVal === 'number') {
          qSum += scoreVal;
          qCount++;
        }
        return {
          evaluatorKey: ev.key,
          score: scoreVal !== undefined && scoreVal !== null ? scoreVal : '-',
        };
      });

      const avg = qCount > 0 ? Number((qSum / qCount).toFixed(2)) : null;

      return {
        id: q.id,
        code: q.code,
        title: q.title,
        evalScores,
        avg,
      };
    });

    // Compute average for each evaluator across all questions
    const evaluatorOverallAverages = evaluatorsForCompany.map((ev) => {
      const sub = submissionsForCompany.find((s) => s.evaluatorKey === ev.key && !s.isSupervisorMode);
      let sSum = 0;
      let sCount = 0;
      if (sub?.section1) {
        Object.values(sub.section1).forEach((val) => {
          if (typeof val === 'number') {
            sSum += val;
            sCount++;
          }
        });
      }
      const avg = sCount > 0 ? Number((sSum / sCount).toFixed(2)) : null;
      const grade = getGradeForDirectorAvg(avg);
      return {
        evaluatorKey: ev.key,
        name: ev.name,
        avg,
        grade,
      };
    });

    // Grand board average
    let totalValidAvgSum = 0;
    let totalValidAvgCount = 0;
    rows.forEach((r) => {
      if (r.avg !== null) {
        totalValidAvgSum += r.avg;
        totalValidAvgCount++;
      }
    });

    const grandBoardAvg = totalValidAvgCount > 0 ? Number((totalValidAvgSum / totalValidAvgCount).toFixed(2)) : null;
    const grandBoardGrade = getGradeForDirectorAvg(grandBoardAvg);

    return {
      rows,
      evaluatorOverallAverages,
      grandBoardAvg,
      grandBoardGrade,
    };
  }, [localQuestions.section1, evaluatorsForCompany, submissionsForCompany]);

  // ----------------------------------------------------
  // Section 2: Director Cross-Evaluation Summary Matrix
  // ----------------------------------------------------
  const directorCrossMatrix = useMemo(() => {
    return localDirectors.map((targetDir) => {
      let targetSum = 0;
      let targetCount = 0;

      const receivedScores = evaluatorsForCompany.map((ev) => {
        const sub = submissionsForCompany.find((s) => s.evaluatorKey === ev.key && !s.isSupervisorMode);
        const dirScores = sub?.section2?.[targetDir.key];
        let evSum = 0;
        let evCount = 0;

        if (dirScores && typeof dirScores === 'object') {
          Object.values(dirScores).forEach((v) => {
            if (typeof v === 'number') {
              evSum += v;
              evCount++;
            }
          });
        }

        const avg = evCount > 0 ? Number((evSum / evCount).toFixed(2)) : null;
        if (avg !== null) {
          targetSum += avg;
          targetCount++;
        }

        return {
          evaluatorKey: ev.key,
          avg: avg !== null ? avg.toFixed(2) : '-',
        };
      });

      const overallAvg = targetCount > 0 ? Number((targetSum / targetCount).toFixed(2)) : null;
      const grade = getGradeForDirectorAvg(overallAvg);

      return {
        targetDir,
        receivedScores,
        overallAvg,
        grade,
      };
    });
  }, [localDirectors, evaluatorsForCompany, submissionsForCompany]);

  // Detail breakdown for selected target director in Section 2
  const activeTargetDirectorKey = selectedTargetDirectorKey || localDirectors[0]?.key;
  const activeTargetDirectorObj = localDirectors.find((d) => d.key === activeTargetDirectorKey) || localDirectors[0];

  const targetDirectorDetailedRows = useMemo(() => {
    if (!activeTargetDirectorKey) return [];
    return localQuestions.section2.map((q) => {
      let qSum = 0;
      let qCount = 0;

      const evalScores = evaluatorsForCompany.map((ev) => {
        const sub = submissionsForCompany.find((s) => s.evaluatorKey === ev.key && !s.isSupervisorMode);
        const scoreVal = sub?.section2?.[activeTargetDirectorKey]?.[q.id];
        if (typeof scoreVal === 'number') {
          qSum += scoreVal;
          qCount++;
        }
        return {
          evaluatorKey: ev.key,
          score: scoreVal !== undefined && scoreVal !== null ? scoreVal : '-',
        };
      });

      const avg = qCount > 0 ? Number((qSum / qCount).toFixed(2)) : null;

      return {
        id: q.id,
        code: q.code,
        title: q.title,
        evalScores,
        avg,
      };
    });
  }, [activeTargetDirectorKey, localQuestions.section2, evaluatorsForCompany, submissionsForCompany]);

  // ----------------------------------------------------
  // Detailed Scores Matrix: Section 3 (MD) Breakdown
  // ----------------------------------------------------
  const mdDetailedMatrix = useMemo(() => {
    const items = localQuestions.section3;
    const evaluatorsExcludingMD = evaluatorsForCompany.filter((d) => !d.isMD);

    const rows = items.map((q) => {
      let qSum = 0;
      let qCount = 0;

      const evalScores = evaluatorsExcludingMD.map((ev) => {
        const sub = submissionsForCompany.find((s) => s.evaluatorKey === ev.key && !s.isSupervisorMode);
        const scoreVal = sub?.section3?.[q.id];
        if (typeof scoreVal === 'number') {
          qSum += scoreVal;
          qCount++;
        }
        return {
          evaluatorKey: ev.key,
          score: scoreVal !== undefined && scoreVal !== null ? scoreVal : '-',
        };
      });

      const avg = qCount > 0 ? Number((qSum / qCount).toFixed(2)) : null;

      return {
        id: q.id,
        code: q.code,
        category: q.category,
        title: q.title,
        evalScores,
        avg,
      };
    });

    // Compute average for each evaluator for MD
    const evaluatorOverallAverages = evaluatorsExcludingMD.map((ev) => {
      const sub = submissionsForCompany.find((s) => s.evaluatorKey === ev.key && !s.isSupervisorMode);
      let sSum = 0;
      let sCount = 0;
      if (sub?.section3) {
        Object.values(sub.section3).forEach((val) => {
          if (typeof val === 'number') {
            sSum += val;
            sCount++;
          }
        });
      }
      const avg = sCount > 0 ? Number((sSum / sCount).toFixed(2)) : null;
      const grade = getGradeForDirectorAvg(avg);
      return {
        evaluatorKey: ev.key,
        name: ev.name,
        avg,
        grade,
      };
    });

    let totalValidAvgSum = 0;
    let totalValidAvgCount = 0;
    rows.forEach((r) => {
      if (r.avg !== null) {
        totalValidAvgSum += r.avg;
        totalValidAvgCount++;
      }
    });

    const grandMDAvg = totalValidAvgCount > 0 ? Number((totalValidAvgSum / totalValidAvgCount).toFixed(2)) : null;
    const grandMDGrade = getGradeForDirectorAvg(grandMDAvg);

    return {
      rows,
      evaluatorOverallAverages,
      grandMDAvg,
      grandMDGrade,
      evaluatorsExcludingMD,
    };
  }, [localQuestions.section3, evaluatorsForCompany, submissionsForCompany]);

  // ----------------------------------------------------
  // Staff Google Sheets Replica Table (CLC Only)
  // ----------------------------------------------------
  const staffEvaluatorsForDept = useMemo(() => {
    return localDirectors.filter((d) => {
      const p = localPermissions[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key];
      if (selectedSheetDept === 'CU') return p?.clc?.canEvaluateCU;
      if (selectedSheetDept === 'IA') return p?.clc?.canEvaluateIA;
      if (selectedSheetDept === 'RISK') return p?.clc?.canEvaluateRISK;
      return false;
    });
  }, [localDirectors, localPermissions, selectedSheetDept]);

  const staffQuestionRows = useMemo(() => {
    return localQuestions.section4.map((q) => {
      let qTotalSum = 0;
      let qEvaluatorCount = 0;

      const evaluatorScores = staffEvaluatorsForDept.map((ev) => {
        const sub = allSubmissions.find(
          (s) =>
            s.company === 'CLC' &&
            ((!s.isSupervisorMode && s.evaluatorKey === ev.key) ||
              (s.isSupervisorMode && s.supervisorDept === selectedSheetDept && s.evaluatorKey === ev.key))
        );
        const scoreVal = sub?.section4?.[selectedSheetDept]?.[q.id];
        if (typeof scoreVal === 'number') {
          qTotalSum += scoreVal;
          qEvaluatorCount++;
        }
        return {
          evaluatorKey: ev.key,
          score: scoreVal !== undefined && scoreVal !== null ? scoreVal : '-',
        };
      });

      const avg = qEvaluatorCount > 0 ? Number((qTotalSum / qEvaluatorCount).toFixed(2)) : null;

      return {
        id: q.id,
        code: q.code,
        title: q.title,
        evaluatorScores,
        totalScore: qTotalSum,
        avg,
      };
    });
  }, [localQuestions.section4, staffEvaluatorsForDept, allSubmissions, selectedSheetDept]);

  const staffTotals = useMemo(() => {
    let grandSum = 0;
    staffQuestionRows.forEach((r) => (grandSum += r.totalScore));
    const evaluatorCount = staffEvaluatorsForDept.length;
    const avgScorePerEvaluator = evaluatorCount > 0 ? Number((grandSum / evaluatorCount).toFixed(2)) : 0;
    const scaled100Avg = Math.min(100, Math.round(avgScorePerEvaluator));
    const grade = getGradeForStaffScore(scaled100Avg);

    return {
      grandSum,
      avgScorePerEvaluator,
      scaled100Avg,
      grade,
    };
  }, [staffQuestionRows, staffEvaluatorsForDept]);

  // ----------------------------------------------------
  // Comments Summary per Company
  // ----------------------------------------------------
  const commentsSummary = useMemo(() => {
    const boardComments: { evaluatorName: string; evaluatorTitle?: string; comment: string; date?: string }[] = [];
    const directorComments: { evaluatorName: string; targetDirectorName: string; targetDirectorTitle?: string; comment: string; date?: string }[] = [];
    const mdComments: { evaluatorName: string; evaluatorTitle?: string; comment: string; date?: string }[] = [];
    const staffComments: { evaluatorName: string; deptId: string; supervisorName?: string; comment: string; date?: string }[] = [];

    submissionsForCompany.forEach((sub) => {
      const evalName = sub.evaluatorName || localDirectors.find((d) => d.key === sub.evaluatorKey)?.name || sub.evaluatorKey;
      const evalTitle = localDirectors.find((d) => d.key === sub.evaluatorKey)?.title || '';

      if (sub.section1Comment && typeof sub.section1Comment === 'string' && sub.section1Comment.trim()) {
        boardComments.push({
          evaluatorName: evalName,
          evaluatorTitle: evalTitle,
          comment: sub.section1Comment.trim(),
          date: sub.submittedAt || sub.lastSavedAt,
        });
      }

      if (sub.section2Comments && typeof sub.section2Comments === 'object') {
        Object.entries(sub.section2Comments).forEach(([targetKey, comm]) => {
          if (typeof comm === 'string' && comm.trim()) {
            const targetDir = localDirectors.find((d) => d.key === targetKey);
            directorComments.push({
              evaluatorName: evalName,
              targetDirectorName: targetDir?.name || targetKey,
              targetDirectorTitle: targetDir?.title || '',
              comment: comm.trim(),
              date: sub.submittedAt || sub.lastSavedAt,
            });
          }
        });
      }

      if (sub.section3Comment && typeof sub.section3Comment === 'string' && sub.section3Comment.trim()) {
        mdComments.push({
          evaluatorName: evalName,
          evaluatorTitle: evalTitle,
          comment: sub.section3Comment.trim(),
          date: sub.submittedAt || sub.lastSavedAt,
        });
      }

      if (sub.section4Comments && typeof sub.section4Comments === 'object') {
        Object.entries(sub.section4Comments).forEach(([deptId, comm]) => {
          if (typeof comm === 'string' && comm.trim()) {
            staffComments.push({
              evaluatorName: evalName,
              deptId,
              supervisorName: sub.supervisorName || undefined,
              comment: comm.trim(),
              date: sub.submittedAt || sub.lastSavedAt,
            });
          }
        });
      }
    });

    const totalCount = boardComments.length + directorComments.length + mdComments.length + staffComments.length;

    return {
      boardComments,
      directorComments,
      mdComments,
      staffComments,
      totalCount,
    };
  }, [submissionsForCompany, localDirectors]);

  const handleCopyLink = (key: string, url: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedLinkKey(key);
      setTimeout(() => setCopiedLinkKey(null), 2000);
    } catch (e) {
      console.warn('Could not copy link to clipboard:', e);
    }
  };

  const handleExportSummaryExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Board Detailed
    const boardData = [
      ['สรุปผลการประเมินคณะกรรมการทั้งชุด (Board Evaluation) ประจำปี พ.ศ. ' + summaryYear],
      ['บริษัท: ' + summaryCompany],
      [],
      ['ข้อ', 'หัวข้อการประเมิน', ...evaluatorsForCompany.map((e) => e.name), 'คะแนนเฉลี่ย'],
      ...boardDetailedMatrix.rows.map((r) => [
        r.code,
        r.title,
        ...r.evalScores.map((s) => s.score),
        r.avg !== null ? r.avg : '-',
      ]),
      [
        'คะแนนเฉลี่ยที่กรรมการแต่ละท่านให้ (เต็ม 4.00)',
        '',
        ...boardDetailedMatrix.evaluatorOverallAverages.map((e) => (e.avg !== null ? e.avg : '-')),
        boardDetailedMatrix.grandBoardAvg !== null ? boardDetailedMatrix.grandBoardAvg : '-',
      ],
      [
        'ระดับเกรดที่กรรมการแต่ละท่านตัดให้',
        '',
        ...boardDetailedMatrix.evaluatorOverallAverages.map((e) => e.grade),
        boardDetailedMatrix.grandBoardGrade,
      ],
    ];
    const wsBoard = XLSX.utils.aoa_to_sheet(boardData);
    XLSX.utils.book_append_sheet(wb, wsBoard, 'สรุปบอร์ดทั้งชุด');

    // Sheet 2: Director Cross-Evaluation
    const dirData = [
      ['สรุปผลการประเมินกรรมการรายบุคคล (Director Cross-Evaluation) ประจำปี พ.ศ. ' + summaryYear],
      ['บริษัท: ' + summaryCompany],
      [],
      ['ลำดับ', 'กรรมการผู้ถูกประเมิน', ...evaluatorsForCompany.map((e) => 'โดย ' + e.name), 'คะแนนเฉลี่ยที่ได้รับ', 'เกรด'],
      ...directorCrossMatrix.map((item, idx) => [
        idx + 1,
        item.targetDir.name + ' (' + item.targetDir.title + ')',
        ...item.receivedScores.map((s) => s.avg),
        item.overallAvg !== null ? item.overallAvg : '-',
        item.grade,
      ]),
    ];
    const wsDir = XLSX.utils.aoa_to_sheet(dirData);
    XLSX.utils.book_append_sheet(wb, wsDir, 'สรุปรายบุคคล');

    // Sheet 3: MD Detailed
    const mdData = [
      ['สรุปผลการประเมินผู้จัดการใหญ่ (MD) ประจำปี พ.ศ. ' + summaryYear],
      ['บริษัท: ' + summaryCompany],
      ['ผู้ถูกประเมิน: นายเกรียงไกร ศิระวณิชการ (กรรมการ / ผู้จัดการใหญ่)'],
      [],
      ['ข้อ', 'หมวด', 'หัวข้อการประเมิน', ...mdDetailedMatrix.evaluatorsExcludingMD.map((e) => e.name), 'คะแนนเฉลี่ย'],
      ...mdDetailedMatrix.rows.map((r) => [
        r.code,
        r.category || '-',
        r.title,
        ...r.evalScores.map((s) => s.score),
        r.avg !== null ? r.avg : '-',
      ]),
      [
        'คะแนนเฉลี่ยที่กรรมการแต่ละท่านให้ MD (เต็ม 4.00)',
        '',
        '',
        ...mdDetailedMatrix.evaluatorOverallAverages.map((e) => (e.avg !== null ? e.avg : '-')),
        mdDetailedMatrix.grandMDAvg !== null ? mdDetailedMatrix.grandMDAvg : '-',
      ],
      [
        'ระดับเกรดที่กรรมการแต่ละท่านตัดให้',
        '',
        '',
        ...mdDetailedMatrix.evaluatorOverallAverages.map((e) => e.grade),
        mdDetailedMatrix.grandMDGrade,
      ],
    ];
    const wsMD = XLSX.utils.aoa_to_sheet(mdData);
    XLSX.utils.book_append_sheet(wb, wsMD, 'สรุปผู้จัดการใหญ่ (MD)');

    // Sheet 4: Director Comments
    const commentsData = [
      ['สรุปความคิดเห็นและข้อเสนอแนะเพิ่มเติม ประจำปี พ.ศ. ' + summaryYear],
      ['บริษัท: ' + summaryCompany],
      [],
      ['ลำดับ', 'หมวดแบบประเมิน', 'ผู้ประเมิน / กรรมการ', 'ผู้ถูกประเมิน / สายงาน', 'ข้อคิดเห็นและข้อเสนอแนะ', 'วันที่ส่งผล'],
      ...commentsSummary.boardComments.map((c, i) => [
        i + 1,
        '1. คณะกรรมการทั้งชุด',
        c.evaluatorName + (c.evaluatorTitle ? ` (${c.evaluatorTitle})` : ''),
        'คณะกรรมการบริษัททั้งชุด',
        c.comment,
        c.date ? new Date(c.date).toLocaleString('th-TH') : '-',
      ]),
      ...commentsSummary.directorComments.map((c, i) => [
        commentsSummary.boardComments.length + i + 1,
        '2. กรรมการรายบุคคล',
        c.evaluatorName,
        c.targetDirectorName,
        c.comment,
        c.date ? new Date(c.date).toLocaleString('th-TH') : '-',
      ]),
      ...commentsSummary.mdComments.map((c, i) => [
        commentsSummary.boardComments.length + commentsSummary.directorComments.length + i + 1,
        '3. ผู้จัดการใหญ่ (MD)',
        c.evaluatorName,
        'นายเกรียงไกร ศิระวณิชการ (MD)',
        c.comment,
        c.date ? new Date(c.date).toLocaleString('th-TH') : '-',
      ]),
      ...commentsSummary.staffComments.map((c, i) => [
        commentsSummary.boardComments.length + commentsSummary.directorComments.length + commentsSummary.mdComments.length + i + 1,
        '4. พนักงานสายงานกำกับ (HR-58)',
        c.supervisorName ? `${c.supervisorName} (ปฏิบัติการแทน ${c.evaluatorName})` : c.evaluatorName,
        `สายงาน ${c.deptId}`,
        c.comment,
        c.date ? new Date(c.date).toLocaleString('th-TH') : '-',
      ]),
    ];
    const wsComments = XLSX.utils.aoa_to_sheet(commentsData);
    XLSX.utils.book_append_sheet(wb, wsComments, 'ความคิดเห็นและข้อเสนอแนะ');

    XLSX.writeFile(wb, `สรุปผลคะแนนและความเห็น_${summaryCompany}_ปี${summaryYear}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-amber-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-800/60 text-amber-200 border border-amber-700/50 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                ระบบจัดการฝ่ายเลขานุการบริษัท (Corporate Secretary Portal)
              </h3>
              <p className="text-xs text-amber-200/80">
                สรุปคะแนนตัดเกรด, สร้างลิงก์ส่งต่อกรรมการ/หัวหน้างาน, กำหนดสิทธิ์แยก CLC & CLFG
              </p>
            </div>
          </div>
          {/* Top Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="ปิดหน้าต่างแอดมิน (ESC)"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* PIN Form if not authorized */}
        {!isAuthorized ? (
          <div className="p-6 overflow-y-auto">
            <form onSubmit={handleVerifyPin} className="space-y-4 max-w-md mx-auto py-10">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">เข้าสู่ระบบสำหรับฝ่ายเลขานุการ</h4>
                <p className="text-xs text-slate-500 mt-1">
                  กรุณากรอกรหัส PIN ฝ่ายเลขานุการบริษัท เพื่อเข้าถึงข้อมูลคะแนนและจัดการสิทธิ์
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รหัสผ่าน PIN ฝ่ายเลขาฯ (Security PIN)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setPinError(false);
                    }}
                    placeholder="กรุณากรอกรหัส PIN ฝ่ายเลขานุการ"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono tracking-widest ${
                      pinError
                        ? 'border-rose-500 ring-2 ring-rose-200 focus:outline-hidden'
                        : 'border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden'
                    }`}
                  />
                </div>
                {pinError && (
                  <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    รหัส PIN ไม่ถูกต้อง โปรดติดต่อฝ่ายเลขานุการบริษัท
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง / ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  ยืนยันรหัส PIN
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation Tabs */}
            <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 pt-3 flex items-center gap-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('boardDirectorSummary')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'boardDirectorSummary'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-800" />
                <span>1. สรุปคะแนน & ตัดเกรดกรรมการ (แยกบริษัท)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sheetSummary')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'sheetSummary'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-amber-800" />
                <span>2. สรุปพนักงาน (Google Sheets - CLC)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('permissions')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'permissions'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-800" />
                <span>3. ตารางสิทธิกรรมการ (แยก CLC / CLFG ชัดเจน)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('links')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'links'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Share2 className="w-3.5 h-3.5 text-amber-800" />
                <span>4. สร้างลิงก์ส่งต่อ (กรรมการ & หัวหน้างาน)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('directors')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'directors'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-800" />
                <span>5. รายชื่อกรรมการ</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'questions'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-800" />
                <span>6. หัวข้อการประเมิน</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('yearsAndSystem')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'yearsAndSystem'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-800" />
                <span>7. จัดการปีประเมิน</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('submissionsManagement')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'submissionsManagement'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Unlock className="w-3.5 h-3.5 text-amber-800" />
                <span>8. ปลดล็อก & จัดการข้อมูลกรรมการ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('backups');
                  loadBackups();
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'backups'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-amber-800" />
                <span>9. สำรอง & กู้คืนข้อมูล (Backup & Restore)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('auditLogs');
                  loadAuditLogs();
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'auditLogs'
                    ? 'bg-white border-slate-200 text-amber-950 -mb-px'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-800" />
                <span>10. ประวัติบันทึกระบบ (Audit Logs)</span>
              </button>
            </div>

            {/* TAB 1: Detailed Scores Matrix (Board & Directors Breakdown by Evaluator & Company) */}
            {activeTab === 'boardDirectorSummary' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Company & Year & Dimension Selectors */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">เลือกบริษัท:</span>
                      <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setSummaryCompany('CLC')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            summaryCompany === 'CLC' ? 'bg-amber-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          🏢 CLC (เครดิตฟองซิเอร์)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSummaryCompany('CLFG')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            summaryCompany === 'CLFG' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          🏛️ CLFG (ไฟแนนเชียล กรุ๊ป)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">เลือกปีประเมิน:</span>
                      <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-300">
                        {managedYears.map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => setSummaryYear(y)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                              summaryYear === y
                                ? 'bg-amber-900 text-white shadow-xs'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            พ.ศ. {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs">
                      <button
                        type="button"
                        onClick={() => setSummarySection('board')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          summarySection === 'board' ? 'bg-amber-900 text-white' : 'text-slate-700'
                        }`}
                      >
                        1. บอร์ดทั้งชุด (27 ข้อ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummarySection('directors')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          summarySection === 'directors' ? 'bg-amber-900 text-white' : 'text-slate-700'
                        }`}
                      >
                        2. กรรมการรายบุคคล (11 ข้อ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummarySection('md')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          summarySection === 'md' ? 'bg-amber-900 text-white' : 'text-slate-700'
                        }`}
                      >
                        3. ผู้จัดการใหญ่ (MD 45 ข้อ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummarySection('comments')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          summarySection === 'comments' ? 'bg-amber-900 text-white shadow-xs' : 'text-slate-700 hover:text-amber-900'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>4. ข้อคิดเห็น & ข้อเสนอแนะ ({commentsSummary.totalCount})</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleExportSummaryExcel}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* Submissions count badge & Sync */}
                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      ข้อมูลผลการประเมินบริษัท {summaryCompany}: ได้รับผลแล้ว <strong>{submissionsForCompany.length}</strong> ท่าน
                    </span>
                    {lastRefreshedAt && (
                      <span className="text-[11px] text-slate-500">(อัปเดตล่าสุด: {lastRefreshedAt})</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={loadAllSubmissions}
                    className="text-xs font-bold text-amber-900 hover:text-amber-950 hover:underline cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>รีเฟรชคะแนนล่าสุด</span>
                  </button>
                </div>

                {/* SECTION 1: Board Detailed Matrix */}
                {summarySection === 'board' && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                          <tr>
                            <th className="p-2.5 border-r border-slate-200 text-center w-12">ข้อ</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[260px]">หัวข้อการประเมิน (คณะกรรมการทั้งชุด 27 ข้อ)</th>
                            {evaluatorsForCompany.map((ev) => (
                              <th key={ev.key} className="p-2 border-r border-slate-200 text-center min-w-[100px] bg-amber-50/50">
                                <div className="truncate max-w-[110px]" title={ev.name}>
                                  {ev.name.replace('นางสาว', '').replace('นาย', '').replace('นาง', '')}
                                </div>
                              </th>
                            ))}
                            <th className="p-2.5 text-center bg-amber-100/80 font-extrabold text-amber-950 min-w-[90px]">
                              คะแนนเฉลี่ย
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {boardDetailedMatrix.rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-100">{row.code}</td>
                              <td className="p-2 font-medium text-slate-800 border-r border-slate-100">{row.title}</td>
                              {row.evalScores.map((s, idx) => (
                                <td key={idx} className="p-2 text-center font-bold border-r border-slate-100 text-amber-950">
                                  {s.score}
                                </td>
                              ))}
                              <td className="p-2 text-center font-extrabold text-amber-900 bg-amber-50/40">
                                {row.avg !== null ? row.avg.toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-950 text-white font-bold border-t-2 border-amber-800">
                          {/* Row 1: Average per Evaluator */}
                          <tr>
                            <td colSpan={2} className="p-2.5 text-right pr-3 font-bold text-amber-200">
                              คะแนนเฉลี่ยที่กรรมการแต่ละท่านให้ (เต็ม 4.00):
                            </td>
                            {boardDetailedMatrix.evaluatorOverallAverages.map((ev) => (
                              <td key={ev.evaluatorKey} className="p-2 text-center font-black text-amber-300 text-sm border-r border-amber-900">
                                {ev.avg !== null ? ev.avg.toFixed(2) : '-'}
                              </td>
                            ))}
                            <td className="p-2.5 text-center font-black text-amber-200 text-base bg-amber-900">
                              {boardDetailedMatrix.grandBoardAvg !== null ? boardDetailedMatrix.grandBoardAvg.toFixed(2) : '-'}
                            </td>
                          </tr>
                          {/* Row 2: Cutoff Grade per Evaluator */}
                          <tr className="bg-amber-900 text-white text-[11px] border-t border-amber-800">
                            <td colSpan={2} className="p-2.5 text-right pr-3 font-bold text-amber-100">
                              ระดับเกรดที่กรรมการแต่ละท่านตัดให้:
                            </td>
                            {boardDetailedMatrix.evaluatorOverallAverages.map((ev) => (
                              <td key={ev.evaluatorKey} className="p-2 text-center font-bold text-amber-200 border-r border-amber-800">
                                {ev.grade}
                              </td>
                            ))}
                            <td className="p-2.5 text-center font-black text-white bg-amber-800 text-xs">
                              เกรดเฉลี่ย: {boardDetailedMatrix.grandBoardGrade}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Board Comments Preview */}
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                          <MessageSquare className="w-4 h-4 text-amber-800" />
                          <span>
                            ความคิดเห็นและข้อเสนอแนะสำหรับการปฏิบัติงานของคณะกรรมการทั้งชุด ({commentsSummary.boardComments.length} ท่านระบุความเห็น)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSummarySection('comments')}
                          className="text-[11px] text-amber-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>ดูความคิดเห็นทุกหมวด ({commentsSummary.totalCount})</span>
                          <span>→</span>
                        </button>
                      </div>
                      {commentsSummary.boardComments.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-3 bg-white/80 rounded-lg border border-dashed border-slate-300 text-center">
                          ยังไม่มีกรรมการท่านใดระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติมในส่วนคณะกรรมการทั้งชุดของบริษัท {summaryCompany}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {commentsSummary.boardComments.map((c, idx) => (
                            <div key={idx} className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                  <span>{c.evaluatorName}</span>
                                  {c.evaluatorTitle && (
                                    <span className="text-[10px] text-slate-500 font-normal">({c.evaluatorTitle})</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {c.date ? new Date(c.date).toLocaleDateString('th-TH') : ''}
                                </span>
                              </div>
                              <p className="text-slate-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60 italic leading-relaxed">
                                "{c.comment}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 2: Director Cross-Evaluation Matrix & Detail Breakdown */}
                {summarySection === 'directors' && (
                  <div className="space-y-6">
                    {/* Part A: Cross Matrix Overview */}
                    <div>
                      <div className="mb-2">
                        <h5 className="font-bold text-xs text-slate-800">
                          ตารางสรุปคะแนนเฉลี่ยและการตัดเกรด กรรมการรายบุคคล (Cross-Evaluation Overview)
                        </h5>
                      </div>
                      <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                            <tr>
                              <th className="p-2.5 border-r border-slate-200 text-center w-12">ลำดับ</th>
                              <th className="p-2.5 border-r border-slate-200 min-w-[200px]">กรรมการผู้ถูกประเมิน</th>
                              {evaluatorsForCompany.map((ev) => (
                                <th key={ev.key} className="p-2 border-r border-slate-200 text-center min-w-[100px] bg-amber-50/50">
                                  <div className="truncate max-w-[110px]" title={ev.name}>
                                    โดย {ev.name.replace('นางสาว', '').replace('นาย', '').replace('นาง', '')}
                                  </div>
                                </th>
                              ))}
                              <th className="p-2.5 text-center bg-amber-100/80 font-extrabold text-amber-950 min-w-[100px]">
                                คะแนนเฉลี่ยที่ได้รับ
                              </th>
                              <th className="p-2.5 text-center bg-amber-200/80 font-extrabold text-amber-950 min-w-[100px]">
                                เกรดรายบุคคล
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {directorCrossMatrix.map((item, idx) => (
                              <tr key={item.targetDir.key} className="hover:bg-slate-50">
                                <td className="p-2.5 text-center font-bold text-slate-400 border-r border-slate-100">{idx + 1}</td>
                                <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">
                                  <div>{item.targetDir.name}</div>
                                  <div className="text-[10px] text-slate-500 font-normal">{item.targetDir.title}</div>
                                </td>
                                {item.receivedScores.map((s, i) => (
                                  <td key={i} className="p-2.5 text-center font-bold text-slate-800 border-r border-slate-100">
                                    {s.avg}
                                  </td>
                                ))}
                                <td className="p-2.5 text-center font-black text-amber-950 bg-amber-50/50 text-sm">
                                  {item.overallAvg !== null ? item.overallAvg.toFixed(2) : '-'}
                                </td>
                                <td className="p-2.5 text-center font-bold">
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] ${getGradeBadgeStyle(item.grade).bg}`}>
                                    {item.grade}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Part B: Detail Breakdown by Target Director */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-amber-800" />
                          <span className="text-xs font-bold text-slate-900">
                            เจาะลึกคะแนนรายข้อ (11 ข้อ) ของกรรมการรายบุคคล:
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">เลือกกรรมการ:</span>
                          <select
                            value={activeTargetDirectorKey}
                            onChange={(e) => setSelectedTargetDirectorKey(e.target.value)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          >
                            {localDirectors.map((d) => (
                              <option key={d.key} value={d.key}>
                                {d.name} ({d.title})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white shadow-2xs">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                            <tr>
                              <th className="p-2 text-center w-12 border-r border-slate-200">ข้อ</th>
                              <th className="p-2 border-r border-slate-200 min-w-[240px]">หัวข้อการประเมิน (สำหรับ {activeTargetDirectorObj?.name})</th>
                              {evaluatorsForCompany.map((ev) => (
                                <th key={ev.key} className="p-2 text-center border-r border-slate-200 min-w-[90px]">
                                  {ev.name.replace('นางสาว', '').replace('นาย', '').replace('นาง', '')}
                                </th>
                              ))}
                              <th className="p-2 text-center bg-amber-100 text-amber-950 font-bold min-w-[80px]">
                                เฉลี่ย
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {targetDirectorDetailedRows.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50">
                                <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-100">{r.code}</td>
                                <td className="p-2 text-slate-800 border-r border-slate-100">{r.title}</td>
                                {r.evalScores.map((s, i) => (
                                  <td key={i} className="p-2 text-center font-bold text-slate-800 border-r border-slate-100">
                                    {s.score}
                                  </td>
                                ))}
                                <td className="p-2 text-center font-black text-amber-900 bg-amber-50/40">
                                  {r.avg !== null ? r.avg.toFixed(2) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Director Comments Preview */}
                    <div className="bg-stone-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                          <MessageSquare className="w-4 h-4 text-amber-800" />
                          <span>
                            ความคิดเห็นและข้อเสนอแนะต่อกรรมการรายบุคคล ({commentsSummary.directorComments.length} ข้อคิดเห็น)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSummarySection('comments')}
                          className="text-[11px] text-amber-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>ดูความคิดเห็นทุกหมวด ({commentsSummary.totalCount})</span>
                          <span>→</span>
                        </button>
                      </div>
                      {commentsSummary.directorComments.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-3 bg-white/80 rounded-lg border border-dashed border-slate-300 text-center">
                          ยังไม่มีกรรมการท่านใดระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติมสำหรับกรรมการรายบุคคลในบริษัท {summaryCompany}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {commentsSummary.directorComments.map((c, idx) => (
                            <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="text-slate-700">
                                  โดย <strong className="text-slate-900">{c.evaluatorName}</strong> ถึง{' '}
                                  <strong className="text-amber-950 font-bold">{c.targetDirectorName}</strong>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {c.date ? new Date(c.date).toLocaleDateString('th-TH') : ''}
                                </span>
                              </div>
                              <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 italic leading-relaxed">
                                "{c.comment}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 3: MD Detailed Matrix */}
                {summarySection === 'md' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                      <span>
                        ผู้ถูกประเมิน: <strong>นายเกรียงไกร ศิระวณิชการ</strong> (กรรมการ / ผู้จัดการใหญ่) | ทั้งหมด 45 ข้อ 9 หมวด
                      </span>
                      <span>กรรมการประเมินทั้งหมด {mdDetailedMatrix.evaluatorsExcludingMD.length} ท่าน (ตัด MD ออก)</span>
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                          <tr>
                            <th className="p-2.5 border-r border-slate-200 text-center w-12">ข้อ</th>
                            <th className="p-2.5 border-r border-slate-200 min-w-[260px]">หัวข้อการประเมินผู้จัดการใหญ่ (MD)</th>
                            {mdDetailedMatrix.evaluatorsExcludingMD.map((ev) => (
                              <th key={ev.key} className="p-2 border-r border-slate-200 text-center min-w-[100px] bg-amber-50/50">
                                <div className="truncate max-w-[110px]" title={ev.name}>
                                  {ev.name.replace('นางสาว', '').replace('นาย', '').replace('นาง', '')}
                                </div>
                              </th>
                            ))}
                            <th className="p-2.5 text-center bg-amber-100/80 font-extrabold text-amber-950 min-w-[90px]">
                              คะแนนเฉลี่ย
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mdDetailedMatrix.rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-100">{row.code}</td>
                              <td className="p-2 text-slate-800 border-r border-slate-100">
                                <div className="font-medium">{row.title}</div>
                                {row.category && <div className="text-[10px] text-slate-400">{row.category}</div>}
                              </td>
                              {row.evalScores.map((s, idx) => (
                                <td key={idx} className="p-2 text-center font-bold border-r border-slate-100 text-amber-950">
                                  {s.score}
                                </td>
                              ))}
                              <td className="p-2 text-center font-extrabold text-amber-900 bg-amber-50/40">
                                {row.avg !== null ? row.avg.toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-950 text-white font-bold border-t-2 border-amber-800">
                          <tr>
                            <td colSpan={2} className="p-2.5 text-right pr-3 font-bold text-amber-200">
                              คะแนนเฉลี่ยที่กรรมการแต่ละท่านให้ MD:
                            </td>
                            {mdDetailedMatrix.evaluatorOverallAverages.map((ev) => (
                              <td key={ev.evaluatorKey} className="p-2 text-center font-black text-amber-300 text-sm border-r border-amber-900">
                                {ev.avg !== null ? ev.avg.toFixed(2) : '-'}
                              </td>
                            ))}
                            <td className="p-2.5 text-center font-black text-amber-200 text-base bg-amber-900">
                              {mdDetailedMatrix.grandMDAvg !== null ? mdDetailedMatrix.grandMDAvg.toFixed(2) : '-'}
                            </td>
                          </tr>
                          <tr className="bg-amber-900 text-white text-[11px] border-t border-amber-800">
                            <td colSpan={2} className="p-2.5 text-right pr-3 font-bold text-amber-100">
                              ระดับเกรดที่กรรมการแต่ละท่านตัดให้:
                            </td>
                            {mdDetailedMatrix.evaluatorOverallAverages.map((ev) => (
                              <td key={ev.evaluatorKey} className="p-2 text-center font-bold text-amber-200 border-r border-amber-800">
                                {ev.grade}
                              </td>
                            ))}
                            <td className="p-2.5 text-center font-black text-white bg-amber-800 text-xs">
                              เกรดรวม MD: {mdDetailedMatrix.grandMDGrade}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* MD Comments Preview */}
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                          <MessageSquare className="w-4 h-4 text-amber-800" />
                          <span>
                            ความคิดเห็นและข้อเสนอแนะต่อผู้จัดการใหญ่ (MD) ({commentsSummary.mdComments.length} ท่านระบุความเห็น)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSummarySection('comments')}
                          className="text-[11px] text-amber-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>ดูความคิดเห็นทุกหมวด ({commentsSummary.totalCount})</span>
                          <span>→</span>
                        </button>
                      </div>
                      {commentsSummary.mdComments.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-3 bg-white/80 rounded-lg border border-dashed border-slate-300 text-center">
                          ยังไม่มีกรรมการท่านใดระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติมสำหรับการปฏิบัติหน้าที่ของผู้จัดการใหญ่
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {commentsSummary.mdComments.map((c, idx) => (
                            <div key={idx} className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-slate-900">{c.evaluatorName}</span>
                                <span className="text-[10px] text-slate-400">
                                  {c.date ? new Date(c.date).toLocaleDateString('th-TH') : ''}
                                </span>
                              </div>
                              <p className="text-slate-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60 italic leading-relaxed">
                                "{c.comment}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 4: Comprehensive Comments & Recommendations Hub */}
                {summarySection === 'comments' && (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white p-5 rounded-2xl border border-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-amber-950 font-black text-[10px] uppercase">
                            Executive Feedback Hub
                          </span>
                          <span className="text-xs text-amber-200">บริษัท {summaryCompany}</span>
                        </div>
                        <h4 className="text-base sm:text-lg font-bold text-white">
                          รวมข้อคิดเห็นและข้อเสนอแนะเชิงบริหาร (Executive Comments & Recommendations)
                        </h4>
                        <p className="text-xs text-amber-100/80 mt-0.5">
                          รวบรวมข้อเสนอแนะทั้งหมดที่กรรมการและผู้ปฏิบัติงานได้ระบุไว้ในแบบประเมินประจำปี เพื่อนำเสนอต่อคณะกรรมการสรรหาฯ และที่ประชุมบอร์ด
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-[11px] text-amber-200/80">ความเห็นทั้งหมด</div>
                          <div className="text-xl font-black text-amber-300">
                            {commentsSummary.totalCount} <span className="text-xs font-normal">รายการ</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportSummaryExcel}
                          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                          <span>ดาวน์โหลด Excel</span>
                        </button>
                      </div>
                    </div>

                    {/* Category 1: Board Comments */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-sm text-slate-900">
                              1. ข้อคิดเห็นต่อคณะกรรมการบริษัททั้งชุด (Board Evaluation)
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              ข้อเสนอแนะด้านโครงสร้าง บทบาทหน้าที่ การจัดประชุม และประสิทธิภาพของบอร์ด
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">
                          {commentsSummary.boardComments.length} ข้อคิดเห็น
                        </span>
                      </div>

                      {commentsSummary.boardComments.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          ยังไม่มีกรรมการท่านใดระบุความคิดเห็นหรือข้อเสนอแนะในส่วนคณะกรรมการทั้งชุด
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                          {commentsSummary.boardComments.map((c, i) => (
                            <div key={i} className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between gap-3 text-xs shadow-2xs">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                                    <span className="font-bold text-slate-900">{c.evaluatorName}</span>
                                    {c.evaluatorTitle && (
                                      <span className="text-[10px] text-slate-500">({c.evaluatorTitle})</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {c.date ? new Date(c.date).toLocaleString('th-TH') : ''}
                                  </span>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-amber-200/80 text-slate-800 leading-relaxed italic">
                                  "{c.comment}"
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(`comm_b_${i}`, c.comment)}
                                  className="text-[10px] font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedLinkKey === `comm_b_${i}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedLinkKey === `comm_b_${i}` ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category 2: Director Individual Comments */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-900">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-sm text-slate-900">
                              2. ข้อคิดเห็นต่อกรรมการรายบุคคล (Director Individual / Cross-Evaluation)
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              ข้อเสนอแนะและการประเมินตนเองหรือเพื่อนกรรมการรายท่าน
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-xs">
                          {commentsSummary.directorComments.length} ข้อคิดเห็น
                        </span>
                      </div>

                      {commentsSummary.directorComments.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          ยังไม่มีกรรมการท่านใดระบุความคิดเห็นหรือข้อเสนอแนะสำหรับกรรมการรายบุคคล
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                          {commentsSummary.directorComments.map((c, i) => (
                            <div key={i} className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 flex flex-col justify-between gap-3 text-xs shadow-2xs">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-slate-500">โดย </span>
                                    <strong className="text-slate-900">{c.evaluatorName}</strong>
                                    <span className="text-slate-500"> ถึง </span>
                                    <strong className="text-blue-950 font-bold">{c.targetDirectorName}</strong>
                                    {c.targetDirectorTitle && (
                                      <span className="text-[10px] text-slate-500"> ({c.targetDirectorTitle})</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {c.date ? new Date(c.date).toLocaleString('th-TH') : ''}
                                  </span>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-blue-200/80 text-slate-800 leading-relaxed italic">
                                  "{c.comment}"
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(`comm_d_${i}`, c.comment)}
                                  className="text-[10px] font-bold text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedLinkKey === `comm_d_${i}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedLinkKey === `comm_d_${i}` ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category 3: MD Comments */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                            <Award className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-sm text-slate-900">
                              3. ข้อคิดเห็นต่อผู้จัดการใหญ่ (Managing Director - MD)
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              ข้อเสนอแนะสำหรับการปฏิบัติงานของ นายเกรียงไกร ศิระวณิชการ ในฐานะผู้จัดการใหญ่
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">
                          {commentsSummary.mdComments.length} ข้อคิดเห็น
                        </span>
                      </div>

                      {commentsSummary.mdComments.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          ยังไม่มีกรรมการท่านใดระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติมสำหรับผู้จัดการใหญ่
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                          {commentsSummary.mdComments.map((c, i) => (
                            <div key={i} className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between gap-3 text-xs shadow-2xs">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                                    <span className="font-bold text-slate-900">{c.evaluatorName}</span>
                                    {c.evaluatorTitle && (
                                      <span className="text-[10px] text-slate-500">({c.evaluatorTitle})</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {c.date ? new Date(c.date).toLocaleString('th-TH') : ''}
                                  </span>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-amber-200/80 text-slate-800 leading-relaxed italic">
                                  "{c.comment}"
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(`comm_m_${i}`, c.comment)}
                                  className="text-[10px] font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedLinkKey === `comm_m_${i}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedLinkKey === `comm_m_${i}` ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category 4: Staff Comments (CLC Only) */}
                    {summaryCompany === 'CLC' && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="font-extrabold text-sm text-slate-900">
                                4. ข้อคิดเห็นต่อพนักงานสายงานกำกับ (CU, IA, RISK - HR-58)
                              </h5>
                              <p className="text-[11px] text-slate-500">
                                ข้อเสนอแนะการปฏิบัติงานของหน่วยงานตรวจสอบและกำกับดูแล
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                            {commentsSummary.staffComments.length} ข้อคิดเห็น
                          </span>
                        </div>

                        {commentsSummary.staffComments.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            ยังไม่มีผู้ประเมินท่านใดระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติมสำหรับพนักงานสายงานกำกับ
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                            {commentsSummary.staffComments.map((c, i) => (
                              <div key={i} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 flex flex-col justify-between gap-3 text-xs shadow-2xs">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-bold text-slate-900">{c.evaluatorName}</span>
                                      {c.supervisorName && (
                                        <span className="text-[10px] text-slate-500"> (ปฏิบัติการแทน: {c.supervisorName})</span>
                                      )}
                                      <span className="ml-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                                        สายงาน {c.deptId}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                      {c.date ? new Date(c.date).toLocaleString('th-TH') : ''}
                                    </span>
                                  </div>
                                  <div className="p-3 bg-white rounded-lg border border-emerald-200/80 text-slate-800 leading-relaxed italic">
                                    "{c.comment}"
                                  </div>
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(`comm_s_${i}`, c.comment)}
                                    className="text-[10px] font-bold text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedLinkKey === `comm_s_${i}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedLinkKey === `comm_s_${i}` ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Staff Google Sheets Replica Table */}
            {activeTab === 'sheetSummary' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                      ตารางสรุปผลพนักงานสายงานกำกับตามไฟล์ Google Sheets (เฉพาะ บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์ - CLC)
                    </h4>
                    <p className="text-xs text-slate-500">
                      รวมคะแนนรายกรรมการผู้ประเมิน คะแนนรวมทั้งหมด และคะแนนเฉลี่ย
                    </p>
                  </div>

                  <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-300">
                    {SUBCOMMITTEE_DEPTS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedSheetDept(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedSheetDept === d.id ? 'bg-amber-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {d.id} ({d.nameEn})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 text-center w-12 border-r border-slate-200">ข้อ</th>
                        <th className="p-2 border-r border-slate-200 min-w-[260px]">
                          หัวข้อการประเมิน (ฝ่าย {selectedSheetDept})
                        </th>
                        {staffEvaluatorsForDept.map((ev) => (
                          <th key={ev.key} className="p-2 text-center border-r border-slate-200 min-w-[100px] bg-amber-50/50">
                            {ev.name.replace('นางสาว', '').replace('นาย', '').replace('นาง', '')}
                          </th>
                        ))}
                        <th className="p-2 text-center bg-amber-100 text-amber-950 font-bold min-w-[80px]">
                          รวมคะแนน
                        </th>
                        <th className="p-2 text-center bg-amber-200 text-amber-950 font-bold min-w-[80px]">
                          เฉลี่ย
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffQuestionRows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-100">{r.code}</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100">{r.title}</td>
                          {r.evaluatorScores.map((s, idx) => (
                            <td key={idx} className="p-2 text-center font-bold text-slate-900 border-r border-slate-100">
                              {s.score}
                            </td>
                          ))}
                          <td className="p-2 text-center font-bold text-amber-950 bg-amber-50/30">
                            {r.totalScore}
                          </td>
                          <td className="p-2 text-center font-extrabold text-amber-900 bg-amber-100/40">
                            {r.avg !== null ? r.avg.toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-amber-950 text-white font-bold border-t-2 border-amber-800">
                      <tr>
                        <td colSpan={2} className="p-3 text-right pr-4 font-bold text-amber-200">
                          คะแนนรวมทั้งหมด:
                        </td>
                        <td colSpan={staffEvaluatorsForDept.length} className="p-2 text-center text-amber-300 font-extrabold">
                          {staffTotals.grandSum} คะแนน
                        </td>
                        <td colSpan={2} className="p-2 text-center text-amber-200 font-black text-sm bg-amber-900">
                          เฉลี่ยเต็ม 100: {staffTotals.scaled100Avg} ({staffTotals.grade})
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Permissions Matrix (SEPARATED CLC / CLFG COLUMNS) */}
            {activeTab === 'permissions' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                      ตารางกำหนดสิทธิ์กรรมการแยกหัวตารางชัดเจน (CLC vs CLFG)
                    </h4>
                    <p className="text-xs text-slate-500">
                      กำหนดว่ากรรมการแต่ละท่านทำแบบประเมินชุดใดของบริษัทใดได้บ้าง (สายงาน CU/IA/Risk เป็นของ CLC เท่านั้น)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestoreDefaultPermissions}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      คืนค่ามาตรฐานธรรมาภิบาล
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePermissions}
                      className="px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>บันทึกการตั้งค่าสิทธิ์</span>
                    </button>
                  </div>
                </div>

                {permSaveNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>บันทึกการกำหนดสิทธิ์ของกรรมการเรียบร้อยแล้ว มีผลต่อหน้าประเมินและลิงก์ทันที</span>
                  </div>
                )}

                {/* THE MATRIX TABLE WITH SEPARATE HEADERS */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      {/* Top Group Headers */}
                      <tr>
                        <th
                          rowSpan={2}
                          className="p-3 text-left bg-slate-100 text-slate-800 font-extrabold border-r border-slate-300 min-w-[200px]"
                        >
                          รายชื่อและตำแหน่งกรรมการ
                        </th>
                        <th
                          colSpan={6}
                          className="p-3 text-center bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 text-white font-black text-xs sm:text-sm border-r-2 border-slate-400"
                        >
                          🏢 บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์ (CLC)
                        </th>
                        <th
                          colSpan={3}
                          className="p-3 text-center bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white font-black text-xs sm:text-sm"
                        >
                          🏛️ บมจ.แคปปิตอล ลิ้งค์ ไฟแนนเชียล กรุ๊ป (CLFG)
                        </th>
                      </tr>

                      {/* Sub-column Headers with Quick Toggle Buttons */}
                      <tr className="border-t border-slate-200 text-[11px] font-bold">
                        {/* CLC 6 Columns */}
                        <th className="p-2 text-center border-r border-slate-200 bg-amber-50/70 text-amber-950 min-w-[85px]">
                          <div>บอร์ดทั้งชุด</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClc('canEvaluateBoard')}
                            className="text-[10px] text-amber-800 underline hover:text-amber-950 cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center border-r border-slate-200 bg-amber-50/70 text-amber-950 min-w-[85px]">
                          <div>รายบุคคล</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClc('canEvaluateDirectors')}
                            className="text-[10px] text-amber-800 underline hover:text-amber-950 cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center border-r border-slate-200 bg-amber-50/70 text-amber-950 min-w-[85px]">
                          <div>MD</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClc('canEvaluateMD')}
                            className="text-[10px] text-amber-800 underline hover:text-amber-950 cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center border-r border-slate-200 bg-amber-100/80 text-amber-950 min-w-[85px]">
                          <div className="font-extrabold">CU (กำกับฯ)</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClc('canEvaluateCU')}
                            className="text-[10px] text-amber-900 underline hover:text-black cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center border-r border-slate-200 bg-blue-100/80 text-blue-950 min-w-[85px]">
                          <div className="font-extrabold">IA (ตรวจสอบ)</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClc('canEvaluateIA')}
                            className="text-[10px] text-blue-900 underline hover:text-black cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center border-r-2 border-slate-400 bg-amber-100/80 text-amber-950 min-w-[85px]">
                          <div className="font-extrabold">Risk (ความเสี่ยง)</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClc('canEvaluateRISK')}
                            className="text-[10px] text-amber-900 underline hover:text-black cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>

                        {/* CLFG 3 Columns */}
                        <th className="p-2 text-center border-r border-slate-200 bg-blue-50/70 text-blue-950 min-w-[85px]">
                          <div>บอร์ดทั้งชุด</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClfg('canEvaluateBoard')}
                            className="text-[10px] text-blue-800 underline hover:text-blue-950 cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center border-r border-slate-200 bg-blue-50/70 text-blue-950 min-w-[85px]">
                          <div>รายบุคคล</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClfg('canEvaluateDirectors')}
                            className="text-[10px] text-blue-800 underline hover:text-blue-950 cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                        <th className="p-2 text-center bg-blue-50/70 text-blue-950 min-w-[85px]">
                          <div>MD</div>
                          <button
                            type="button"
                            onClick={() => handleBatchToggleClfg('canEvaluateMD')}
                            className="text-[10px] text-blue-800 underline hover:text-blue-950 cursor-pointer block mx-auto mt-0.5"
                          >
                            เลือก/ล้าง
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {localDirectors.map((dir) => {
                        const perm = localPermissions[dir.key] || DEFAULT_DIRECTOR_PERMISSIONS[dir.key] || {
                          clc: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true, canEvaluateCU: false, canEvaluateIA: false, canEvaluateRISK: false },
                          clfg: { canEvaluateBoard: true, canEvaluateDirectors: true, canEvaluateMD: true },
                        };

                        return (
                          <tr key={dir.key} className="hover:bg-slate-50/70">
                            <td className="p-2.5 border-r border-slate-200">
                              <div className="font-bold text-slate-900">{dir.name}</div>
                              <div className="text-[10px] text-slate-500">{dir.title}</div>
                            </td>

                            {/* CLC Checkboxes */}
                            <td className="p-2 text-center border-r border-slate-100">
                              <input
                                type="checkbox"
                                checked={perm.clc?.canEvaluateBoard ?? false}
                                onChange={() => handleToggleClcPermission(dir.key, 'canEvaluateBoard')}
                                className="w-4 h-4 text-amber-900 rounded focus:ring-amber-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center border-r border-slate-100">
                              <input
                                type="checkbox"
                                checked={perm.clc?.canEvaluateDirectors ?? false}
                                onChange={() => handleToggleClcPermission(dir.key, 'canEvaluateDirectors')}
                                className="w-4 h-4 text-amber-900 rounded focus:ring-amber-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center border-r border-slate-100">
                              <input
                                type="checkbox"
                                checked={perm.clc?.canEvaluateMD ?? false}
                                onChange={() => handleToggleClcPermission(dir.key, 'canEvaluateMD')}
                                className="w-4 h-4 text-amber-900 rounded focus:ring-amber-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center border-r border-slate-100 bg-amber-50/40">
                              <input
                                type="checkbox"
                                checked={perm.clc?.canEvaluateCU ?? false}
                                onChange={() => handleToggleClcPermission(dir.key, 'canEvaluateCU')}
                                className="w-4 h-4 text-amber-900 rounded focus:ring-amber-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center border-r border-slate-100 bg-blue-50/40">
                              <input
                                type="checkbox"
                                checked={perm.clc?.canEvaluateIA ?? false}
                                onChange={() => handleToggleClcPermission(dir.key, 'canEvaluateIA')}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center border-r-2 border-slate-400 bg-amber-50/40">
                              <input
                                type="checkbox"
                                checked={perm.clc?.canEvaluateRISK ?? false}
                                onChange={() => handleToggleClcPermission(dir.key, 'canEvaluateRISK')}
                                className="w-4 h-4 text-amber-900 rounded focus:ring-amber-500 cursor-pointer"
                              />
                            </td>

                            {/* CLFG Checkboxes */}
                            <td className="p-2 text-center border-r border-slate-100">
                              <input
                                type="checkbox"
                                checked={perm.clfg?.canEvaluateBoard ?? false}
                                onChange={() => handleToggleClfgPermission(dir.key, 'canEvaluateBoard')}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center border-r border-slate-100">
                              <input
                                type="checkbox"
                                checked={perm.clfg?.canEvaluateDirectors ?? false}
                                onChange={() => handleToggleClfgPermission(dir.key, 'canEvaluateDirectors')}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={perm.clfg?.canEvaluateMD ?? false}
                                onChange={() => handleToggleClfgPermission(dir.key, 'canEvaluateMD')}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Magic Links (Directors & Supervisor Delegation Links) */}
            {activeTab === 'links' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                      สร้างและคัดลอกลิงก์ส่งต่อ (สำหรับกรรมการ และมอบหมายหัวหน้างาน)
                    </h4>
                    <p className="text-xs text-slate-500">
                      กรรมการหรือหัวหน้างานเปิดแล้วทำได้ทันทีโดยไม่ต้องล็อกอิน และคะแนนจะส่งเข้าสู่ระบบกลางทันทีเมื่อกดส่ง
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">ปีการประเมิน:</span>
                    <select
                      value={selectedLinkYear}
                      onChange={(e) => setSelectedLinkYear(e.target.value as FiscalYear)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      {FISCAL_YEARS.map((y) => (
                        <option key={y} value={y}>พ.ศ. {y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Honest & Transparent Notice on Google AI Studio Cloud Environment */}
                <div className="bg-linear-to-r from-amber-950 via-slate-900 to-amber-900 border border-amber-500/50 rounded-2xl p-4 sm:p-5 text-white shadow-md space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-800 text-amber-200 border border-amber-600/50 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-amber-300" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h5 className="font-extrabold text-sm sm:text-base text-amber-200 flex items-center gap-2">
                        <span>💡 คำชี้แจงสำคัญ: ทำไมส่งลิงก์ภายนอกแล้วติดหน้าจอ Google Login หรือขึ้น Error 404?</span>
                      </h5>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        เนื่องจากระบบนี้รันอยู่บน <strong>Google AI Studio (Cloud Run)</strong> ซึ่งเป็นสภาพแวดล้อมพัฒนานิรภัยของ Google:
                        <br />• ลิงก์ <code>ais-dev-...</code> จะมีระบบรักษาความปลอดภัยของ Google Cloud ป้องกันไว้ ทำให้เปิดได้เฉพาะเครื่องที่ล็อกอินบัญชีเจ้าของโปรเจกต์เท่านั้น (เครื่องอื่นจึงถูกบังคับให้ล็อกอิน Google)
                        <br />• ลิงก์ <code>ais-pre-...</code> จะขึ้น <em>404 Page not found</em> เนื่องจาก Google ไม่ได้เปิดโฮสต์สาธารณะสำหรับโปรเจกต์นี้
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="bg-emerald-950/80 p-3.5 rounded-xl border border-emerald-500/40 space-y-1.5">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                        <PlayCircle className="w-4 h-4 text-emerald-400" />
                        <span>วิธีที่ 1 (สะดวกที่สุด): สลับทำในหน้านี้ทันที</span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        เนื่องจากหน้าจอนี้ผ่านการล็อกอินแล้ว ฝ่ายเลขาฯ สามารถกดปุ่ม <strong>"⚡ สลับทำหน้านี้"</strong> ที่ชื่อกรรมการแต่ละท่าน เพื่อเปิดทำแบบประเมินและกดยืนยันส่งผลได้ทันที ข้อมูลจะถูกบันทึกลงฐานข้อมูลกลางและ Backup ทันที 100%
                      </p>
                    </div>

                    <div className="bg-blue-950/80 p-3.5 rounded-xl border border-blue-500/40 space-y-1.5">
                      <div className="font-bold text-blue-300 flex items-center gap-1.5 text-xs">
                        <FileDown className="w-4 h-4 text-blue-400" />
                        <span>วิธีที่ 2 (ส่งให้กรรมการทำเอง): ดาวน์โหลดไฟล์ Offline (.html)</span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        กดปุ่ม <strong>"📥 โหลดไฟล์ Offline"</strong> แล้วส่งไฟล์ <code>.html</code> ให้กรรมการทาง LINE กรรมการแตะเปิดทำบนมือถือหรือ iPad ได้ทันที <strong>ไม่ต้องล็อกอิน Google ไม่ต้องมีเน็ต และไม่ติด 404</strong> เมื่อทำเสร็จ นำไฟล์ผลกลับมา Import ในแท็บ 9 ได้ทันที
                      </p>
                    </div>
                  </div>
                </div>

                {/* Public Base URL / Domain Config Box */}
                <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-amber-800" />
                      <span>กำหนด Domain / Public Base URL ของเว็บไซต์จริงสำหรับส่งต่อ:</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      ค่าปัจจุบัน: <code className="text-amber-900 font-mono font-bold">{customBaseUrl || 'ยังไม่ได้กำหนด'}</code>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="https://evaluation.capitallink.co.th"
                      className="flex-1 text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleSavePublicBaseUrl(customBaseUrl)}
                      className="px-4 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                    >
                      <Save className="w-4 h-4 text-amber-300" />
                      <span>บันทึกโดเมนนี้ลงระบบ</span>
                    </button>
                  </div>
                </div>

                {/* 1. Supervisor Delegation Links (CLC Only) */}
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-amber-200 mb-3">
                    <ShieldCheck className="w-5 h-5 text-amber-800 shrink-0" />
                    <div>
                      <h5 className="font-extrabold text-sm text-slate-900">
                        🛡️ ลิงก์มอบหมายสำหรับหัวหน้างาน (Supervisor Delegation Links - CLC)
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        ระบุกรรมการผู้มอบหมายสิทธิ์ ลิงก์จะล็อกเฉพาะแบบประเมินส่วนที่ 4 (พนักงานสายงานกำกับ) ซ่อนส่วนที่ 1, 2, 3 เพื่อรักษาความลับสูงสุด
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {SUBCOMMITTEE_DEPTS.map((dept) => {
                      // Eligible directors for this department
                      const eligibleDirs = (() => {
                        const list = localDirectors.filter((d) => {
                          const p = localPermissions[d.key] || DEFAULT_DIRECTOR_PERMISSIONS[d.key];
                          if (dept.id === 'CU') return p?.clc?.canEvaluateCU;
                          if (dept.id === 'IA') return p?.clc?.canEvaluateIA;
                          if (dept.id === 'RISK') return p?.clc?.canEvaluateRISK;
                          return false;
                        });
                        if (list.length > 0) return list;
                        return localDirectors.filter((d) => dept.allowedDirectorKeys.includes(d.key));
                      })();

                      const currentDelegatingKey = delegatingDirectors[dept.id] || eligibleDirs[0]?.key || 'chaianan';
                      const delegatingDirectorObj = localDirectors.find((d) => d.key === currentDelegatingKey) || eligibleDirs[0];
                      const queryParamString = `?c=CLC&y=${selectedLinkYear}&k=${currentDelegatingKey}&role=supervisor&dept=${dept.id}`;
                      const cleanBase = customBaseUrl.replace(/\/+$/, '');
                      const linkUrl = `${cleanBase}${queryParamString}`;
                      const isCopiedFull = copiedLinkKey === `sup_${dept.id}`;
                      const isCopiedParams = copiedLinkKey === `sup_params_${dept.id}`;

                      return (
                        <div
                          key={dept.id}
                          className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col gap-3 text-xs shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-amber-900 text-sm">สายงาน {dept.id}</span>
                              <span className="text-slate-800 font-bold">{dept.nameTh}</span>
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                {dept.evaluatorCommittee}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(`sup_${dept.id}`, linkUrl)}
                                className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                title="คัดลอกลิงก์เต็ม URL"
                              >
                                {isCopiedFull ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopiedFull ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์เต็ม'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyLink(`sup_params_${dept.id}`, queryParamString)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                                title="คัดลอกเฉพาะพารามิเตอร์เพื่อนำไปต่อท้ายโดเมนที่ต้องการ"
                              >
                                {isCopiedParams ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                                <span>{isCopiedParams ? 'คัดลอกพารามิเตอร์แล้ว' : 'เฉพาะ ?k=...'}</span>
                              </button>

                              {onSwitchToContext && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSwitchToContext({
                                      company: 'CLC',
                                      year: selectedLinkYear,
                                      evaluatorKey: currentDelegatingKey,
                                      isSupervisor: true,
                                      dept: dept.id,
                                    });
                                    onClose();
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                                  title="สลับสิทธิ์การทำแบบประเมินบนหน้าจอนี้ทันที"
                                >
                                  <PlayCircle className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>⚡ สลับทำหน้านี้</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDownloadSupervisorOfflineForm(dept.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                                title="ดาวน์โหลดไฟล์แบบประเมินสำหรับส่งทาง LINE (เปิดได้ทุกเครื่องโดยไม่ต้องล็อกอิน Google)"
                              >
                                <FileDown className="w-3.5 h-3.5 text-blue-700" />
                                <span>📥 โหลดไฟล์ Offline</span>
                              </button>

                              <a
                                href={linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                                title="ทดสอบเปิดลิงก์ในแท็บใหม่"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>

                          {/* Director Selector for Supervisor Delegation */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-100 bg-amber-50/40 p-2.5 rounded-lg">
                            <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-amber-800" />
                              <span>ระบุกรรมการผู้มอบหมายสิทธิ์:</span>
                            </span>
                            <select
                              value={currentDelegatingKey}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDelegatingDirectors((prev) => ({ ...prev, [dept.id]: val }));
                              }}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer flex-1"
                            >
                              {eligibleDirs.map((dir) => (
                                <option key={dir.key} value={dir.key}>
                                  {dir.name} ({dir.title})
                                </option>
                              ))}
                            </select>
                            <span className="text-[11px] text-amber-800">
                              (มอบหมายในนาม: <strong>{delegatingDirectorObj?.name}</strong>)
                            </span>
                          </div>

                          <div className="font-mono text-[11px] text-slate-500 truncate select-all bg-slate-50 p-1.5 rounded border border-slate-200">
                            {linkUrl}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Direct Links for Individual Directors (Single Unified Link Per Director) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="pb-2.5 border-b border-slate-200 mb-3">
                    <h5 className="font-extrabold text-sm text-slate-900">
                      👔 ลิงก์ประจำตัวกรรมการ (Directors Unified Direct Links)
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      มีเพียง 1 ลิงก์ต่อกรรมการ 1 ท่าน (ไม่ต้องแยก CLC / CLFG) กรรมการเปิดแล้วทำแบบประเมินได้ทันทีตามสิทธิ์ที่ตั้งค่าไว้ และสามารถสลับบริษัทในหน้าประเมินได้เอง
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {localDirectors.map((dir) => {
                      const perm = localPermissions[dir.key] || DEFAULT_DIRECTOR_PERMISSIONS[dir.key];
                      const canClc = perm?.clc?.canEvaluateBoard || perm?.clc?.canEvaluateDirectors;
                      const canClfg = perm?.clfg?.canEvaluateBoard || perm?.clfg?.canEvaluateDirectors;

                      // Single unified link per director
                      const queryParamString = `?k=${dir.key}&y=${selectedLinkYear}`;
                      const cleanBase = customBaseUrl.replace(/\/+$/, '');
                      const linkUrl = `${cleanBase}${queryParamString}`;
                      const isCopiedFull = copiedLinkKey === `dir_${dir.key}`;
                      const isCopiedParams = copiedLinkKey === `dir_params_${dir.key}`;

                      return (
                        <div
                          key={dir.key}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
                        >
                          <div className="flex-1 truncate">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{dir.name}</span>
                              <span className="text-slate-500">({dir.title})</span>
                              {canClc && (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  CLC
                                </span>
                              )}
                              {canClfg && (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-bold">
                                  CLFG
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 truncate mt-1 select-all">
                              {linkUrl}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(`dir_${dir.key}`, linkUrl)}
                              className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                              title="คัดลอกลิงก์เต็ม URL"
                            >
                              {isCopiedFull ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopiedFull ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์เต็ม'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyLink(`dir_params_${dir.key}`, queryParamString)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                              title="คัดลอกเฉพาะพารามิเตอร์ ?k=..."
                            >
                              {isCopiedParams ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                              <span>{isCopiedParams ? 'คัดลอกแล้ว' : 'เฉพาะ ?k=...'}</span>
                            </button>

                            {onSwitchToContext && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSwitchToContext({
                                    company: canClc ? 'CLC' : 'CLFG',
                                    year: selectedLinkYear,
                                    evaluatorKey: dir.key,
                                    isSupervisor: false,
                                    dept: 'CU',
                                  });
                                  onClose();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                                title="สลับสิทธิ์การทำแบบประเมินบนหน้าจอนี้ทันที"
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-700" />
                                <span>⚡ สลับทำหน้านี้</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDownloadDirectorOfflineForm(dir)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                              title="ดาวน์โหลดไฟล์แบบประเมินสำหรับส่งทาง LINE (เปิดได้ทุกเครื่องโดยไม่ต้องล็อกอิน Google)"
                            >
                              <FileDown className="w-3.5 h-3.5 text-blue-700" />
                              <span>📥 โหลดไฟล์ Offline</span>
                            </button>

                            <a
                              href={linkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="ทดสอบเปิดลิงก์"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Directors Management */}
            {activeTab === 'directors' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      จัดการรายชื่อและตำแหน่งกรรมการ ({localDirectors.length} ท่าน)
                    </h4>
                    <p className="text-xs text-slate-500">
                      เพิ่มกรรมการท่านใหม่ แก้ไขชื่อ-ตำแหน่ง หรือลบรายชื่อได้
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreDefaultDirectors}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    คืนค่ารายชื่อเริ่มต้น (10 ท่าน)
                  </button>
                </div>

                {dirSaveNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>บันทึกรายชื่อกรรมการเรียบร้อยแล้ว</span>
                  </div>
                )}

                <form onSubmit={handleAddDirector} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อ-นามสกุล กรรมการ *</label>
                    <input
                      type="text"
                      value={newDirName}
                      onChange={(e) => setNewDirName(e.target.value)}
                      placeholder="เช่น นายสมคิด สถาวร"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ตำแหน่งในคณะกรรมการ</label>
                    <input
                      type="text"
                      value={newDirTitle}
                      onChange={(e) => setNewDirTitle(e.target.value)}
                      placeholder="เช่น กรรมการ / กรรมการอิสระ"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มกรรมการท่านใหม่</span>
                  </button>
                </form>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {localDirectors.map((dir, idx) => (
                    <div key={dir.key} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 flex-1">
                        <span className="w-6 text-center font-bold text-slate-400">#{idx + 1}</span>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={dir.name}
                            onChange={(e) => handleUpdateDirector(dir.key, 'name', e.target.value)}
                            className="font-bold text-slate-900 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:outline-hidden"
                          />
                          <input
                            type="text"
                            value={dir.title}
                            onChange={(e) => handleUpdateDirector(dir.key, 'title', e.target.value)}
                            className="text-slate-600 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:outline-hidden"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDirector(dir.key)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="ลบกรรมการท่านนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: Questions Management */}
            {activeTab === 'questions' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">เลือกชุดแบบประเมิน:</span>
                    <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-300">
                      <button
                        type="button"
                        onClick={() => setEditableSection('s1')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          editableSection === 's1' ? 'bg-amber-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        บอร์ดทั้งชุด (27 ข้อ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditableSection('s2')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          editableSection === 's2' ? 'bg-amber-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        รายบุคคล (11 ข้อ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditableSection('s3')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          editableSection === 's3' ? 'bg-amber-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        ผู้จัดการใหญ่ (45 ข้อ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditableSection('s4')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          editableSection === 's4' ? 'bg-amber-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        พนักงาน (20 ข้อ)
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRestoreDefaultQuestions}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    คืนค่าหัวข้อเริ่มต้นจาก PDF
                  </button>
                </div>

                {questionSaveNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>บันทึกหัวข้อคำถามเรียบร้อยแล้ว</span>
                  </div>
                )}

                <form onSubmit={handleAddQuestion} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">รหัสข้อ</label>
                    <input
                      type="text"
                      value={newQCode}
                      onChange={(e) => setNewQCode(e.target.value)}
                      placeholder="เช่น ข้อ 1.5"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">ข้อความหัวข้อประเมิน *</label>
                    <input
                      type="text"
                      value={newQTitle}
                      onChange={(e) => setNewQTitle(e.target.value)}
                      placeholder="พิมพ์หัวข้อคำถามที่ต้องการเพิ่ม..."
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มข้อประเมิน</span>
                  </button>
                </form>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
                  {localQuestions[
                    editableSection === 's1' ? 'section1' : editableSection === 's2' ? 'section2' : editableSection === 's3' ? 'section3' : 'section4'
                  ].map((q) => (
                    <div key={q.id} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-50/60">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="text"
                          value={q.code}
                          onChange={(e) => handleUpdateQuestion(editableSection, q.id, 'code', e.target.value)}
                          className="w-20 font-bold text-slate-700 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:outline-hidden"
                        />
                        <textarea
                          rows={2}
                          value={q.title}
                          onChange={(e) => handleUpdateQuestion(editableSection, q.id, 'title', e.target.value)}
                          className="flex-1 text-slate-900 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:bg-white focus:outline-hidden resize-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(editableSection, q.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0 mt-1"
                        title="ลบคำถามข้อนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: Years Management */}
            {activeTab === 'yearsAndSystem' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-800" />
                    <span>จัดการปีประเมิน (Fiscal Years Management)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เลขานุการสามารถเพิ่มปีประเมินใหม่ แก้ไขชื่อปี หรือลบปีที่ไม่ต้องการออกจากระบบได้ (ข้อมูลจะบันทึกทั้งในเครื่องและระบบกลาง)
                  </p>
                </div>

                {yearSaveNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>บันทึกการเปลี่ยนแปลงปีประเมินเรียบร้อยแล้ว</span>
                  </div>
                )}

                {/* Add New Year Form */}
                <form
                  onSubmit={handleAddNewYear}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เพิ่มปีประเมิน พ.ศ. ใหม่
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="ระบุปี พ.ศ. 4 หลัก เช่น 2572"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="sm:self-end px-5 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มปีประเมิน</span>
                  </button>
                </form>

                {/* Years List */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-700">รายการปีประเมินในระบบ ({managedYears.length} ปี)</h5>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                    {managedYears.map((y) => {
                      const isCurrentActive = y === currentFormData.year;
                      const isEditing = editingYearKey === y;

                      return (
                        <div
                          key={y}
                          className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-extrabold text-sm border border-amber-200">
                              <Calendar className="w-4 h-4 text-amber-800" />
                            </div>
                            <div>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    maxLength={4}
                                    value={editingYearVal}
                                    onChange={(e) => setEditingYearVal(e.target.value.replace(/\D/g, ''))}
                                    className="w-28 px-2 py-1 text-xs font-bold rounded-lg border border-amber-400 focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditYear(y)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                                  >
                                    บันทึก
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingYearKey(null)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-300 cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-slate-900">
                                    พ.ศ. {y}
                                  </span>
                                  {isCurrentActive && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                                      ปีปัจจุบันในฟอร์ม
                                    </span>
                                  )}
                                  {summaryYear === y && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300">
                                      ปีที่เลือกดูสรุป
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                แบบประเมินประจำปีบัญชี พ.ศ. {y}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => setSummaryYear(y)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                summaryYear === y
                                  ? 'bg-amber-900 text-white border-amber-900 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                              }`}
                            >
                              เลือกดูปีนี้
                            </button>

                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => handleStartEditYear(y)}
                                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                title="แก้ไขปีนี้"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={managedYears.length <= 1}
                              onClick={() => handleDeleteYear(y)}
                              className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                              title={managedYears.length <= 1 ? 'ไม่สามารถลบปีสุดท้ายได้' : 'ลบปีนี้'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: Submissions & Form Unlock Control */}
            {activeTab === 'submissionsManagement' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <Unlock className="w-5 h-5 text-amber-800" />
                    <span>ปลดล็อกฟอร์มและจัดการข้อมูลการประเมินกรรมการ</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตรวจสอบสถานะการส่งของกรรมการทุกท่าน หากกรรมการประสงค์แก้ไขคะแนน เลขาฯ สามารถปลดล็อกฟอร์มให้กรรมการ หรือคลิกเพื่อเข้าไปแก้ไขคะแนนแทนได้ทันที
                  </p>
                </div>

                {actionNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{actionNotice}</span>
                  </div>
                )}

                {/* Safety Auto-Snapshot Shield Banner */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-200/80 text-emerald-900 shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-800" />
                    </div>
                    <div>
                      <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                        <span>🛡️ มีระบบสำรองข้อมูลฉุกเฉินอัตโนมัติ (Safety Auto-Snapshot) คุ้มครองตลอดเวลา</span>
                      </div>
                      <div className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        ก่อนการล้างคะแนน ลบข้อมูล หรือรีเซ็ตใด ๆ ระบบจะสร้างจุดสำรอง Snapshot ให้อัตโนมัติ หากเผลอลบข้อมูลผิดพลาด สามารถกู้คืนกลับมาได้ทันทีที่แท็บ <strong>"9. สำรอง & กู้คืนข้อมูล"</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('backups');
                      loadBackups();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 self-start sm:self-auto"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-300" />
                    <span>ไปที่จุดสำรองข้อมูล ({backupsList.length})</span>
                  </button>
                </div>

                {/* Filter Toolbar */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">บริษัท:</span>
                      <div className="inline-flex bg-white p-1 rounded-xl border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setSummaryCompany('CLC')}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            summaryCompany === 'CLC' ? 'bg-amber-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          CLC
                        </button>
                        <button
                          type="button"
                          onClick={() => setSummaryCompany('CLFG')}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            summaryCompany === 'CLFG' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          CLFG
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">ปี พ.ศ.:</span>
                      <div className="inline-flex bg-white p-1 rounded-xl border border-slate-300">
                        {managedYears.map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => setSummaryYear(y)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                              summaryYear === y ? 'bg-amber-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">สถานะ:</span>
                      <select
                        value={submissionStatusFilter}
                        onChange={(e) => setSubmissionStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-hidden"
                      >
                        <option value="ALL">ทั้งหมด</option>
                        <option value="SUBMITTED">ส่งผลแล้ว (SUBMITTED)</option>
                        <option value="DRAFT">แบบร่าง (DRAFT)</option>
                        <option value="NONE">ยังไม่ได้เริ่ม</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={submissionSearch}
                      onChange={(e) => setSubmissionSearch(e.target.value)}
                      placeholder="ค้นหาชื่อกรรมการ..."
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 w-44"
                    />
                    <button
                      type="button"
                      onClick={loadAllSubmissions}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      title="รีเฟรชข้อมูลล่าสุด"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">รีเฟรช ({lastRefreshedAt || 'ล่าสุด'})</span>
                    </button>
                  </div>
                </div>

                {/* Director Submissions Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3 min-w-[200px]">กรรมการผู้ประเมิน</th>
                          <th className="p-3 min-w-[140px]">บริษัท / ปี พ.ศ.</th>
                          <th className="p-3 min-w-[150px]">สถานะฟอร์ม</th>
                          <th className="p-3 min-w-[140px]">เวลาบันทึกล่าสุด</th>
                          <th className="p-3 text-right min-w-[280px]">การดำเนินการ (Action)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {evaluatorsForCompany
                          .filter((dir) => {
                            if (!submissionSearch) return true;
                            return (
                              dir.name.includes(submissionSearch) ||
                              dir.title.includes(submissionSearch) ||
                              dir.key.includes(submissionSearch)
                            );
                          })
                          .filter((dir) => {
                            const sub = submissionsForCompany.find((s) => s.evaluatorKey === dir.key && !s.isSupervisorMode);
                            if (submissionStatusFilter === 'ALL') return true;
                            if (submissionStatusFilter === 'SUBMITTED') return sub?.status === 'SUBMITTED';
                            if (submissionStatusFilter === 'DRAFT') return sub?.status === 'DRAFT';
                            if (submissionStatusFilter === 'NONE') return !sub;
                            return true;
                          })
                          .map((dir, idx) => {
                            const sub = submissionsForCompany.find(
                              (s) => s.evaluatorKey === dir.key && !s.isSupervisorMode
                            );
                            const isSubmitted = sub?.status === 'SUBMITTED';
                            const isDraft = sub?.status === 'DRAFT';

                            return (
                              <tr key={dir.key} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-extrabold text-slate-900">{dir.name}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">{dir.title}</div>
                                </td>
                                <td className="p-3">
                                  <span className="font-bold text-slate-700">{summaryCompany}</span>
                                  <span className="text-slate-400 mx-1">/</span>
                                  <span className="font-semibold text-slate-600">พ.ศ. {summaryYear}</span>
                                </td>
                                <td className="p-3">
                                  {isSubmitted ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      ส่งผลแล้ว (SUBMITTED)
                                    </span>
                                  ) : isDraft ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-700" />
                                      แบบร่าง (DRAFT)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                      ยังไม่มีข้อมูล
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-500 text-[11px]">
                                  {sub?.submittedAt
                                    ? new Date(sub.submittedAt).toLocaleString('th-TH')
                                    : sub?.lastSavedAt
                                    ? new Date(sub.lastSavedAt).toLocaleString('th-TH')
                                    : '-'}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                                    {/* Action 1: Unlock (Active only if submitted) */}
                                    {isSubmitted && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlockDirectorSubmission(sub, dir.name)}
                                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                        title="ปลดล็อกฟอร์มของท่านนี้กลับเป็นแบบร่าง (DRAFT) เพื่อให้กรรมการแก้ไขได้"
                                      >
                                        <Unlock className="w-3.5 h-3.5 text-amber-700" />
                                        <span>ปลดล็อกฟอร์ม</span>
                                      </button>
                                    )}

                                    {/* Action 2: Edit as Secretary */}
                                    <button
                                      type="button"
                                      onClick={() => handleEditAsSecretary(dir.key, dir.name, sub)}
                                      className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                      title="เลขาฯ เข้าไปดูและแก้ไขคะแนนแทนกรรมการท่านนี้"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-purple-700" />
                                      <span>เลขาแก้ไขแทน</span>
                                    </button>

                                    {/* Action 3: Quick Select for Granular Reset */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResetTargetKey(dir.key);
                                        const el = document.getElementById('admin-reset-center');
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }}
                                      className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                      title="เลือกล้างคะแนนของกรรมการท่านนี้"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                      <span>ล้างคะแนน...</span>
                                    </button>

                                    {/* Action 4: Delete this submission */}
                                    {sub && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDirectorSubmission(sub, dir.name)}
                                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                                        title="ลบผลการประเมินของท่านนี้ออกจากระบบ"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Delegated Supervisors Submissions (if any) */}
                {submissionsForCompany.some((s) => s.isSupervisorMode) && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-800" />
                      <span>รายการส่งผลโดยหัวหน้างานที่ได้รับมอบหมาย (Supervisor Delegations)</span>
                    </h5>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-3">หัวหน้างานผู้ปฏิบัติการแทน</th>
                            <th className="p-3">สายงาน</th>
                            <th className="p-3">ปฏิบัติการแทนกรรมการ</th>
                            <th className="p-3">สถานะ</th>
                            <th className="p-3 text-right">การดำเนินการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {submissionsForCompany
                            .filter((s) => s.isSupervisorMode)
                            .map((sub) => {
                              const dirName = localDirectors.find((d) => d.key === sub.evaluatorKey)?.name || sub.evaluatorKey;
                              return (
                                <tr key={sub.id} className="hover:bg-slate-50/80">
                                  <td className="p-3">
                                    <div className="font-extrabold text-slate-900">{sub.supervisorName || 'หัวหน้างาน'}</div>
                                    <div className="text-[11px] text-slate-500">{sub.supervisorTitle || '-'}</div>
                                  </td>
                                  <td className="p-3 font-bold text-amber-900">{sub.supervisorDept}</td>
                                  <td className="p-3 text-slate-700">{dirName}</td>
                                  <td className="p-3">
                                    {sub.status === 'SUBMITTED' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        ส่งผลแล้ว
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                        แบบร่าง
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      {sub.status === 'SUBMITTED' && (
                                        <button
                                          type="button"
                                          onClick={() => handleUnlockDirectorSubmission(sub, sub.supervisorName || 'หัวหน้างาน')}
                                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold"
                                        >
                                          ปลดล็อก
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setResetTargetKey(`sup_${sub.supervisorDept}`);
                                          const el = document.getElementById('admin-reset-center');
                                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 text-xs font-bold"
                                        title="เลือกล้างคะแนนของหัวหน้างานท่านนี้"
                                      >
                                        ล้างคะแนน...
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDirectorSubmission(sub, sub.supervisorName || 'หัวหน้างาน')}
                                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Master Reset & Granular Assessment Clear Center */}
                <div id="admin-reset-center" className="p-5 bg-linear-to-b from-rose-50/50 to-slate-50 border-2 border-rose-200/80 rounded-2xl space-y-5 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-rose-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900">
                          ศูนย์จัดการล้างคะแนนและรีเซ็ตข้อมูล (Assessment Reset & Data Wipe Center)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          เลือกบุคคลและแบบประเมินที่ต้องการล้างคะแนน หรือล้างข้อมูลทั้งระบบ
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section A: Granular Reset by Person & Section */}
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">1</span>
                        <span>เลือกล้างคะแนนรายบุคคล และเลือกแบบประเมินเฉพาะส่วน (Selective Reset)</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        บริษัท: <strong className="text-slate-800">{summaryCompany}</strong> | ปี พ.ศ.: <strong className="text-slate-800">{summaryYear}</strong>
                      </span>
                    </div>

                    {/* Step 1: Person Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        เลือกกรรมการ หรือผู้ประเมินที่ต้องการจัดการ:
                      </label>
                      <select
                        value={resetTargetKey}
                        onChange={(e) => setResetTargetKey(e.target.value)}
                        className="w-full text-xs sm:text-sm font-semibold p-2.5 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      >
                        <optgroup label="-- คณะกรรมการบริษัท --">
                          {evaluatorsForCompany.map((dir) => {
                            const sub = submissionsForCompany.find(
                              (s) => s.evaluatorKey === dir.key && !s.isSupervisorMode
                            );
                            const statusLabel = sub?.status === 'SUBMITTED' ? ' [ส่งผลแล้ว]' : sub?.status === 'DRAFT' ? ' [แบบร่าง]' : ' [ยังไม่มีข้อมูล]';
                            return (
                              <option key={dir.key} value={dir.key}>
                                {dir.name} ({dir.title}) {statusLabel}
                              </option>
                            );
                          })}
                        </optgroup>
                        {submissionsForCompany.some((s) => s.isSupervisorMode) && (
                          <optgroup label="-- หัวหน้างานที่ได้รับมอบหมาย --">
                            {submissionsForCompany
                              .filter((s) => s.isSupervisorMode)
                              .map((sub) => (
                                <option key={sub.id} value={`sup_${sub.supervisorDept}`}>
                                  {sub.supervisorName || 'หัวหน้างาน'} - สายงาน {sub.supervisorDept} (ปฏิบัติการแทน: {sub.evaluatorName}) {sub.status === 'SUBMITTED' ? ' [ส่งผลแล้ว]' : ' [แบบร่าง]'}
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Step 2: Assessment Sections Checkboxes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700">
                          เลือกแบบประเมินที่ต้องการล้างคะแนน (ติ๊กเลือกเฉพาะส่วนที่ต้องการ):
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setResetSectionsSelected({ s1: true, s2: true, s3: true, s4: true })}
                            className="text-[11px] font-bold text-amber-900 hover:underline cursor-pointer"
                          >
                            เลือกทุกส่วน
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setResetSectionsSelected({ s1: false, s2: false, s3: false, s4: false })}
                            className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                          >
                            ยกเลิกทั้งหมด
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          resetSectionsSelected.s1 ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={resetSectionsSelected.s1}
                            onChange={(e) => setResetSectionsSelected((prev) => ({ ...prev, s1: e.target.checked }))}
                            className="mt-0.5 rounded text-amber-900 focus:ring-amber-500"
                          />
                          <div className="text-xs leading-snug">
                            <div>ส่วนที่ 1: คณะกรรมการทั้งชุด (Board)</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">ล้างคะแนนประเมินบอร์ด 4 ด้านและข้อเสนอแนะ</div>
                          </div>
                        </label>

                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          resetSectionsSelected.s2 ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={resetSectionsSelected.s2}
                            onChange={(e) => setResetSectionsSelected((prev) => ({ ...prev, s2: e.target.checked }))}
                            className="mt-0.5 rounded text-amber-900 focus:ring-amber-500"
                          />
                          <div className="text-xs leading-snug">
                            <div>ส่วนที่ 2: กรรมการรายบุคคล (Cross-Evaluation)</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">ล้างคะแนนประเมินกรรมการทุกคนที่ท่านนี้ได้ให้ไว้</div>
                          </div>
                        </label>

                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          resetSectionsSelected.s3 ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={resetSectionsSelected.s3}
                            onChange={(e) => setResetSectionsSelected((prev) => ({ ...prev, s3: e.target.checked }))}
                            className="mt-0.5 rounded text-amber-900 focus:ring-amber-500"
                          />
                          <div className="text-xs leading-snug">
                            <div>ส่วนที่ 3: ผู้จัดการใหญ่ (President / MD)</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">ล้างคะแนนประเมิน MD 9 ด้านและข้อเสนอแนะ</div>
                          </div>
                        </label>

                        <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          resetSectionsSelected.s4 ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={resetSectionsSelected.s4}
                            onChange={(e) => setResetSectionsSelected((prev) => ({ ...prev, s4: e.target.checked }))}
                            className="mt-0.5 rounded text-amber-900 focus:ring-amber-500"
                          />
                          <div className="text-xs leading-snug">
                            <div>ส่วนที่ 4: พนักงานสายงานกำกับ (Staff CU/IA/Risk)</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">ล้างคะแนนแบบประเมินพนักงาน 20 ข้อเต็ม 100</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Step 3: Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={handleResetSelectiveSectionsForPerson}
                        className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer active:scale-95"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-300" />
                        <span>🗑️ ล้างคะแนนเฉพาะส่วนที่เลือก & ปลดล็อกเป็น DRAFT</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetAllForPerson}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold transition-colors cursor-pointer active:scale-95"
                        title="ล้างคะแนนทุกส่วนของท่านนี้ออกทั้งหมด"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>⚠️ ล้างคะแนนทั้งหมดของท่านนี้</span>
                      </button>
                    </div>
                  </div>

                  {/* Section B: Master System Clear & Tools */}
                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-rose-200/80 shadow-2xs space-y-3">
                    <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-900 flex items-center justify-center text-[11px] font-black">2</span>
                      <span>เครื่องมือควบคุมหน้าจอและล้างทั้งระบบ</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('คุณต้องการล้างคะแนนทั้งหมดของฟอร์มที่เปิดค้างอยู่บนหน้าจอนี้หรือไม่?')) {
                            onResetForm();
                            onClose();
                          }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 text-slate-800 hover:text-rose-900 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-rose-600" />
                          ล้างคะแนนฟอร์มหน้าจอปัจจุบัน
                        </span>
                        <span className="text-[11px] text-slate-500 underline">ล้างหน้าจอ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onFillSampleData();
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-blue-900 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-blue-600" />
                          ทดสอบกรอกข้อมูลตัวอย่าง (Demo Data)
                        </span>
                        <span className="text-[11px] text-blue-700 underline">กรอกตัวอย่าง</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleClearAllSystemSubmissions}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-rose-400 bg-rose-100 hover:bg-rose-200 text-rose-950 text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <span className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-rose-700" />
                          <span>🚨 ล้างข้อมูลผลการประเมินทั้งหมดในระบบกลาง (Master Reset All Submissions)</span>
                        </span>
                        <span className="text-[11px] text-white bg-rose-800 px-2.5 py-1 rounded-md font-bold shadow-xs">
                          ล้างทั้งระบบ
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 9: Backups & Disaster Recovery Center */}
            {activeTab === 'backups' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-800" />
                    <span>ศูนย์สำรองและกู้คืนข้อมูล (Backup & Disaster Recovery Center)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ป้องกันข้อมูลสูญหาย 100% มีระบบ Snapshot สำรองอัตโนมัติทุกครั้งก่อนแก้ไข/ลบ และสามารถดาวน์โหลดไฟล์สำรองฉบับเต็มเก็บไว้ในเครื่องคอมพิวเตอร์ได้ทันที
                  </p>
                </div>

                {actionNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{actionNotice}</span>
                  </div>
                )}

                {/* Status Stats Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-amber-900/80">ข้อมูลผลการประเมินในระบบ</div>
                    <div className="text-2xl font-black text-amber-950 mt-1">
                      {allSubmissions.length} <span className="text-xs font-normal text-amber-800">ชุดการประเมิน</span>
                    </div>
                    <div className="text-[10px] text-amber-700 mt-1">
                      (ส่งแล้ว: {allSubmissions.filter((s) => s.status === 'SUBMITTED').length} | แบบร่าง: {allSubmissions.filter((s) => s.status === 'DRAFT').length})
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-blue-900/80">จุดสำรองข้อมูล Snapshot</div>
                    <div className="text-2xl font-black text-blue-950 mt-1">
                      {backupsList.length} <span className="text-xs font-normal text-blue-800">จุดบันทึก</span>
                    </div>
                    <div className="text-[10px] text-blue-700 mt-1">
                      จุดล่าสุด: {backupsList[0] ? new Date(backupsList[0].timestamp).toLocaleTimeString('th-TH') : '-'}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs">
                    <div className="text-[11px] font-bold text-emerald-900/80">ความปลอดภัยของระบบ</div>
                    <div className="text-sm font-extrabold text-emerald-950 mt-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>เปิดระบบ Auto-Snapshot</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-1">
                      สำรองอัตโนมัติก่อนลบ/รีเซ็ตทุกครั้ง
                    </div>
                  </div>
                </div>

                {/* Section 1: Create Backup & Download */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <h5 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Save className="w-4 h-4 text-amber-800" />
                      <span>1. สร้างจุดสำรองข้อมูลทันที & ดาวน์โหลดเก็บลงเครื่อง (Manual Backup)</span>
                    </h5>
                    <button
                      type="button"
                      onClick={handleDownloadFullBackup}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                      title="ดาวน์โหลดข้อมูลทั้งหมดทั้งระบบเป็นไฟล์ JSON ลงคอมพิวเตอร์"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      <span>ดาวน์โหลดไฟล์สำรอง (.json) ลงเครื่อง PC</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={backupReasonInput}
                      onChange={(e) => setBackupReasonInput(e.target.value)}
                      placeholder="ระบุเหตุผลหรือชื่อจุดสำรอง เช่น 'ก่อนประชุมบอร์ด Q4' หรือ 'สำรองประจำสัปดาห์'"
                      className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      disabled={isCreatingBackup}
                      onClick={handleCreateManualBackup}
                      className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isCreatingBackup ? 'กำลังสำรองข้อมูล...' : '💾 สร้างจุดสำรอง Snapshot ทันที'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    💡 <strong>คำแนะนำ:</strong> การดาวน์โหลดไฟล์สำรอง (.json) เก็บไว้ในเครื่องคอมพิวเตอร์ของเลขาฯ จะช่วยให้มีข้อมูลสำรองฉุกเฉินอยู่นอกระบบเซิร์ฟเวอร์เสมอ
                  </p>
                </div>

                {/* Section 2: Restore from External Backup File */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h5 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-700" />
                      <span>2. นำเข้าไฟล์สำรองเพื่อกู้คืนข้อมูล (Restore from Backup File .json)</span>
                    </h5>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        onChange={handleFileUploadAndPreview}
                        className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-xl bg-white p-1"
                      />
                    </div>

                    {uploadedBackupPreview && (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-300 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="text-xs font-bold text-blue-950 flex items-center gap-2">
                            <FileJson className="w-4 h-4 text-blue-700" />
                            <span>ไฟล์: <strong>{uploadedFileName}</strong></span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-200 text-blue-900 text-[10px] font-extrabold">
                              พบข้อมูล {uploadedBackupPreview.submissionsCount} ชุด
                            </span>
                          </div>
                          {uploadedBackupPreview.exportTimestamp && (
                            <span className="text-[11px] text-blue-800">
                              วันที่สร้างไฟล์: {new Date(uploadedBackupPreview.exportTimestamp).toLocaleString('th-TH')}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-blue-900/90 bg-white/70 p-2.5 rounded-lg border border-blue-200">
                          🛡️ <strong>ระบบความปลอดภัย:</strong> เมื่อกดยืนยัน ระบบจะสร้างจุดสำรอง Snapshot ข้อมูลปัจจุบันไว้ให้อัตโนมัติก่อนนำข้อมูลจากไฟล์เข้าเสมอ
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedBackupPreview(null);
                              setUploadedFileName('');
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            disabled={isImportingBackup}
                            onClick={handleConfirmImportFile}
                            className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isImportingBackup ? 'กำลังกู้คืนข้อมูล...' : 'ยืนยันกู้คืนข้อมูลจากไฟล์นี้'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Snapshot Archive & Rollback */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-800" />
                      <span>3. ประวัติจุดสำรองข้อมูล Snapshot บนระบบ ({backupsList.length} รายการ)</span>
                    </h5>
                    <button
                      type="button"
                      onClick={loadBackups}
                      className="text-xs text-amber-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>รีเฟรชรายการ</span>
                    </button>
                  </div>

                  {isLoadingBackups ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                      กำลังโหลดประวัติ Snapshot...
                    </div>
                  ) : backupsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                      ยังไม่มีจุดสำรองข้อมูล Snapshot ในระบบ (กดปุ่ม "สร้างจุดสำรอง Snapshot ทันที" ด้านบนเพื่อเริ่มสำรอง)
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-3">วันและเวลาที่บันทึก</th>
                            <th className="p-3">ชื่อ / เหตุผลการสำรอง</th>
                            <th className="p-3 text-center">จำนวนข้อมูล</th>
                            <th className="p-3 text-center">ขนาดไฟล์</th>
                            <th className="p-3 text-right">การกู้คืน / จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {backupsList.map((snap) => {
                            const isAuto = snap.reason.startsWith('auto_') || snap.reason.startsWith('safety_');
                            const cleanReason = snap.reason
                              .replace(/^auto_/, 'อัตโนมัติ: ')
                              .replace(/^safety_before_/, 'นิรภัยก่อน: ')
                              .replace(/^pre_/, 'ก่อน: ');

                            return (
                              <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{new Date(snap.timestamp).toLocaleString('th-TH')}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isAuto
                                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                      }`}
                                    >
                                      {isAuto ? 'Auto Snapshot' : 'Manual'}
                                    </span>
                                    <span className="font-extrabold text-slate-800">{cleanReason}</span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-xs">
                                    {snap.filename}
                                  </div>
                                </td>
                                <td className="p-3 text-center font-bold text-slate-800 whitespace-nowrap">
                                  {snap.submissionsCount} ชุด
                                </td>
                                <td className="p-3 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                  {(snap.sizeBytes / 1024).toFixed(1)} KB
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      disabled={isRestoringBackup}
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `คุณต้องการกู้คืนข้อมูลกลับไปยังจุด "${cleanReason}" ณ วันที่ ${new Date(
                                              snap.timestamp
                                            ).toLocaleString('th-TH')} หรือไม่?\n\n(ระบบจะทำการสร้าง Safety Snapshot ข้อมูลปัจจุบันไว้ให้อัตโนมัติก่อน)`
                                          )
                                        ) {
                                          handleRestoreSnapshot(snap);
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                      title="กู้คืนข้อมูลกลับไปยังจุดนี้"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>กู้คืนจุดนี้</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSnapshot(snap)}
                                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-500 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                                      title="ลบ Snapshot นี้"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 10: Audit Logs Center */}
            {activeTab === 'auditLogs' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-800" />
                    <span>บันทึกประวัติการใช้งานและกิจกรรมในระบบ (System Audit Trail)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตรวจสอบย้อนหลังได้ทุกกิจกรรม เพื่อความโปร่งใส ความถูกต้อง และการกำกับดูแลตามหลักธรรมาภิบาล (Corporate Governance Compliance)
                  </p>
                </div>

                {/* Filter and Export Toolbar */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={logSearchQuery}
                          onChange={(e) => setLogSearchQuery(e.target.value)}
                          placeholder="ค้นหาข้อความ, ชื่อกรรมการ, กิจกรรม..."
                          className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>

                      <select
                        value={logActionFilter}
                        onChange={(e) => setLogActionFilter(e.target.value)}
                        className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      >
                        <option value="ALL">กิจกรรมทั้งหมด</option>
                        <option value="SUBMISSION_SUBMIT">ส่งแบบประเมิน (Submit)</option>
                        <option value="DRAFT_SAVE">บันทึกแบบร่าง (Draft)</option>
                        <option value="UNLOCK">ปลดล็อกฟอร์ม (Unlock)</option>
                        <option value="RESET">ล้างคะแนน (Reset)</option>
                        <option value="DELETE">ลบข้อมูล (Delete)</option>
                        <option value="BACKUP">สำรองข้อมูล (Backup)</option>
                        <option value="RESTORE">กู้คืนข้อมูล (Restore)</option>
                        <option value="CONFIG">ตั้งค่าระบบ (Config)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleDownloadLogsCsv}
                        className="px-3.5 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-300" />
                        <span>ดาวน์โหลดรายงาน Log (CSV)</span>
                      </button>
                      <button
                        type="button"
                        onClick={loadAuditLogs}
                        className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                        title="รีเฟรช Log"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Audit Logs Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      พบ {auditLogsList.filter((l) => {
                        if (logActionFilter !== 'ALL' && !l.action.includes(logActionFilter)) return false;
                        if (logSearchQuery.trim()) {
                          const q = logSearchQuery.toLowerCase();
                          const matchDetails = l.details.toLowerCase().includes(q);
                          const matchActor = l.actor.toLowerCase().includes(q);
                          const matchAction = l.action.toLowerCase().includes(q);
                          const matchTarget = (l.target || '').toLowerCase().includes(q);
                          if (!matchDetails && !matchActor && !matchAction && !matchTarget) return false;
                        }
                        return true;
                      }).length} รายการ
                    </span>
                    <span className="text-[11px]">บันทึกย้อนหลัง 500 รายการล่าสุด</span>
                  </div>

                  {isLoadingLogs ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                      กำลังโหลดประวัติระบบ...
                    </div>
                  ) : auditLogsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                      ยังไม่มีประวัติการบันทึกในระบบ
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-3">วันและเวลา</th>
                            <th className="p-3">กิจกรรม</th>
                            <th className="p-3">ผู้กระทำ</th>
                            <th className="p-3">รายละเอียด</th>
                            <th className="p-3">เป้าหมาย</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {auditLogsList
                            .filter((l) => {
                              if (logActionFilter !== 'ALL' && !l.action.includes(logActionFilter)) return false;
                              if (logSearchQuery.trim()) {
                                const q = logSearchQuery.toLowerCase();
                                const matchDetails = l.details.toLowerCase().includes(q);
                                const matchActor = l.actor.toLowerCase().includes(q);
                                const matchAction = l.action.toLowerCase().includes(q);
                                const matchTarget = (l.target || '').toLowerCase().includes(q);
                                if (!matchDetails && !matchActor && !matchAction && !matchTarget) return false;
                              }
                              return true;
                            })
                            .map((log) => {
                              // Badge styling based on action
                              const isSubmit = log.action.includes('SUBMIT');
                              const isUnlock = log.action.includes('UNLOCK');
                              const isReset = log.action.includes('RESET') || log.action.includes('CLEAR');
                              const isDelete = log.action.includes('DELETE');
                              const isBackup = log.action.includes('BACKUP');
                              const isRestore = log.action.includes('RESTORE');

                              let badgeStyle = 'bg-slate-100 text-slate-800 border-slate-200';
                              if (isSubmit) badgeStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                              else if (isUnlock) badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300';
                              else if (isReset || isDelete) badgeStyle = 'bg-rose-100 text-rose-900 border-rose-300';
                              else if (isBackup || isRestore) badgeStyle = 'bg-blue-100 text-blue-900 border-blue-300';

                              return (
                                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-3 font-semibold text-slate-600 whitespace-nowrap text-[11px]">
                                    {new Date(log.timestamp).toLocaleString('th-TH')}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${badgeStyle}`}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                    {log.actor || 'ระบบ'}
                                  </td>
                                  <td className="p-3 text-slate-800 font-medium">
                                    {log.details}
                                  </td>
                                  <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                    {log.target || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Footer with Reliable Close Button */}
            <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                ปิดหน้าต่างแอดมิน
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
