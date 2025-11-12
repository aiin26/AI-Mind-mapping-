
import React from 'react';
import { MindMapNode } from '../types';
import MindMapNodeComponent from './MindMapNode';

interface MindMapCanvasProps {
  rootNodes: MindMapNode[];
  onSelectNode: (node: MindMapNode | null) => void;
  onAddChild: (parentId: string) => void;
  onUpdateNodeText: (nodeId: string, newText: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  selectedNodeId: string | null;
}

const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  rootNodes,
  onSelectNode,
  onAddChild,
  onUpdateNodeText,
  onDeleteNode,
  onToggleExpand,
  selectedNodeId,
}) => {
  return (
    <div className="flex-1 p-8 bg-gray-100 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
      <div className="min-w-full min-h-full flex flex-col items-start space-y-6">
        {rootNodes.length === 0 ? (
          <p className="text-gray-500 text-lg italic text-center w-full mt-20">Start by entering text/voice/PDF to generate your mind map!</p>
        ) : (
          rootNodes.map((node) => (
            <MindMapNodeComponent
              key={node.id}
              node={node}
              level={0}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
              onUpdateNodeText={onUpdateNodeText}
              onDeleteNode={onDeleteNode}
              onToggleExpand={onToggleExpand}
              selectedNodeId={selectedNodeId}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MindMapCanvas;
