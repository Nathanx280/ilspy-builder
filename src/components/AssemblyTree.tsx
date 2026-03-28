import React, { useState, useCallback } from 'react';
import { TreeNode } from '@/lib/assembly-tree';
import { ChevronRight, ChevronDown, Box, FolderOpen, Code2, Diamond, Braces, Hash, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssemblyTreeProps {
  tree: TreeNode | null;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  assembly: Box,
  namespace: FolderOpen,
  class: Code2,
  interface: Diamond,
  struct: Braces,
  enum: Hash,
  method: Type,
  field: Hash,
  property: Braces,
};

const iconColorMap: Record<string, string> = {
  assembly: 'text-syntax-attribute',
  namespace: 'text-syntax-namespace',
  class: 'text-syntax-type',
  interface: 'text-syntax-keyword',
  struct: 'text-syntax-type',
  enum: 'text-syntax-string',
  method: 'text-syntax-method',
  field: 'text-syntax-keyword',
  property: 'text-syntax-attribute',
};

function TreeItemComponent({ node, depth, selectedId, onSelect, defaultOpen = false }: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = node.children.length > 0;
  const Icon = iconMap[node.icon] || Code2;
  const iconColor = iconColorMap[node.icon] || 'text-foreground';

  const handleClick = useCallback(() => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
    onSelect(node);
  }, [hasChildren, isOpen, node, onSelect]);

  return (
    <div>
      <div
        className={cn(
          'tree-item',
          selectedId === node.id && 'selected'
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> :
                   <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
        <span className="truncate text-[13px]">{node.label}</span>
      </div>
      {isOpen && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeItemComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultOpen={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AssemblyTree({ tree, selectedId, onSelect }: AssemblyTreeProps) {
  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
        Open a .NET assembly (.dll or .exe) to browse its contents
      </div>
    );
  }

  return (
    <div className="py-1 overflow-auto h-full">
      <TreeItemComponent
        node={tree}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
        defaultOpen={true}
      />
    </div>
  );
}
