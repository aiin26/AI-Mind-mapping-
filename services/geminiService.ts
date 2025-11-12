import { GoogleGenAI, Modality, FunctionDeclaration, Type, GenerateContentResponse, Schema } from "@google/genai";
import {
  GEMINI_PRO_MODEL,
  GEMINI_FLASH_MODEL,
  GEMINI_LIVE_AUDIO_MODEL,
  AI_THINKING_BUDGET_PRO,
  MAX_OUTPUT_TOKENS,
  SHORT_OUTPUT_TOKENS,
  AI_MIND_MAP_SCHEMA,
  AI_FLASHCARD_SCHEMA,
  AI_SUMMARY_SCHEMA,
  AI_PROS_CONS_SCHEMA,
  AI_QUESTIONS_SCHEMA,
} from '../constants';
import {
  AIMindMapOutput,
  MindMapMode,
  AIFlashcardOutput,
  AISummaryOutput,
  AIProsConsOutput,
  AIQuestionsOutput,
} from '../types';

let audioInputContext: AudioContext | null = null;

// Helper function to base64 encode a Uint8Array
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to decode a base64 string to Uint8Array
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const createGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getModelForMode = (mode: MindMapMode) => {
  switch (mode) {
    case MindMapMode.STUDY:
    case MindMapMode.PROJECT_PLANNING:
    case MindMapMode.DEBATE:
      return GEMINI_PRO_MODEL; // Pro for more complex reasoning in specific modes
    case MindMapMode.GENERAL:
    default:
      return GEMINI_FLASH_MODEL;
  }
};

const getSystemInstructionForMode = (mode: MindMapMode, inputContent: string, existingMapJson?: string): string => {
  let baseInstruction = `You are an expert mind map generator. Your task is to extract key concepts and their relationships from the provided content and represent them as a hierarchical mind map in JSON format. Each node should have a 'title' (the concept's title) and an optional 'subtopics' array (containing more nested nodes, each with 'title' and 'subtopics'). Focus on creating a logical, organized, and concise structure, making sure the hierarchy is clear. Aim for 2-3 levels of depth initially. Do not include any other text or explanation, only the JSON.`;

  if (existingMapJson) {
    baseInstruction += `\n\nExisting Mind Map Context: ${existingMapJson}\n\nBased on the user's new input and the existing map, either add new relevant concepts, refine existing ones, or adjust the structure to better integrate the new information. Ensure consistency with the existing map's structure where appropriate.`;
  }

  switch (mode) {
    case MindMapMode.STUDY:
      return baseInstruction + ` For 'STUDY' mode, prioritize terms, definitions, key theories, and relationships that facilitate learning and memorization.`;
    case MindMapMode.PROJECT_PLANNING:
      return baseInstruction + ` For 'PROJECT PLANNING' mode, identify tasks, milestones, deliverables, resources, and dependencies.`;
    case MindMapMode.DEBATE:
      return baseInstruction + ` For 'DEBATE' mode, identify main arguments, counter-arguments, key points, and potential questions. For each main argument, include 'pros' and 'cons' arrays.`;
    case MindMapMode.GENERAL:
    default:
      return baseInstruction + ` For 'GENERAL' mode, provide a balanced overview of the main concepts.`;
  }
};

const getResponseSchemaForMode = (mode: MindMapMode): Schema => {
  // Deep copy the base schema to allow modification for debate mode
  const schema = JSON.parse(JSON.stringify(AI_MIND_MAP_SCHEMA));
  if (mode === MindMapMode.DEBATE && schema.properties.map.items.properties) {
      // Add pros/cons/questions directly to the main topic items
      schema.properties.map.items.properties.pros = { type: 'array', items: { type: 'string' } };
      schema.properties.map.items.properties.cons = { type: 'array', items: { type: 'string' } };
      schema.properties.map.items.properties.questions = { type: 'array', items: { type: 'string' } };

      // Also add to subtopics (assuming AIMapNode structure for subitems)
      if (schema.properties.map.items.properties.subtopics && schema.properties.map.items.properties.subtopics.items) {
          const subtopicItemsProperties = (schema.properties.map.items.properties.subtopics.items as any).properties;
          if (subtopicItemsProperties) {
              subtopicItemsProperties.pros = { type: 'array', items: { type: 'string' } };
              subtopicItemsProperties.cons = { type: 'array', items: { type: 'string' } };
              subtopicItemsProperties.questions = { type: 'array', items: { type: 'string' } };
          }
      }
  }
  return schema as Schema;
};

export async function generateMindMapStructure(
  inputContent: string,
  mode: MindMapMode,
  existingMapJson?: string
): Promise<AIMindMapOutput | null> {
  try {
    const ai = createGeminiClient();
    const model = getModelForMode(mode);
    const systemInstruction = getSystemInstructionForMode(mode, inputContent, existingMapJson);

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: inputContent }] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: getResponseSchemaForMode(mode),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: AI_THINKING_BUDGET_PRO },
      },
    });

    const text = response.text;
    if (text) {
      try {
        const parsedJson: AIMindMapOutput = JSON.parse(text);
        return parsedJson;
      } catch (jsonError) {
        console.error('Failed to parse JSON from AI response:', jsonError);
        console.error('AI Raw Response:', text);
        // Fallback for AI not adhering to JSON (very rare with responseMimeType/responseSchema)
        const simplifiedResponse = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: `Re-format this text into a clean JSON array of {title: string, subtopics: array} mind map structure: ${text}` }] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: getResponseSchemaForMode(mode),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        });
        if (simplifiedResponse.text) {
            try {
                return JSON.parse(simplifiedResponse.text);
            } catch (secondJsonError) {
                console.error('Second attempt to parse JSON failed:', secondJsonError);
                return null;
            }
        }
        return null;
      }
    }
    return null;
  } catch (error: any) {
    console.error('Error generating mind map structure:', error);
    // Specific error handling for "Requested entity was not found." (Veo API key related)
    if (error.message && error.message.includes("Requested entity was not found.") && (window as any).aistudio && (window as any).aistudio.openSelectKey) {
        alert("Your API key might be invalid or not selected. Please select a valid API key.");
        await (window as any).aistudio.openSelectKey();
    }
    throw error;
  }
}

// Fix: Refactored transcribeAudio to properly handle session management and adhere to guidelines
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const ai = createGeminiClient();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (reader.result) {
        const base64Audio = (reader.result as string).split(',')[1];
        let transcriptionHandled = false; // Flag to ensure promise is resolved or rejected only once

        try {
          const sessionPromise = ai.live.connect({
            model: GEMINI_LIVE_AUDIO_MODEL,
            callbacks: {
              onopen: () => {
                // As per guidelines, sendRealtimeInput must be called after sessionPromise resolves, not here.
              },
              onmessage: async (message) => {
                if (message.serverContent?.inputTranscription?.text) {
                  if (!transcriptionHandled) {
                    transcriptionHandled = true;
                    resolve(message.serverContent.inputTranscription.text);
                    // Close the session after successfully getting transcription
                    sessionPromise.then(session => session.close());
                  }
                } else if (message.serverContent?.turnComplete) {
                  // If turnComplete arrives and no transcription text was received, resolve with empty string
                  if (!transcriptionHandled) {
                    transcriptionHandled = true;
                    resolve('');
                    sessionPromise.then(session => session.close());
                  }
                }
              },
              onerror: (e) => {
                if (!transcriptionHandled) {
                  transcriptionHandled = true;
                  reject(new Error(`Live API error: ${e.message}`));
                  sessionPromise.then(session => session.close());
                }
              },
              onclose: () => {
                // If the connection closes and we haven't resolved/rejected yet, it's an issue
                if (!transcriptionHandled) {
                  transcriptionHandled = true;
                  reject(new Error('Live API connection closed before transcription complete.'));
                }
              },
            },
            config: {
              responseModalities: [Modality.AUDIO], // Required for Live API
              inputAudioTranscription: {}, // Enable transcription
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, // Required but not used for transcription only
              },
            },
          });

          // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`
          sessionPromise.then((session) => {
            session.sendRealtimeInput({
              media: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' }
            });
            // No explicit close for input stream needed here if `session.close()` is called later.
          }).catch(error => {
            if (!transcriptionHandled) {
              transcriptionHandled = true;
              reject(new Error(`Failed to establish Live API session: ${error.message}`));
            }
          });

          // Set a timeout for the entire transcription process
          setTimeout(() => {
            if (!transcriptionHandled) {
              transcriptionHandled = true;
              reject(new Error('Transcription timed out or failed to start/complete.'));
              sessionPromise.then(session => session.close()); // Attempt to close the session on timeout
            }
          }, 20000); // Increased timeout to 20 seconds for connection and transcription
        } catch (error) {
          if (!transcriptionHandled) {
            transcriptionHandled = true;
            reject(error);
          }
        }
      } else {
        reject(new Error('Failed to read audio blob.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(audioBlob);
  });
}


export async function generateFlashcard(nodeText: string): Promise<AIFlashcardOutput | null> {
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: { parts: [{ text: `Generate a single flashcard (question and answer) for the following concept: "${nodeText}"` }] },
      config: {
        systemInstruction: `You are a study assistant. Generate a concise flashcard in JSON format with 'front' (question) and 'back' (answer) properties. Only output the JSON.`,
        responseMimeType: 'application/json',
        responseSchema: AI_FLASHCARD_SCHEMA as Schema,
        maxOutputTokens: SHORT_OUTPUT_TOKENS,
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error('Error generating flashcard:', error);
    return null;
  }
}

export async function generateSummary(nodeText: string): Promise<AISummaryOutput | null> {
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: { parts: [{ text: `Summarize the following concept concisely: "${nodeText}"` }] },
      config: {
        systemInstruction: `You are a summarization expert. Provide a concise summary of the given concept in JSON format with a 'summary' property. Only output the JSON.`,
        responseMimeType: 'application/json',
        responseSchema: AI_SUMMARY_SCHEMA as Schema,
        maxOutputTokens: SHORT_OUTPUT_TOKENS,
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}

export async function generateProsCons(topicText: string): Promise<AIProsConsOutput | null> {
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_PRO_MODEL,
      contents: { parts: [{ text: `List pros and cons for the topic: "${topicText}"` }] },
      config: {
        systemInstruction: `You are a debate assistant. List distinct pros and cons for the given topic in JSON format with 'pros' and 'cons' arrays. Only output the JSON.`,
        responseMimeType: 'application/json',
        responseSchema: AI_PROS_CONS_SCHEMA as Schema,
        maxOutputTokens: SHORT_OUTPUT_TOKENS,
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error('Error generating pros and cons:', error);
    return null;
  }
}

export async function generateClarifyingQuestions(topicText: string): Promise<AIQuestionsOutput | null> {
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_PRO_MODEL,
      contents: { parts: [{ text: `Generate 3-5 clarifying and expanding questions for the concept: "${topicText}"` }] },
      config: {
        systemInstruction: `You are a critical thinking assistant. Generate a list of clarifying or expanding questions for the given concept in JSON format with a 'questions' array. Only output the JSON.`,
        responseMimeType: 'application/json',
        responseSchema: AI_QUESTIONS_SCHEMA as Schema,
        maxOutputTokens: SHORT_OUTPUT_TOKENS,
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error('Error generating clarifying questions:', error);
    return null;
  }
}

export async function refineMindMapStructure(
  mapNodes: string, // JSON string of current map
  newInput: string,
  mode: MindMapMode
): Promise<AIMindMapOutput | null> {
  const ai = createGeminiClient();
  const model = getModelForMode(mode);
  const systemInstruction = `You are a mind map refinement expert. Given the current mind map structure (in JSON) and new input, integrate the new input into the existing map. This could involve adding new nodes, merging duplicate ideas, or adjusting the hierarchy for better clarity and organization. If there are obvious duplicates in the current map based on the new input, suggest merging them by providing a refined structure where they are combined. The output MUST be a complete, refined JSON mind map structure, following the format: { "map": [{ "title": "...", "subtopics": [...] }] }. Do not lose any relevant existing information.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: `Current Mind Map:\n\`\`\`json\n${mapNodes}\n\`\`\`\n\nNew Input: "${newInput}"\n\nRefined Mind Map:` }] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: getResponseSchemaForMode(mode),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: AI_THINKING_BUDGET_PRO },
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error('Error refining mind map structure:', error);
    return null;
  }
}

export async function mergeDuplicateIdeas(
    mapNodes: string, // JSON string of current map
    mode: MindMapMode,
): Promise<AIMindMapOutput | null> {
    const ai = createGeminiClient();
    const model = getModelForMode(mode);
    const systemInstruction = `You are a mind map optimization expert. Review the provided mind map structure (in JSON) and identify any duplicate or highly redundant ideas/nodes. Consolidate these into single, well-phrased nodes, ensuring all important information is retained. The output MUST be a complete, refined JSON mind map structure with duplicates merged, following the format: { "map": [{ "title": "...", "subtopics": [...] }] }. Only output the JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: `Current Mind Map:\n\`\`\`json\n${mapNodes}\n\`\`\`\n\nMerge duplicate ideas in this mind map. Refined Mind Map:` }] },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: getResponseSchemaForMode(mode),
                maxOutputTokens: MAX_OUTPUT_TOKENS,
                thinkingConfig: { thinkingBudget: AI_THINKING_BUDGET_PRO },
            },
        });
        return response.text ? JSON.parse(response.text) : null;
    } catch (error) {
        console.error('Error merging duplicate ideas:', error);
        return null;
    }
}

export { audioInputContext };