import React, { useRef } from 'react';
import { Upload, Code2, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppToolbarProps {
  onFileOpen: (file: File) => void;
  viewMode: 'csharp' | 'il';
  onViewModeChange: (mode: 'csharp' | 'il') => void;
  assemblyName: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function AppToolbar({
  onFileOpen,
  viewMode,
  onViewModeChange,
  assemblyName,
  searchQuery,
  onSearchChange,
}: AppToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileOpen(file);
      e.target.value = '';
    }
  };

  return (
    <div className="h-10 bg-toolbar-bg border-b border-toolbar-border flex items-center px-2 gap-1 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".dll,.exe"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1.5"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        Open
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button
        variant={viewMode === 'csharp' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs gap-1.5"
        onClick={() => onViewModeChange('csharp')}
      >
        <Code2 className="h-3.5 w-3.5" />
        C#
      </Button>
      <Button
        variant={viewMode === 'il' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs gap-1.5"
        onClick={() => onViewModeChange('il')}
      >
        <FileText className="h-3.5 w-3.5" />
        IL
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search types..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-7 bg-secondary text-foreground text-xs rounded-sm pl-7 pr-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex-1" />

      {assemblyName && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {assemblyName}
        </span>
      )}
    </div>
  );
}
