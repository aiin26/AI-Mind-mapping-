
export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  parentId: string | null;
  isExpanded: boolean;
  type: MindMapNodeType;
  tags: string[];
  status?: 'task' | 'flashcard' | 'summary';
  metadata?: {
    pros?: string[];
    cons?: string[];
    questions?: string[];
    flashcard?: { front: string; back: string };
    summary?: string;
    task?: { description: string; completed: boolean; dueDate?: string };
  };
}

export enum MindMapNodeType {
  ROOT = 'ROOT',
  MAIN_TOPIC = 'MAIN_TOPIC',
  SUB_TOPIC = 'SUB_TOPIC',
  DETAIL = 'DETAIL',
}

export enum MindMapMode {
  STUDY = 'STUDY',
  PROJECT_PLANNING = 'PROJECT_PLANNING',
  DEBATE = 'DEBATE',
  GENERAL = 'GENERAL',
}

export enum InputType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  PDF = 'PDF', // For simplicity, this will extract text from PDF for AI processing
}

// For AI intermediate output (simplifies schema definition)
export interface AIMapNode {
  title: string;
  subtopics?: AIMapNode[];
  pros?: string[]; // For debate mode
  cons?: string[]; // For debate mode
  questions?: string[]; // For debate mode
}

export interface AIMindMapOutput {
  map: AIMapNode[];
}

export interface AIFlashcardOutput {
  front: string;
  back: string;
}

export interface AISummaryOutput {
  summary: string;
}

export interface AIProsConsOutput {
  pros: string[];
  cons: string[];
}

export interface AIQuestionsOutput {
  questions: string[];
}
