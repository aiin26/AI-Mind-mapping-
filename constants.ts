
export const GEMINI_PRO_MODEL = 'gemini-2.5-pro';
export const GEMINI_FLASH_MODEL = 'gemini-2.5-flash';
export const GEMINI_LIVE_AUDIO_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export const AI_THINKING_BUDGET_PRO = 32768;
export const AI_THINKING_BUDGET_FLASH = 24576;
export const MAX_OUTPUT_TOKENS = 2000; // General purpose for generating mind map/summaries
export const SHORT_OUTPUT_TOKENS = 500; // For flashcards, pros/cons, questions

// Schema for AI-generated mind map structure
export const AI_MIND_MAP_SCHEMA = {
  type: 'object',
  properties: {
    map: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the concept or topic.' },
          subtopics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                subtopics: { type: 'array', items: { type: 'object' } }, // Recursive definition placeholder
                pros: { type: 'array', items: { type: 'string' } }, // For debate mode
                cons: { type: 'array', items: { type: 'string' } }, // For debate mode
                questions: { type: 'array', items: { type: 'string' } }, // For debate mode
              },
              required: ['title'],
            },
          },
          pros: { type: 'array', items: { type: 'string' } }, // For debate mode
          cons: { type: 'array', items: { type: 'string' } }, // For debate mode
          questions: { type: 'array', items: { type: 'string' } }, // For debate mode
        },
        required: ['title'],
      },
      description: 'An array of main topics, each with nested subtopics and optional debate points/questions.',
    },
  },
  required: ['map'],
};

export const AI_FLASHCARD_SCHEMA = {
  type: 'object',
  properties: {
    front: { type: 'string', description: 'The question or prompt for the flashcard front.' },
    back: { type: 'string', description: 'The answer or detail for the flashcard back.' },
  },
  required: ['front', 'back'],
};

export const AI_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'A concise summary of the content.' },
  },
  required: ['summary'],
};

export const AI_PROS_CONS_SCHEMA = {
  type: 'object',
  properties: {
    pros: { type: 'array', items: { type: 'string' }, description: 'List of advantages or positive points.' },
    cons: { type: 'array', items: { type: 'string' }, description: 'List of disadvantages or negative points.' },
  },
  required: ['pros', 'cons'],
};

export const AI_QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: { type: 'array', items: { type: 'string' }, description: 'List of clarifying or expanding questions.' },
  },
  required: ['questions'],
};
