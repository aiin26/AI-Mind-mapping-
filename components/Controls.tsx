
import React, { useState, useCallback } from 'react';
import { MindMapMode, MindMapNode } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ControlsProps {
  onModeChange: (mode: MindMapMode) => void;
  selectedMode: MindMapMode;
  onAutoRefine: () => void;
  onMergeDuplicates: () => void;
  onGenerateClarifyingQuestions: (nodeId: string) => void;
  onExportMap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isLoading: boolean;
  selectedNode: MindMapNode | null;
  onConvertNode: (nodeId: string, type: 'task' | 'flashcard' | 'summary') => void;
}

const Controls: React.FC<ControlsProps> = ({
  onModeChange,
  selectedMode,
  onAutoRefine,
  onMergeDuplicates,
  onGenerateClarifyingQuestions,
  onExportMap,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isLoading,
  selectedNode,
  onConvertNode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // In a full implementation, this would trigger a search/filter function on the map
    console.log('Search Term:', e.target.value);
  };

  const handleTagFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagFilter(e.target.value);
    // This would also trigger a filter function
    console.log('Tag Filter:', e.target.value);
  };

  const handleExport = useCallback(() => {
    onExportMap();
  }, [onExportMap]);

  const handleCollaborationClick = () => {
    alert('Real-time collaboration is a future feature! Stay tuned!');
  };

  return (
    <div className="w-80 bg-gray-900 text-white flex flex-col p-4 shadow-xl border-l border-gray-700">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-300">Mind Map Controls</h2>

      {isLoading && (
        <div className="mb-4 text-center">
          <LoadingSpinner />
          <p className="text-sm mt-2 text-gray-300">AI is thinking...</p>
        </div>
      )}

      {/* Mode Selection */}
      <div className="mb-6">
        <label htmlFor="mode-select" className="block text-sm font-medium text-gray-300 mb-2">
          Select Mode:
        </label>
        <select
          id="mode-select"
          value={selectedMode}
          onChange={(e) => onModeChange(e.target.value as MindMapMode)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:ring-blue-500 focus:border-blue-500 outline-none"
          disabled={isLoading}
        >
          {Object.values(MindMapMode).map((mode) => (
            <option key={mode} value={mode}>
              {mode.replace(/_/g, ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Node Specific Actions */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Node Actions</h3>
        <p className="text-xs text-gray-400 mb-3">{selectedNode ? `Selected: "${selectedNode.text.substring(0, 30)}..."` : 'Select a node for actions.'}</p>
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => selectedNode && onConvertNode(selectedNode.id, 'task')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={!selectedNode || isLoading}
          >
            Convert to Task
          </button>
          <button
            onClick={() => selectedNode && onConvertNode(selectedNode.id, 'flashcard')}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={!selectedNode || isLoading}
          >
            Convert to Flashcard
          </button>
          <button
            onClick={() => selectedNode && onConvertNode(selectedNode.id, 'summary')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={!selectedNode || isLoading}
          >
            Generate Summary
          </button>
          <button
            onClick={() => selectedNode && onGenerateClarifyingQuestions(selectedNode.id)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={!selectedNode || isLoading}
          >
            Generate Questions
          </button>
        </div>
      </div>

      {/* AI Refinements */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">AI Refinements</h3>
        <div className="flex flex-col space-y-2">
          <button
            onClick={onAutoRefine}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={isLoading}
          >
            Auto-Refine Structure
          </button>
          <button
            onClick={onMergeDuplicates}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={isLoading}
          >
            Merge Duplicate Ideas
          </button>
        </div>
      </div>

      {/* Map Management */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Map Management</h3>
        <div className="flex space-x-2 mb-3">
          <button
            onClick={onUndo}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={!canUndo || isLoading}
          >
            Undo
          </button>
          <button
            onClick={onRedo}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            disabled={!canRedo || isLoading}
          >
            Redo
          </button>
        </div>
        <input
          type="text"
          placeholder="Search map..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full p-2 mb-3 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          disabled={isLoading}
        />
        <input
          type="text"
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={handleTagFilterChange}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          disabled={isLoading}
        >
          {/* Note: In a real app, this would dynamically filter visible nodes */}
        </input>
      </div>

      {/* Export & Collaboration */}
      <div className="mt-auto p-4 bg-gray-800 rounded-lg">
        <div className="flex flex-col space-y-2">
          <button
            onClick={handleExport}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
            disabled={isLoading}
          >
            Export Map
          </button>
          <button
            onClick={handleCollaborationClick}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
            disabled={isLoading}
          >
            Collaborate (Future)
          </button>
        </div>
      </div>
    </div>
  );
};

export default Controls;
