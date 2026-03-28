import React, { useState, useCallback, useMemo } from 'react';
import { parseAssembly, ParsedAssembly } from '@/lib/pe-parser';
import { buildAssemblyTree, getCodeForType, getILForMethod, TreeNode } from '@/lib/assembly-tree';
import { AssemblyTree } from '@/components/AssemblyTree';
import { CodeViewer } from '@/components/CodeViewer';
import { AppToolbar } from '@/components/AppToolbar';
import { TabBar, Tab } from '@/components/TabBar';
import { StatusBar } from '@/components/StatusBar';
import { toast } from 'sonner';

interface TabContent {
  id: string;
  label: string;
  code: string;
  language: 'csharp' | 'il';
}

const Index = () => {
  const [assembly, setAssembly] = useState<ParsedAssembly | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'csharp' | 'il'>('csharp');
  const [tabs, setTabs] = useState<TabContent[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileOpen = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseAssembly(buffer);

      if (parsed.error) {
        toast.error(parsed.error);
        return;
      }

      setAssembly(parsed);
      setTree(buildAssemblyTree(parsed));
      setTabs([]);
      setActiveTabId(null);
      setSelectedId(null);
      toast.success(`Loaded ${parsed.assemblyInfo?.name || file.name} — ${parsed.typeDefs.length} types found`);
    } catch (err) {
      toast.error('Failed to parse assembly file');
      console.error(err);
    }
  }, []);

  const handleNodeSelect = useCallback((node: TreeNode) => {
    setSelectedId(node.id);

    if (!assembly || !node.data) return;

    const { typeIndex, methodIndex } = node.data;

    if (typeIndex !== undefined && methodIndex === undefined && node.icon !== 'field') {
      // Type selected - show type code
      const code = viewMode === 'il'
        ? getCodeForType(assembly, typeIndex) // For IL mode, still show type overview
        : getCodeForType(assembly, typeIndex);

      const tabId = `type:${typeIndex}:${viewMode}`;
      const existing = tabs.find(t => t.id === tabId);
      if (!existing) {
        const newTab: TabContent = {
          id: tabId,
          label: node.label,
          code,
          language: viewMode === 'il' ? 'il' : 'csharp',
        };
        setTabs(prev => [...prev, newTab]);
      }
      setActiveTabId(tabId);
    } else if (typeIndex !== undefined && methodIndex !== undefined) {
      // Method selected
      const code = viewMode === 'il'
        ? getILForMethod(assembly, typeIndex, methodIndex)
        : getCodeForType(assembly, typeIndex);

      const tabId = `method:${typeIndex}:${methodIndex}:${viewMode}`;
      const existing = tabs.find(t => t.id === tabId);
      if (!existing) {
        const newTab: TabContent = {
          id: tabId,
          label: node.label,
          code,
          language: viewMode === 'il' ? 'il' : 'csharp',
        };
        setTabs(prev => [...prev, newTab]);
      }
      setActiveTabId(tabId);
    }
  }, [assembly, viewMode, tabs]);

  const handleTabClose = useCallback((id: string) => {
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTabId === id) {
      setActiveTabId(tabs.length > 1 ? tabs[tabs.length - 2]?.id || null : null);
    }
  }, [activeTabId, tabs]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!tree || !searchQuery.trim()) return tree;

    const query = searchQuery.toLowerCase();
    const filterNode = (node: TreeNode): TreeNode | null => {
      if (node.label.toLowerCase().includes(query)) return node;
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNode => n !== null);
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return filterNode(tree) || tree;
  }, [tree, searchQuery]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppToolbar
        onFileOpen={handleFileOpen}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        assemblyName={assembly?.assemblyInfo?.name || null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex flex-1 min-h-0">
        {/* Tree panel */}
        <div className="w-72 bg-tree-bg border-r border-border flex flex-col min-h-0 shrink-0">
          <div className="h-7 bg-toolbar-bg border-b border-border flex items-center px-3 text-xs text-muted-foreground font-medium shrink-0">
            Assembly Explorer
          </div>
          <div className="flex-1 overflow-auto">
            <AssemblyTree
              tree={filteredTree}
              selectedId={selectedId}
              onSelect={handleNodeSelect}
            />
          </div>
        </div>

        {/* Code panel */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <TabBar
            tabs={tabs.map(t => ({ id: t.id, label: t.label }))}
            activeTab={activeTabId}
            onTabSelect={setActiveTabId}
            onTabClose={handleTabClose}
          />
          <div className="flex-1 overflow-auto min-h-0">
            {activeTab ? (
              <CodeViewer code={activeTab.code} language={activeTab.language} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <div className="text-4xl opacity-30">🔍</div>
                <p className="text-sm">Open a .dll or .exe file and select a type to view</p>
                <p className="text-xs opacity-60">Supports .NET assemblies with IL metadata</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar
        assemblyInfo={assembly?.assemblyInfo || null}
        typeCount={assembly?.typeDefs.length || 0}
        methodCount={assembly?.methodDefs.length || 0}
      />
    </div>
  );
};

export default Index;
