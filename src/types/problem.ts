export interface OcrResult {
  text: string;
  rawText?: string;
  confidence?: number;
  source: 'ocr' | 'document-parse' | 'combined';
}

export interface ProblemStructure {
  problem_text: string;
  question: string;
  conditions: string[];
  choices: string[];
  equations: string[];
  has_graph: boolean;
  has_table: boolean;
  ocr_uncertain_parts: string[];
}

export interface SolutionStep {
  step: number;
  title: string;
  explanation: string;
  equation?: string;
}

export interface Concept {
  name: string;
  explanation: string;
}

export interface SolutionResult {
  problem_summary: string;
  solution_steps: SolutionStep[];
  final_answer: string;
  key_concepts: Concept[];
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  uncertainParts?: string[];
}
