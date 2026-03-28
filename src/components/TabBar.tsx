import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  icon?: 'class' | 'method' | 'il';
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onTabSelect, onTabClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="h-8 bg-tab-bg border-b border-border flex items-end overflow-x-auto shrink-0">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={cn(
            'h-full flex items-center gap-1.5 px-3 text-xs cursor-pointer border-r border-border group min-w-0 max-w-[200px]',
            activeTab === tab.id
              ? 'bg-tab-active text-tab-active-text border-t-2 border-t-primary'
              : 'bg-tab-inactive text-tab-text hover:bg-accent/50'
          )}
          onClick={() => onTabSelect(tab.id)}
        >
          <span className="truncate">{tab.label}</span>
          <button
            className="shrink-0 h-4 w-4 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
