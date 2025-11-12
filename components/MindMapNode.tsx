
import React, { useState } from 'react';
import { MindMapNode, MindMapNodeType } from '../types';

interface MindMapNodeProps {
  node: MindMapNode;
  level: number;
  onSelectNode: (node: MindMapNode | null) => void;
  onAddChild: (parentId: string) => void;
  onUpdateNodeText: (nodeId: string, newText: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  selectedNodeId: string | null;
}

const nodeTypeStyles: Record<MindMapNodeType, string> = {
  [MindMapNodeType.ROOT]: 'bg-blue-600 text-white text-xl font-bold px-6 py-3 rounded-full shadow-lg',
  [MindMapNodeType.MAIN_TOPIC]: 'bg-purple-600 text-white text-lg font-semibold px-5 py-2 rounded-xl shadow-md',
  [MindMapNodeType.SUB_TOPIC]: 'bg-indigo-500 text-white text-base font-medium px-4 py-2 rounded-lg shadow',
  [MindMapNodeType.DETAIL]: 'bg-gray-700 text-gray-100 text-sm px-3 py-1 rounded-md shadow-sm',
};

const MindMapNodeComponent: React.FC<MindMapNodeProps> = ({
  node,
  level,
  onSelectNode,
  onAddChild,
  onUpdateNodeText,
  onDeleteNode,
  onToggleExpand,
  selectedNodeId,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);

  const isSelected = selectedNodeId === node.id;

  const handleTextClick = () => {
    onSelectNode(node);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(node.text);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
  };

  const handleEditBlur = () => {
    setIsEditing(false);
    if (editText.trim() !== node.text) {
      onUpdateNodeText(node.id, editText.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const renderChildren = () => {
    if (!node.isExpanded || node.children.length === 0) return null;

    return (
      <div className="pl-8 pt-4 flex flex-col items-start space-y-3 relative before:content-[''] before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-gray-400">
        {node.children.map((child) => (
          <MindMapNodeComponent
            key={child.id}
            node={child}
            level={level + 1}
            onSelectNode={onSelectNode}
            onAddChild={onAddChild}
            onUpdateNodeText={onUpdateNodeText}
            onDeleteNode={onDeleteNode}
            onToggleExpand={onToggleExpand}
            selectedNodeId={selectedNodeId}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`flex flex-col items-start relative w-full ${level === 0 ? '' : ''}`}>
      <div className={`flex items-center space-x-2 z-10 w-full`}>
        {node.children.length > 0 && (
          <button
            onClick={() => onToggleExpand(node.id)}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-500 hover:bg-gray-600 text-white flex items-center justify-center text-xs"
          >
            {node.isExpanded ? '-' : '+'}
          </button>
        )}
        <div
          className={`cursor-pointer ${nodeTypeStyles[node.type]} ${isSelected ? 'ring-4 ring-yellow-400' : ''} transition-all duration-200 ease-in-out whitespace-pre-wrap`}
          onClick={handleTextClick}
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <textarea
              value={editText}
              onChange={handleEditChange}
              onBlur={handleEditBlur}
              onKeyDown={handleKeyPress}
              autoFocus
              className="bg-transparent border-b border-gray-300 outline-none resize-none overflow-hidden text-center w-full min-w-[150px] max-w-[300px]"
              style={{ height: 'auto', minHeight: '1.5em' }}
              rows={1}
            />
          ) : (
            <span>{node.text}</span>
          )}
        </div>
      </div>
      {renderChildren()}
    </div>
  );
};

export default MindMapNodeComponent;
