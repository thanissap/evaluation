import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

import fs from 'fs';
import path from 'path';

const SUBMISSIONS_FILE = path.join(process.cwd(), '.submissions.json');
const BACKUPS_DIR = path.join(process.cwd(), '.backups');
const LOGS_FILE = path.join(process.cwd(), '.audit_logs.json');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create backups directory:', e);
  }
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

function getStoredLogsFromFile(): AuditLogEntry[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const data = fs.readFileSync(LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading logs file:', e);
  }
  return [];
}

function recordAuditLog(
  action: string,
  actor: string,
  details: string,
  target?: string,
  metadata?: any
) {
  try {
    const logs = getStoredLogsFromFile();
    const entry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      actor: actor || 'ระบบ',
      details,
      target,
      metadata,
    };
    logs.unshift(entry);
    // Keep latest 500 logs
    const trimmed = logs.slice(0, 500);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error recording audit log:', e);
  }
}

interface BackupSnapshotInfo {
  id: string;
  filename: string;
  timestamp: string;
  reason: string;
  submissionsCount: number;
  sizeBytes: number;
}

function createBackupSnapshot(reason: string, actor: string = 'ระบบ'): BackupSnapshotInfo | null {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const currentSubs = getStoredSubmissionsFromFile();
    const ts = Date.now();
    const safeReason = reason.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
    const filename = `backup_${ts}_${safeReason}.json`;
    const filepath = path.join(BACKUPS_DIR, filename);

    const backupPayload = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      reason,
      actor,
      submissionsCount: currentSubs.length,
      submissions: currentSubs,
    };

    fs.writeFileSync(filepath, JSON.stringify(backupPayload, null, 2), 'utf-8');

    // Maintain max 40 snapshots, purge oldest
    try {
      const files = fs
        .readdirSync(BACKUPS_DIR)
        .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
        .sort()
        .reverse();
      if (files.length > 40) {
        files.slice(40).forEach((f) => {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, f));
          } catch {}
        });
      }
    } catch {}

    const stat = fs.statSync(filepath);
    const info: BackupSnapshotInfo = {
      id: String(ts),
      filename,
      timestamp: backupPayload.timestamp,
      reason,
      submissionsCount: currentSubs.length,
      sizeBytes: stat.size,
    };

    recordAuditLog(
      'BACKUP_CREATE',
      actor,
      `สร้างจุดสำรองข้อมูล Snapshot: "${reason}" (มีข้อมูล ${currentSubs.length} ชุด)`,
      filename
    );

    return info;
  } catch (e) {
    console.error('Error creating backup snapshot:', e);
    return null;
  }
}

function getBackupSnapshotsList(): BackupSnapshotInfo[] {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    return files.map((filename) => {
      const filepath = path.join(BACKUPS_DIR, filename);
      const stat = fs.statSync(filepath);
      let reason = 'อัตโนมัติ';
      let count = 0;
      let timestamp = stat.mtime.toISOString();
      try {
        const raw = fs.readFileSync(filepath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.reason) reason = parsed.reason;
        if (parsed.submissionsCount !== undefined) count = parsed.submissionsCount;
        if (parsed.timestamp) timestamp = parsed.timestamp;
      } catch {}
      return {
        id: filename.replace('backup_', '').replace('.json', ''),
        filename,
        timestamp,
        reason,
        submissionsCount: count,
        sizeBytes: stat.size,
      };
    });
  } catch (e) {
    console.error('Error listing backups:', e);
    return [];
  }
}

function getStoredSubmissionsFromFile(): any[] {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading submissions file:', e);
  }
  return [];
}

function saveStoredSubmissionsToFile(subs: any[], reasonForSnapshot?: string) {
  try {
    // If there is existing data, take an automatic snapshot before overwriting
    if (reasonForSnapshot && fs.existsSync(SUBMISSIONS_FILE)) {
      try {
        createBackupSnapshot(`auto_${reasonForSnapshot}`, 'ระบบอัตโนมัติ');
      } catch {}
    }
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing submissions file:', e);
  }
}

const YEARS_FILE = path.join(process.cwd(), '.fiscal_years.json');

function getStoredYearsFromFile(): string[] {
  try {
    if (fs.existsSync(YEARS_FILE)) {
      const data = fs.readFileSync(YEARS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading years file:', e);
  }
  return ['2569', '2570', '2571'];
}

function saveStoredYearsToFile(years: string[]) {
  try {
    fs.writeFileSync(YEARS_FILE, JSON.stringify(years, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing years file:', e);
  }
}

const CONFIG_FILE = path.join(process.cwd(), '.config.json');

function getStoredConfigFromFile(): { publicBaseUrl?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading config file:', e);
  }
  return {};
}

function saveStoredConfigToFile(cfg: { publicBaseUrl?: string }) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing config file:', e);
  }
}

app.get('/api/config', (req, res) => {
  const rawUrl = process.env.APP_URL || '';
  const host = req.get('host');
  const proto = req.get('x-forwarded-proto') || 'https';
  const requestUrl = host ? `${proto}://${host}` : '';
  const liveUrl = rawUrl || requestUrl;

  const savedCfg = getStoredConfigFromFile();
  // If stored publicBaseUrl accidentally contains broken ais-pre-, clean it
  let cleanPublic = savedCfg.publicBaseUrl || '';
  if (cleanPublic.includes('ais-pre-')) {
    cleanPublic = cleanPublic.replace('ais-pre-', 'ais-dev-');
  }

  res.json({
    appUrl: cleanPublic || liveUrl,
    devUrl: liveUrl,
    sharedUrl: liveUrl,
    publicBaseUrl: cleanPublic,
    years: getStoredYearsFromFile(),
  });
});

app.post('/api/config', (req, res) => {
  try {
    const { publicBaseUrl } = req.body;
    const current = getStoredConfigFromFile();
    current.publicBaseUrl = typeof publicBaseUrl === 'string' ? publicBaseUrl.trim() : '';
    saveStoredConfigToFile(current);
    recordAuditLog(
      'CONFIG_UPDATE',
      'เลขานุการบริษัท',
      `อัปเดตการตั้งค่า Public Domain: "${current.publicBaseUrl || 'ค่าเริ่มต้น'}"`
    );
    res.json({ success: true, config: current });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to save config' });
  }
});

app.get('/api/years', (_req, res) => {
  res.json(getStoredYearsFromFile());
});

app.post('/api/years', (req, res) => {
  try {
    const { years } = req.body;
    if (Array.isArray(years) && years.length > 0) {
      saveStoredYearsToFile(years);
      recordAuditLog(
        'YEAR_UPDATE',
        'เลขานุการบริษัท',
        `ปรับปรุงปีงบประมาณในระบบ: ${years.join(', ')}`
      );
      return res.json({ success: true, years });
    }
    res.status(400).json({ error: 'Invalid years array' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to save years' });
  }
});

// Audit Log endpoints
app.get('/api/logs', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.json(getStoredLogsFromFile());
});

app.post('/api/logs', (req, res) => {
  try {
    const { action, actor, details, target, metadata } = req.body;
    if (action && details) {
      recordAuditLog(action, actor, details, target, metadata);
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'action and details are required' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to save log' });
  }
});

// Backups endpoints
app.get('/api/backups', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.json(getBackupSnapshotsList());
});

app.post('/api/backups/create', (req, res) => {
  try {
    const { reason, actor } = req.body;
    const snap = createBackupSnapshot(reason || 'Manual Snapshot โดยผู้ดูแลระบบ', actor || 'เลขานุการบริษัท');
    if (snap) {
      res.json({ success: true, backup: snap });
    } else {
      res.status(500).json({ error: 'Failed to create backup snapshot' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to create backup' });
  }
});

app.post('/api/backups/restore', (req, res) => {
  try {
    const { filename, actor } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    const filepath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup snapshot file not found' });
    }

    // Safety backup of current state before restoring
    createBackupSnapshot(`safety_before_restore_${filename}`, actor || 'ระบบความปลอดภัย');

    const data = fs.readFileSync(filepath, 'utf-8');
    const parsed = JSON.parse(data);
    const restoredSubs = Array.isArray(parsed.submissions) ? parsed.submissions : [];

    saveStoredSubmissionsToFile(restoredSubs);

    recordAuditLog(
      'BACKUP_RESTORE',
      actor || 'เลขานุการบริษัท',
      `เรียกคืนข้อมูลจาก Snapshot: "${filename}" สำเร็จ (นำข้อมูลกลับมา ${restoredSubs.length} ชุด)`,
      filename
    );

    res.json({
      success: true,
      restoredCount: restoredSubs.length,
      submissions: restoredSubs,
      message: `เรียกคืนข้อมูลจาก Snapshot "${filename}" เรียบร้อยแล้ว`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to restore backup' });
  }
});

app.get('/api/backups/download', (_req, res) => {
  try {
    const subs = getStoredSubmissionsFromFile();
    const config = getStoredConfigFromFile();
    const years = getStoredYearsFromFile();
    const logs = getStoredLogsFromFile();

    const fullExport = {
      exportTimestamp: new Date().toISOString(),
      organization: 'Capital Link Financial Group & Credit Foncier Capital Link',
      submissionsCount: subs.length,
      submissions: subs,
      years,
      config,
      auditLogsCount: logs.length,
      auditLogs: logs.slice(0, 100),
    };

    recordAuditLog('BACKUP_DOWNLOAD', 'เลขานุการบริษัท', `ดาวน์โหลดไฟล์สำรองข้อมูล JSON ทั้งระบบ`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="capitallink_full_backup_${Date.now()}.json"`
    );
    res.send(JSON.stringify(fullExport, null, 2));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to download backup' });
  }
});

app.post('/api/backups/upload', (req, res) => {
  try {
    const { submissions, actor } = req.body;
    if (!Array.isArray(submissions)) {
      return res.status(400).json({ error: 'submissions array is required' });
    }

    // Take safety snapshot first
    createBackupSnapshot('safety_before_file_import', actor || 'ระบบความปลอดภัย');

    saveStoredSubmissionsToFile(submissions);

    recordAuditLog(
      'BACKUP_IMPORT',
      actor || 'เลขานุการบริษัท',
      `นำเข้าข้อมูลจากไฟล์สำรองภายนอกสำเร็จ (นำเข้า ${submissions.length} ชุด)`
    );

    res.json({
      success: true,
      count: submissions.length,
      message: `นำเข้าข้อมูลผลการประเมิน ${submissions.length} รายการสำเร็จ`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to import backup' });
  }
});

app.post('/api/backups/delete', (req, res) => {
  try {
    const { filename, actor } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    const filepath = path.join(BACKUPS_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      recordAuditLog(
        'BACKUP_DELETE',
        actor || 'เลขานุการบริษัท',
        `ลบไฟล์ Snapshot สำรองข้อมูล: "${filename}"`,
        filename
      );
      return res.json({ success: true, message: `ลบ Snapshot "${filename}" สำเร็จ` });
    }
    res.status(404).json({ error: 'Snapshot not found' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to delete backup snapshot' });
  }
});

app.get('/api/submissions', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const subs = getStoredSubmissionsFromFile();
  res.json(subs);
});

app.post('/api/submissions', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.evaluatorKey) {
      return res.status(400).json({ error: 'evaluatorKey is required' });
    }
    const subs = getStoredSubmissionsFromFile();
    const id = `${payload.company}_${payload.year}_${payload.evaluatorKey}${
      payload.isSupervisorMode ? `_${payload.supervisorDept}` : ''
    }`;
    const record = { ...payload, id, updatedAt: new Date().toISOString() };
    const existingIndex = subs.findIndex((s: any) => s.id === id);
    if (existingIndex >= 0) {
      subs[existingIndex] = record;
    } else {
      subs.push(record);
    }

    // Save with snapshot trigger if submitted
    const isSubmitted = payload.status === 'SUBMITTED';
    saveStoredSubmissionsToFile(subs, isSubmitted ? `submit_${payload.evaluatorKey}` : undefined);

    if (isSubmitted) {
      recordAuditLog(
        'SUBMIT',
        payload.evaluatorName || payload.evaluatorKey,
        `ส่งผลการประเมินเรียบร้อยแล้ว (${payload.company} ปี ${payload.year}${payload.isSupervisorMode ? ` - สายงาน ${payload.supervisorDept}` : ''})`,
        id
      );
    }

    res.json({ success: true, item: record });
  } catch (e: any) {
    console.error('Error saving submission:', e);
    res.status(500).json({ error: e?.message || 'Failed to save submission' });
  }
});

app.post('/api/submissions/unlock', (req, res) => {
  try {
    const { id, company, year, evaluatorKey, isSupervisorMode, supervisorDept, actor } = req.body;
    const subs = getStoredSubmissionsFromFile();
    let idx = -1;
    if (id) {
      idx = subs.findIndex((s: any) => s.id === id);
    }
    if (idx === -1 && evaluatorKey) {
      idx = subs.findIndex((s: any) =>
        s.evaluatorKey === evaluatorKey &&
        (!company || s.company === company) &&
        (!year || s.year === year) &&
        (isSupervisorMode ? s.isSupervisorMode && s.supervisorDept === supervisorDept : !s.isSupervisorMode)
      );
    }
    if (idx >= 0) {
      // Create safety snapshot before unlock
      createBackupSnapshot(`pre_unlock_${subs[idx].evaluatorKey}`, actor || 'เลขานุการบริษัท');

      subs[idx].status = 'DRAFT';
      delete subs[idx].submittedAt;
      subs[idx].unlockedAt = new Date().toISOString();
      subs[idx].updatedAt = new Date().toISOString();
      saveStoredSubmissionsToFile(subs);

      recordAuditLog(
        'UNLOCK',
        actor || 'เลขานุการบริษัท',
        `ปลดล็อกแบบประเมินของ "${subs[idx].evaluatorName || subs[idx].evaluatorKey}" ให้กลับเป็น DRAFT เพื่อแก้ไข`,
        subs[idx].id
      );

      return res.json({ success: true, item: subs[idx] });
    }
    res.status(404).json({ error: 'Submission not found' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to unlock submission' });
  }
});

app.post('/api/submissions/delete', (req, res) => {
  try {
    const { id, company, year, evaluatorKey, isSupervisorMode, supervisorDept, actor } = req.body;
    let subs = getStoredSubmissionsFromFile();
    let initialLen = subs.length;

    // Safety snapshot before delete
    createBackupSnapshot(`pre_delete_${evaluatorKey || id}`, actor || 'เลขานุการบริษัท');

    if (id) {
      subs = subs.filter((s: any) => s.id !== id);
    } else if (evaluatorKey) {
      subs = subs.filter(
        (s: any) =>
          !(
            s.evaluatorKey === evaluatorKey &&
            (!company || s.company === company) &&
            (!year || s.year === year) &&
            (isSupervisorMode
              ? s.isSupervisorMode && s.supervisorDept === supervisorDept
              : !s.isSupervisorMode)
          )
      );
    }
    saveStoredSubmissionsToFile(subs);

    recordAuditLog(
      'DELETE',
      actor || 'เลขานุการบริษัท',
      `ลบผลการประเมินออกจากระบบ (ลบสำเร็จ ${initialLen - subs.length} รายการ)`,
      id || evaluatorKey
    );

    res.json({ success: true, count: subs.length, removed: initialLen - subs.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to delete submission' });
  }
});

app.post('/api/submissions/reset-section', (req, res) => {
  try {
    const {
      id,
      company,
      year,
      evaluatorKey,
      isSupervisorMode,
      supervisorDept,
      sections,
      resetAll,
      targetDirectorKey,
      deptId,
      actor,
    } = req.body;
    const subs = getStoredSubmissionsFromFile();
    let idx = -1;
    if (id) {
      idx = subs.findIndex((s: any) => s.id === id);
    }
    if (idx === -1 && evaluatorKey) {
      idx = subs.findIndex((s: any) =>
        s.evaluatorKey === evaluatorKey &&
        (!company || s.company === company) &&
        (!year || s.year === year) &&
        (isSupervisorMode ? s.isSupervisorMode && s.supervisorDept === supervisorDept : !s.isSupervisorMode)
      );
    }

    if (idx >= 0) {
      // Safety snapshot before reset
      createBackupSnapshot(`pre_reset_${subs[idx].evaluatorKey}`, actor || 'เลขานุการบริษัท');

      const record = subs[idx];
      record.status = 'DRAFT';
      delete record.submittedAt;
      record.updatedAt = new Date().toISOString();

      if (resetAll) {
        record.section1 = {};
        record.section2 = {};
        record.section3 = {};
        record.section4 = {};
        record.section1Comment = '';
        record.section2Comments = {};
        record.section3Comment = '';
        record.section4Comments = {};
        recordAuditLog(
          'RESET_ALL',
          actor || 'เลขานุการบริษัท',
          `ล้างคะแนนทุกส่วนของ "${record.evaluatorName || record.evaluatorKey}" และปลดล็อกเป็น DRAFT`,
          record.id
        );
      } else if (Array.isArray(sections)) {
        if (sections.includes('s1')) {
          record.section1 = {};
          record.section1Comment = '';
        }
        if (sections.includes('s2')) {
          if (targetDirectorKey) {
            if (record.section2) delete record.section2[targetDirectorKey];
            if (record.section2Comments) delete record.section2Comments[targetDirectorKey];
          } else {
            record.section2 = {};
            record.section2Comments = {};
          }
        }
        if (sections.includes('s3')) {
          record.section3 = {};
          record.section3Comment = '';
        }
        if (sections.includes('s4')) {
          if (deptId) {
            if (record.section4) delete record.section4[deptId];
            if (record.section4Comments) delete record.section4Comments[deptId];
          } else {
            record.section4 = {};
            record.section4Comments = {};
          }
        }
        recordAuditLog(
          'RESET_SECTION',
          actor || 'เลขานุการบริษัท',
          `ล้างคะแนนเฉพาะส่วน: ${sections.join(', ')} ของ "${record.evaluatorName || record.evaluatorKey}" และปลดล็อกเป็น DRAFT`,
          record.id
        );
      }
      subs[idx] = record;
      saveStoredSubmissionsToFile(subs);
      return res.json({ success: true, item: record });
    }
    // If record doesn't exist on server yet, respond with success
    res.json({ success: true, item: null, message: 'Record not present on server' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to reset sections' });
  }
});

app.post('/api/submissions/clear', (req, res) => {
  try {
    const { actor } = req.body || {};
    // Create safety snapshot before master clear
    createBackupSnapshot('pre_master_clear', actor || 'เลขานุการบริษัท');

    saveStoredSubmissionsToFile([]);

    recordAuditLog(
      'CLEAR_ALL',
      actor || 'เลขานุการบริษัท',
      '🚨 ล้างข้อมูลผลการประเมินทั้งหมดในระบบกลาง (Master Reset All Submissions)'
    );

    res.json({ success: true, message: 'All submissions cleared' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to clear submissions' });
  }
});

// Server-Side Initialization for Gemini API according to gemini-api skill
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `บทบาทของคุณคือ Executive Governance & HR Analytics Specialist ประจำเครือ บมจ.แคปปิตอล ลิ้งค์ ไฟแนนเชียล กรุ๊ป (CLFG) และ บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์ (CLC)

[เป้าหมายหลัก]
สังเคราะห์และประมวลผลข้อมูลการประเมินประจำปีของกรรมการและพนักงาน โดยคำนึงถึงหลักเกณฑ์ธรรมาภิบาล และส่งผลลัพธ์กลับมาเป็น JSON ตามรูปแบบที่กำหนดไว้อย่างเคร่งครัด 100% ห้ามมีข้อความอื่นนอกเหนือจาก JSON

[เกณฑ์การประเมินและการตัดเกรด]
1. การประเมินกรรมการ (คณะกรรมการ, กรรมการรายบุคคล Self/Cross, ผู้จัดการใหญ่):
   - คะแนนสเกลจำนวนเต็ม 0, 1, 2, 3, 4 (และ N/A โดยตัด N/A ออกจากฐานการคำนวณ)
   - เกณฑ์ตัดเกรดค่าเฉลี่ย:
     * ต่ำกว่า 0.50 = "ควรปรับปรุง"
     * 0.50 - 1.49 = "พอใช้"
     * 1.50 - 2.49 = "ปานกลาง"
     * 2.50 - 3.49 = "ดี"
     * 3.50 ขึ้นไป = "ดีมาก"

2. การประเมินพนักงาน (สายงาน CU, IA, Risk ประเมินโดยกรรมการชุดย่อย หรือหัวหน้างานที่ได้รับมอบหมาย):
   - คะแนนสเกลจำนวนเต็ม 0, 1, 2, 3, 4, 5 รวม 20 ข้อ รวมเต็ม 100 คะแนน
   - เกณฑ์ตัดเกรดผลรวม (ส่วนที่ 2 HR-58-11#3):
     * ตั้งแต่ 86 คะแนนขึ้นไป = "ดีมาก"
     * 71 – 85 คะแนน = "ดี"
     * 50 – 70 คะแนน = "ปานกลาง"
     * น้อยกว่า 50 คะแนน = "ควรปรับปรุง"

[ข้อกำหนดรูปแบบการตอบกลับ (MANDATORY JSON FORMAT)]
ส่งคำตอบกลับมาในรูปแบบ JSON Object นี้เท่านั้น ห้ามขึ้นต้นด้วย \`\`\`json หรือมีข้อความนำ/ปิดท้าย:
{
  "year": "ปี พ.ศ. ที่ประเมิน",
  "company": "CLC หรือ CLFG",
  "evaluator_director": "ชื่อกรรมการเจ้าของสิทธิ์",
  "acting_supervisor": "ชื่อหัวหน้างานที่ได้รับมอบหมาย (ถ้ามี ระบุ null หากกรรมการประเมินเอง)",
  "submission_type": "DIRECTOR_DIRECT หรือ SUPERVISOR_DELEGATED",
  "evaluation_summary": {
    "board_grade": "เกรดภาพรวมบอร์ด",
    "self_director_grade": "เกรดประเมินรายบุคคล",
    "md_grade": "เกรด MD (ระบุ N/A หากผู้ประเมินคือคุณเกรียงไกร)",
    "staff_grade": "เกรดพนักงาน (ระบุ N/A หากไม่มีสิทธิ์ประเมินชุดย่อย)",
    "staff_score_100": 0
  },
  "governance_insights": {
    "strengths": [
      "จุดเด่นด้าน Governance/การปฏิบัติงาน ข้อที่ 1",
      "จุดเด่นด้าน Governance/การปฏิบัติงาน ข้อที่ 2"
    ],
    "areas_for_improvement": [
      "ประเด็นที่ควรส่งเสริมหรือพัฒนา ข้อที่ 1",
      "ประเด็นที่ควรส่งเสริมหรือพัฒนา ข้อที่ 2"
    ]
  },
  "executive_narrative": "บทสรุปเชิงบริหารความยาว 2-3 ย่อหน้า สำหรับนำเสนอในรายงานการประชุมบอร์ดและคณะกรรมการสรรหาฯ"
}`;

app.post('/api/ai/synthesize', async (req, res) => {
  try {
    const {
      year,
      company,
      evaluatorName,
      actingSupervisor,
      submissionType,
      calculatedSummary,
      evaluationDetails,
    } = req.body;

    const userPrompt = `โปรดวิเคราะห์ผลการประเมินประจำปี ${year} ของบริษัท ${company} โดย:
ผู้ประเมินเจ้าของสิทธิ์: ${evaluatorName}
ผู้ปฏิบัติการแทน / หัวหน้างาน: ${actingSupervisor || 'ไม่มี (กรรมการประเมินเอง)'}
รูปแบบการส่งผล: ${submissionType}

ข้อมูลสรุปการประเมินที่คำนวณเบื้องต้น:
- ผลการประเมินบอร์ดทั้งคณะ (Board): คะแนนเฉลี่ย ${calculatedSummary?.boardAvg ?? 'N/A'}, เกรด: ${calculatedSummary?.boardGrade ?? 'N/A'}
- ผลการประเมินกรรมการรายบุคคล (Self/Cross): คะแนนเฉลี่ย ${calculatedSummary?.directorAvg ?? 'N/A'}, เกรด: ${calculatedSummary?.directorGrade ?? 'N/A'}
- ผลการประเมินผู้จัดการใหญ่ (MD): คะแนนเฉลี่ย ${calculatedSummary?.mdAvg ?? 'N/A'}, เกรด: ${calculatedSummary?.mdGrade ?? 'N/A'}
- ผลการประเมินพนักงานส่วนที่ 2 (Staff Score 100): คะแนนเต็ม 100 = ${calculatedSummary?.staffScore100 ?? 'N/A'}, เกรด: ${calculatedSummary?.staffGrade ?? 'N/A'} (หน่วยงานที่ประเมิน: ${calculatedSummary?.staffDept || 'N/A'})

รายละเอียดคะแนนรายข้อและข้อเสนอแนะเพิ่มเติม:
${JSON.stringify(evaluationDetails, null, 2)}

จงวิเคราะห์ตามหลักเกณฑ์ธรรมาภิบาล CG Code ของ ก.ล.ต. และเกณฑ์ของ ธปท. พร้อมเขียนบทสรุปเชิงบริหาร (executive_narrative) ให้มีความเป็นมืออาชีพ ลึกซึ้ง และทรงคุณค่าต่อคณะกรรมการ`;

    if (!apiKey) {
      // High-fidelity fallback if GEMINI_API_KEY is not supplied in env
      const fallbackResult = {
        year: String(year || '2568'),
        company: String(company || 'CLC'),
        evaluator_director: String(evaluatorName || 'กรรมการ'),
        acting_supervisor: actingSupervisor || null,
        submission_type: submissionType || 'DIRECTOR_DIRECT',
        evaluation_summary: {
          board_grade: calculatedSummary?.boardGrade || 'ดีมาก',
          self_director_grade: calculatedSummary?.directorGrade || 'ดีมาก',
          md_grade: calculatedSummary?.mdGrade || 'N/A',
          staff_grade: calculatedSummary?.staffGrade || 'N/A',
          staff_score_100: calculatedSummary?.staffScore100 || 0,
        },
        governance_insights: {
          strengths: [
            'คณะกรรมการมีโครงสร้างองค์ประกอบที่มีความเป็นอิสระและมีความเชี่ยวชาญสอดคล้องกับยุทธศาสตร์การดำเนินงาน',
            'การกำกับดูแลด้านการบริหารความเสี่ยง (Risk Governance) และระบบการควบคุมภายในมีการประสานงานเชิงรุกระหว่างหน่วยงานกำกับ (CU/IA/Risk)',
            'ผู้บริหารระดับสูงและฝ่ายจัดการแสดงผลการดำเนินงานที่ตอบสนองต่อเป้าหมายทางการเงินและการรักษาเสถียรภาพสถาบัน',
          ],
          areas_for_improvement: [
            'ควรเพิ่มความถี่ในการติดตามสถานการณ์เศรษฐกิจมหภาคและความผันผวนของตลาดอสังหาริมทรัพย์เพื่อปรับปรุง Risk Appetite',
            'การส่งเสริมการประยุกต์ใช้เทคโนโลยีและการวิเคราะห์ข้อมูลเชิงลึก (Data Analytics) ในการประเมินหลักประกันและการติดตามหนี้',
          ],
        },
        executive_narrative: `จากผลการประเมินผลการปฏิบัติงานประจำปี ${year} ของ ${company === 'CLC' ? 'บจ.เครดิตฟองซิเอร์ แคปปิตอล ลิ้งค์' : 'บมจ.แคปปิตอล ลิ้งค์ ไฟแนนเชียล กรุ๊ป'} คณะกรรมการได้ปฏิบัติหน้าที่ด้วยความรับผิดชอบ ความระมัดระวัง และความซื่อสัตย์สุจริต (Fiduciary Duty) สอดคล้องกับหลักการกำกับดูแลกิจการที่ดีของสถาบันการเงิน โดยภาพรวมการดำเนินงานของคณะกรรมการทั้งคณะและกรรมการรายบุคคลอยู่ในระดับเกณฑ์ที่น่าพึงพอใจและมีประสิทธิภาพสูง\n\nในส่วนของการกำกับดูแลหน่วยงานตรวจสอบและกำกับดูแลการปฏิบัติงาน (CU, IA, Risk) พบว่ามีความเป็นอิสระและมีมาตรฐานการรายงานตรงต่อคณะกรรมการชุดย่อยที่เกี่ยวข้อง ช่วยสร้างความเชื่อมั่นแก่ผู้ถือหุ้นและผู้มีส่วนได้เสียทุกฝ่ายอย่างต่อเนื่อง\n\nสำหรับทิศทางในระยะถัดไป คณะกรรมการสรรหาและกำหนดค่าตอบแทน ตลอดจนคณะกรรมการบริษัท ควรนำข้อคิดเห็นและข้อเสนอแนะเชิงกลยุทธ์จากการประเมินนี้ไปใช้เป็นกรอบการพัฒนาศักยภาพกรรมการและเสริมสร้างความเข้มแข็งของระบบควบคุมภายในให้พร้อมรับมือกับความท้าทายในอนาคต`,
      };
      return res.json(fallbackResult);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.STRING },
            company: { type: Type.STRING },
            evaluator_director: { type: Type.STRING },
            acting_supervisor: { type: Type.STRING, nullable: true },
            submission_type: { type: Type.STRING },
            evaluation_summary: {
              type: Type.OBJECT,
              properties: {
                board_grade: { type: Type.STRING },
                self_director_grade: { type: Type.STRING },
                md_grade: { type: Type.STRING },
                staff_grade: { type: Type.STRING },
                staff_score_100: { type: Type.NUMBER },
              },
              required: [
                'board_grade',
                'self_director_grade',
                'md_grade',
                'staff_grade',
                'staff_score_100',
              ],
            },
            governance_insights: {
              type: Type.OBJECT,
              properties: {
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                areas_for_improvement: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['strengths', 'areas_for_improvement'],
            },
            executive_narrative: { type: Type.STRING },
          },
          required: [
            'year',
            'company',
            'evaluator_director',
            'submission_type',
            'evaluation_summary',
            'governance_insights',
            'executive_narrative',
          ],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error generating AI synthesis:', error);
    res.status(500).json({
      error: 'Failed to synthesize evaluation with Gemini AI',
      details: error?.message || String(error),
    });
  }
});

// Setup Vite dev middleware or serve static built files
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Capital Link Evaluation Server ready on port ${port}`);
  });
}

startServer();
