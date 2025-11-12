
import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import InputPanel from './components/InputPanel';
import Controls from './components/Controls';
import MindMapCanvas from './components/MindMapCanvas';
import Modal from './components/Modal';
import {
  MindMapNode,
  MindMapMode,
  InputType,
  MindMapNodeType,
  AIMapNode,
  AIFlashcardOutput,
  AISummaryOutput,
  AIProsConsOutput,
  AIQuestionsOutput,
} from './types';
import {
  generateMindMapStructure,
  generateFlashcard,
  generateSummary,
  generateProsCons,
  generateClarifyingQuestions,
  refineMindMapStructure,
  mergeDuplicateIdeas,
} from './services/geminiService';

// Reducer for managing mind map state and history
interface MindMapState {
  nodes: MindMapNode[];
  history: MindMapNode[][];
  historyPointer: number;
}

type MindMapAction =
  | { type: 'SET_NODES'; payload: MindMapNode[] }
  | { type: 'ADD_NODE'; payload: { parentId: string | null; newNode: MindMapNode } }
  | { type: 'UPDATE_NODE_TEXT'; payload: { nodeId: string; newText: string } }
  | { type: 'DELETE_NODE'; payload: { nodeId: string } }
  | { type: 'TOGGLE_EXPAND'; payload: { nodeId: string } }
  | { type: 'UPDATE_NODE_METADATA'; payload: { nodeId: string; metadata: Partial<MindMapNode['metadata']>; status?: MindMapNode['status'] } }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const mindMapReducer = (state: MindMapState, action: MindMapAction): MindMapState => {
  let newNodes: MindMapNode[];
  let newHistory: MindMapNode[][];
  let newHistoryPointer: number;

  switch (action.type) {
    case 'SET_NODES':
      newHistory = state.history.slice(0, state.historyPointer + 1);
      newHistory.push(action.payload);
      return {
        nodes: action.payload,
        history: newHistory,
        historyPointer: newHistory.length - 1,
      };

    case 'ADD_NODE': {
      newNodes = JSON.parse(JSON.stringify(state.nodes)); // Deep copy for immutability
      const newNode = action.payload.newNode;

      if (action.payload.parentId === null) {
        newNodes.push(newNode);
      } else {
        const parentNode = findNodeById(newNodes, action.payload.parentId);
        if (parentNode) {
          parentNode.children.push(newNode);
          parentNode.isExpanded = true; // Expand parent when adding child
        }
      }
      newHistory = state.history.slice(0, state.historyPointer + 1);
      newHistory.push(newNodes);
      return {
        nodes: newNodes,
        history: newHistory,
        historyPointer: newHistory.length - 1,
      };
    }

    case 'UPDATE_NODE_TEXT': {
      newNodes = updateNodeRecursive(state.nodes, action.payload.nodeId, (node) => {
        node.text = action.payload.newText;
      });
      newHistory = state.history.slice(0, state.historyPointer + 1);
      newHistory.push(newNodes);
      return {
        nodes: newNodes,
        history: newHistory,
        historyPointer: newHistory.length - 1,
      };
    }

    case 'DELETE_NODE': {
      newNodes = deleteNodeRecursive(state.nodes, action.payload.nodeId);
      newHistory = state.history.slice(0, state.historyPointer + 1);
      newHistory.push(newNodes);
      return {
        nodes: newNodes,
        history: newHistory,
        historyPointer: newHistory.length - 1,
      };
    }

    case 'TOGGLE_EXPAND': {
      newNodes = updateNodeRecursive(state.nodes, action.payload.nodeId, (node) => {
        node.isExpanded = !node.isExpanded;
      });
      newHistory = state.history.slice(0, state.historyPointer + 1);
      newHistory.push(newNodes);
      return {
        nodes: newNodes,
        history: newHistory,
        historyPointer: newHistory.length - 1,
      };
    }

    case 'UPDATE_NODE_METADATA': {
      newNodes = updateNodeRecursive(state.nodes, action.payload.nodeId, (node) => {
        node.metadata = { ...node.metadata, ...action.payload.metadata };
        if (action.payload.status) {
          node.status = action.payload.status;
        }
      });
      newHistory = state.history.slice(0, state.historyPointer + 1);
      newHistory.push(newNodes);
      return {
        nodes: newNodes,
        history: newHistory,
        historyPointer: newHistory.length - 1,
      };
    }

    case 'UNDO':
      newHistoryPointer = Math.max(0, state.historyPointer - 1);
      return {
        ...state,
        nodes: state.history[newHistoryPointer],
        historyPointer: newHistoryPointer,
      };

    case 'REDO':
      newHistoryPointer = Math.min(state.history.length - 1, state.historyPointer + 1);
      return {
        ...state,
        nodes: state.history[newHistoryPointer],
        historyPointer: newHistoryPointer,
      };

    default:
      return state;
  }
};

const findNodeById = (nodes: MindMapNode[], id: string): MindMapNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return undefined;
};

const updateNodeRecursive = (
  nodes: MindMapNode[],
  targetId: string,
  updateFn: (node: MindMapNode) => void
): MindMapNode[] => {
  return nodes.map((node) => {
    if (node.id === targetId) {
      const newNode = { ...node };
      updateFn(newNode);
      return newNode;
    }
    return {
      ...node,
      children: updateNodeRecursive(node.children, targetId, updateFn),
    };
  });
};

const deleteNodeRecursive = (nodes: MindMapNode[], targetId: string): MindMapNode[] => {
  return nodes.filter((node) => node.id !== targetId).map((node) => ({
    ...node,
    children: deleteNodeRecursive(node.children, targetId),
  }));
};

// Helper to convert AIMapNode to MindMapNode
const convertAIMapNodeToMindMapNode = (
  aiNode: AIMapNode,
  parentId: string | null,
  level: number
): MindMapNode => {
  const nodeType =
    level === 0
      ? MindMapNodeType.MAIN_TOPIC
      : level === 1
      ? MindMapNodeType.SUB_TOPIC
      : MindMapNodeType.DETAIL;

  const node: MindMapNode = {
    id: uuidv4(),
    text: aiNode.title,
    children: [],
    parentId: parentId,
    isExpanded: true,
    type: nodeType,
    tags: [],
    metadata: {},
  };

  if (aiNode.pros && aiNode.cons) {
    node.metadata = { ...node.metadata, pros: aiNode.pros, cons: aiNode.cons };
  }
  if (aiNode.questions) {
    node.metadata = { ...node.metadata, questions: aiNode.questions };
  }

  node.children =
    aiNode.subtopics?.map((subNode) =>
      convertAIMapNodeToMindMapNode(subNode, node.id, level + 1)
    ) || [];

  return node;
};

// Helper to convert MindMapNode to AIMapNode for sending back to AI
const convertMindMapNodeToAIMapNode = (node: MindMapNode): AIMapNode => {
  const aiNode: AIMapNode = {
    title: node.text,
    subtopics: node.children.map(convertMindMapNodeToAIMapNode),
  };
  if (node.metadata?.pros || node.metadata?.cons) {
    aiNode.pros = node.metadata.pros;
    aiNode.cons = node.metadata.cons;
  }
  if (node.metadata?.questions) {
    aiNode.questions = node.metadata.questions;
  }
  return aiNode;
};

const App: React.FC = () => {
  const [mindMapState, dispatch] = useReducer(mindMapReducer, {
    nodes: [],
    history: [],
    historyPointer: -1,
  });
  const { nodes: mindMapNodes, history, historyPointer } = mindMapState;

  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [currentMode, setCurrentMode] = useState<MindMapMode>(MindMapMode.GENERAL);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // Initialize history with empty array if empty on first render
    if (history.length === 0 && mindMapNodes.length === 0) {
      dispatch({ type: 'SET_NODES', payload: [] });
    }
  }, [history.length, mindMapNodes.length]);

  const handleGenerateMindMap = useCallback(async (input: string, inputType: InputType) => {
    setIsLoading(true);
    setSelectedNode(null); // Clear selected node
    try {
      const aiResponse = await generateMindMapStructure(input, currentMode);
      if (aiResponse && aiResponse.map) {
        const newRootNodes = aiResponse.map.map((aiNode) =>
          convertAIMapNodeToMindMapNode(aiNode, null, 0)
        );
        dispatch({ type: 'SET_NODES', payload: newRootNodes });
      } else {
        alert('Failed to generate mind map. Please try again.');
      }
    } catch (error) {
      console.error('Error generating mind map:', error);
      alert(`Error generating mind map: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentMode]);

  const handleUpdateMindMap = useCallback(async (input: string, inputType: InputType) => {
    setIsLoading(true);
    try {
      const currentMapForAI = JSON.stringify({ map: mindMapNodes.map(convertMindMapNodeToAIMapNode) });
      const aiResponse = await refineMindMapStructure(currentMapForAI, input, currentMode);
      if (aiResponse && aiResponse.map) {
        const newRootNodes = aiResponse.map.map((aiNode) =>
          convertAIMapNodeToMindMapNode(aiNode, null, 0)
        );
        dispatch({ type: 'SET_NODES', payload: newRootNodes });
      } else {
        alert('Failed to update mind map. Please try again.');
      }
    } catch (error) {
      console.error('Error updating mind map:', error);
      alert(`Error updating mind map: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentMode, mindMapNodes]);


  const handleSelectNode = useCallback((node: MindMapNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleAddChild = useCallback((parentId: string) => {
    const newNode: MindMapNode = {
      id: uuidv4(),
      text: 'New Idea',
      children: [],
      parentId: parentId,
      isExpanded: true,
      type: MindMapNodeType.DETAIL, // Default to DETAIL
      tags: [],
    };
    dispatch({ type: 'ADD_NODE', payload: { parentId, newNode } });
  }, []);

  const handleUpdateNodeText = useCallback((nodeId: string, newText: string) => {
    dispatch({ type: 'UPDATE_NODE_TEXT', payload: { nodeId, newText } });
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', payload: { nodeId } });
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode?.id]);

  const handleToggleExpand = useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE_EXPAND', payload: { nodeId } });
  }, []);

  const handleConvertNode = useCallback(async (nodeId: string, type: 'task' | 'flashcard' | 'summary') => {
    const node = findNodeById(mindMapNodes, nodeId);
    if (!node) return;

    setIsLoading(true);
    try {
      if (type === 'flashcard') {
        const result: AIFlashcardOutput | null = await generateFlashcard(node.text);
        if (result) {
          dispatch({
            type: 'UPDATE_NODE_METADATA',
            payload: { nodeId, metadata: { flashcard: result }, status: 'flashcard' },
          });
          setModalContent(
            <div className="space-y-4">
              <p className="font-semibold text-lg">Front: {result.front}</p>
              <p className="font-semibold text-lg">Back: {result.back}</p>
              <p className="text-gray-600 text-sm">Flashcard generated for "{node.text}"</p>
            </div>
          );
          setIsModalOpen(true);
        } else {
          alert('Failed to generate flashcard.');
        }
      } else if (type === 'summary') {
        const result: AISummaryOutput | null = await generateSummary(node.text);
        if (result) {
          dispatch({
            type: 'UPDATE_NODE_METADATA',
            payload: { nodeId, metadata: { summary: result.summary }, status: 'summary' },
          });
          setModalContent(
            <div className="space-y-4">
              <p className="font-semibold text-lg">Summary for "{node.text}":</p>
              <p className="text-gray-700 whitespace-pre-wrap">{result.summary}</p>
            </div>
          );
          setIsModalOpen(true);
        } else {
          alert('Failed to generate summary.');
        }
      } else if (type === 'task') {
        // For task, we just set a default task status. AI could generate a more detailed task.
        const taskDetails = { description: `Complete "${node.text}"`, completed: false, dueDate: undefined };
        dispatch({
          type: 'UPDATE_NODE_METADATA',
          payload: { nodeId, metadata: { task: taskDetails }, status: 'task' },
        });
        setModalContent(
          <div className="space-y-4">
            <p className="font-semibold text-lg">Task Created:</p>
            <p className="text-gray-700">Description: {taskDetails.description}</p>
            <p className="text-gray-700">Status: {taskDetails.completed ? 'Completed' : 'Pending'}</p>
          </div>
        );
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error(`Error converting node to ${type}:`, error);
      alert(`Error converting node to ${type}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [mindMapNodes]);

  const handleAutoRefine = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentMapForAI = JSON.stringify({ map: mindMapNodes.map(convertMindMapNodeToAIMapNode) });
      const aiResponse = await refineMindMapStructure(currentMapForAI, '', currentMode); // Empty input for general refinement
      if (aiResponse && aiResponse.map) {
        const newRootNodes = aiResponse.map.map((aiNode) =>
          convertAIMapNodeToMindMapNode(aiNode, null, 0)
        );
        dispatch({ type: 'SET_NODES', payload: newRootNodes });
        setModalContent(
            <p>Mind map structure has been refined by AI!</p>
        );
        setIsModalOpen(true);
      } else {
        alert('Failed to auto-refine mind map. Please try again.');
      }
    } catch (error) {
      console.error('Error auto-refining mind map:', error);
      alert(`Error auto-refining mind map: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [mindMapNodes, currentMode]);

  const handleMergeDuplicates = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentMapForAI = JSON.stringify({ map: mindMapNodes.map(convertMindMapNodeToAIMapNode) });
      const aiResponse = await mergeDuplicateIdeas(currentMapForAI, currentMode);
      if (aiResponse && aiResponse.map) {
        const newRootNodes = aiResponse.map.map((aiNode) =>
          convertAIMapNodeToMindMapNode(aiNode, null, 0)
        );
        dispatch({ type: 'SET_NODES', payload: newRootNodes });
        setModalContent(
            <p>Duplicate ideas have been merged by AI!</p>
        );
        setIsModalOpen(true);
      } else {
        alert('Failed to merge duplicate ideas. Please try again.');
      }
    } catch (error) {
      console.error('Error merging duplicate ideas:', error);
      alert(`Error merging duplicate ideas: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [mindMapNodes, currentMode]);

  const handleGenerateClarifyingQuestions = useCallback(async (nodeId: string) => {
    const node = findNodeById(mindMapNodes, nodeId);
    if (!node) return;

    setIsLoading(true);
    try {
      const result: AIQuestionsOutput | null = await generateClarifyingQuestions(node.text);
      if (result && result.questions) {
        dispatch({
          type: 'UPDATE_NODE_METADATA',
          payload: { nodeId, metadata: { questions: result.questions } },
        });
        setModalContent(
          <div className="space-y-2">
            <p className="font-semibold text-lg">Clarifying Questions for "{node.text}":</p>
            <ul className="list-disc pl-5 text-gray-700">
              {result.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        );
        setIsModalOpen(true);
      } else {
        alert('Failed to generate clarifying questions.');
      }
    } catch (error) {
      console.error('Error generating clarifying questions:', error);
      alert(`Error generating clarifying questions: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [mindMapNodes]);


  const handleExportMap = useCallback(() => {
    if (mindMapNodes.length === 0) {
      alert('No mind map to export.');
      return;
    }

    const jsonContent = JSON.stringify(mindMapNodes, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Mind map exported as mindmap.json!');
  }, [mindMapNodes]);

  return (
    <div className="flex h-screen w-full bg-gray-100">
      <InputPanel
        onGenerateMindMap={handleGenerateMindMap}
        onUpdateMindMap={handleUpdateMindMap}
        isLoading={isLoading}
        selectedMode={currentMode}
      />
      <MindMapCanvas
        rootNodes={mindMapNodes}
        onSelectNode={handleSelectNode}
        onAddChild={handleAddChild}
        onUpdateNodeText={handleUpdateNodeText}
        onDeleteNode={handleDeleteNode}
        onToggleExpand={handleToggleExpand}
        selectedNodeId={selectedNode?.id || null}
      />
      <Controls
        onModeChange={setCurrentMode}
        selectedMode={currentMode}
        onAutoRefine={handleAutoRefine}
        onMergeDuplicates={handleMergeDuplicates}
        onGenerateClarifyingQuestions={handleGenerateClarifyingQuestions}
        onExportMap={handleExportMap}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        canUndo={historyPointer > 0}
        canRedo={historyPointer < history.length - 1}
        isLoading={isLoading}
        selectedNode={selectedNode}
        onConvertNode={handleConvertNode}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="AI Insight">
        {modalContent}
      </Modal>
    </div>
  );
};

export default App;
