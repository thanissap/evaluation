export type CompanyId = 'CLC' | 'CLFG';

export type FiscalYear = string;

export interface Director {
  key: string;
  name: string;
  title: string;
  companySpecific?: CompanyId; // if only CLC or CLFG
  isMD?: boolean;
}

export type SubCommitteeDept = 'CU' | 'IA' | 'RISK';

export interface EvaluationItem {
  id: string;
  code: string;
  category?: string;
  title: string;
  description?: string;
}

export type ScoreValueSec123 = 0 | 1 | 2 | 3 | 4 | 'NA' | null;
export type ScoreValueSec4 = 0 | 1 | 2 | 3 | 4 | 5 | null;

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED';

export interface DirectorPermissions {
  clc: {
    canEvaluateBoard: boolean;
    canEvaluateDirectors: boolean;
    canEvaluateMD: boolean;
    canEvaluateCU: boolean;
    canEvaluateIA: boolean;
    canEvaluateRISK: boolean;
  };
  clfg: {
    canEvaluateBoard: boolean;
    canEvaluateDirectors: boolean;
    canEvaluateMD: boolean;
  };
}

export interface EvaluationFormData {
  year: FiscalYear;
  company: CompanyId;
  evaluatorKey: string;
  evaluatorName: string;
  isSupervisorMode: boolean;
  supervisorName?: string;
  supervisorTitle?: string;
  supervisorDept?: SubCommitteeDept;
  selectedStaffDept?: SubCommitteeDept;
  status: SubmissionStatus;
  submittedAt?: string;
  lastSavedAt: string;

  // Answers
  section1: Record<string, ScoreValueSec123>; // Board Evaluation (27 items)
  section2: Record<string, Record<string, ScoreValueSec123>>; // Cross evaluation: [targetDirectorKey]: { [itemId]: score }
  section3: Record<string, ScoreValueSec123>; // MD Evaluation (45 items)
  section4: Record<string, Record<string, ScoreValueSec4>>; // Staff evaluation per dept: [deptId]: { [itemId]: score }

  // Comments
  section1Comment?: string;
  section2Comments?: Record<string, string>; // per target director
  section3Comment?: string;
  section4Comments?: Record<string, string>; // per dept
}

export interface CalculatedGrades {
  boardAvg: number | null;
  boardGrade: string;
  boardCount: number;
  boardTotalQuestions: number;

  directorAvg: number | null;
  directorGrade: string;
  directorEvaluatedCount: number; // how many directors evaluated
  directorTotalEligible: number;

  mdAvg: number | null;
  mdGrade: string;
  mdCount: number;
  mdTotalQuestions: number;

  staffScores: Record<string, { total: number | null; grade: string; count: number }>;
}

export interface AISynthesisResult {
  year: string;
  company: string;
  evaluator_director: string;
  acting_supervisor: string | null;
  submission_type: 'DIRECTOR_DIRECT' | 'SUPERVISOR_DELEGATED';
  evaluation_summary: {
    board_grade: string;
    self_director_grade: string;
    md_grade: string;
    staff_grade: string;
    staff_score_100: number;
  };
  governance_insights: {
    strengths: string[];
    areas_for_improvement: string[];
  };
  executive_narrative: string;
}
