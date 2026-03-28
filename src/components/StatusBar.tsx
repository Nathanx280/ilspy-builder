import React from 'react';

interface StatusBarProps {
  assemblyInfo: {
    name: string;
    version: string;
  } | null;
  typeCount: number;
  methodCount: number;
}

export function StatusBar({ assemblyInfo, typeCount, methodCount }: StatusBarProps) {
  return (
    <div className="h-6 bg-status-bg text-status-text flex items-center px-3 text-[11px] gap-4 shrink-0">
      {assemblyInfo ? (
        <>
          <span>{assemblyInfo.name} v{assemblyInfo.version}</span>
          <span>{typeCount} types</span>
          <span>{methodCount} methods</span>
        </>
      ) : (
        <span>Ready — Open a .NET assembly to begin</span>
      )}
    </div>
  );
}
