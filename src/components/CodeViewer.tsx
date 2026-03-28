import React, { useMemo } from 'react';

interface CodeViewerProps {
  code: string;
  language: 'csharp' | 'il';
}

function highlightLine(line: string, language: 'csharp' | 'il'): React.ReactNode[] {
  if (language === 'il') {
    return highlightIL(line);
  }
  return highlightCSharp(line);
}

function highlightCSharp(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const keywords = /\b(namespace|class|interface|struct|enum|public|private|protected|internal|static|virtual|abstract|sealed|override|readonly|const|void|object|string|int|long|bool|byte|float|double|decimal|new|return|if|else|for|foreach|while|do|switch|case|break|continue|throw|try|catch|finally|using|var|async|await|this|base|null|true|false|get|set|event|delegate|partial)\b/g;
  const comments = /\/\/.*/g;
  const strings = /"[^"]*"|'[^']*'/g;

  // Simple approach: process the line character by character with regex
  let remaining = line;
  let key = 0;

  // Check for comment first
  const commentMatch = remaining.match(/^(\s*)(\/\/.*)$/);
  if (commentMatch) {
    tokens.push(<span key={key++}>{commentMatch[1]}</span>);
    tokens.push(<span key={key++} className="syn-comment">{commentMatch[2]}</span>);
    return tokens;
  }

  // Tokenize
  const parts = remaining.split(/(\b(?:namespace|class|interface|struct|enum|public|private|protected|internal|static|virtual|abstract|sealed|override|readonly|const|void|object|string|int|long|bool|byte|float|double|decimal|new|return|if|else|for|foreach|while|do|switch|case|break|continue|throw|try|catch|finally|using|var|async|await|this|base|null|true|false|get|set|event|delegate|partial)\b|"[^"]*"|'[^']*'|\d+|\/\/.*|[{}();,.<>\[\]=+\-*\/&|!?:])/);

  const keywordSet = new Set(['namespace', 'class', 'interface', 'struct', 'enum', 'public', 'private', 'protected', 'internal', 'static', 'virtual', 'abstract', 'sealed', 'override', 'readonly', 'const', 'void', 'object', 'string', 'int', 'long', 'bool', 'byte', 'float', 'double', 'decimal', 'new', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'throw', 'try', 'catch', 'finally', 'using', 'var', 'async', 'await', 'this', 'base', 'null', 'true', 'false', 'get', 'set', 'event', 'delegate', 'partial']);
  const punctuation = new Set(['{', '}', '(', ')', ';', ',', '.', '<', '>', '[', ']', '=', '+', '-', '*', '/', '&', '|', '!', '?', ':']);

  for (const part of parts) {
    if (!part) continue;
    if (keywordSet.has(part)) {
      tokens.push(<span key={key++} className="syn-keyword">{part}</span>);
    } else if (part.startsWith('"') || part.startsWith("'")) {
      tokens.push(<span key={key++} className="syn-string">{part}</span>);
    } else if (part.startsWith('//')) {
      tokens.push(<span key={key++} className="syn-comment">{part}</span>);
    } else if (/^\d+$/.test(part)) {
      tokens.push(<span key={key++} className="syn-number">{part}</span>);
    } else if (part.length === 1 && punctuation.has(part)) {
      tokens.push(<span key={key++} className="syn-punctuation">{part}</span>);
    } else {
      tokens.push(<span key={key++}>{part}</span>);
    }
  }

  return tokens;
}

function highlightIL(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let key = 0;

  // Comments
  if (line.trimStart().startsWith('//')) {
    return [<span key={0} className="syn-comment">{line}</span>];
  }

  // IL label
  const labelMatch = line.match(/^(\s*)(IL_[0-9a-fA-F]+)(:)(\s+)(.*)/);
  if (labelMatch) {
    tokens.push(<span key={key++}>{labelMatch[1]}</span>);
    tokens.push(<span key={key++} className="syn-number">{labelMatch[2]}</span>);
    tokens.push(<span key={key++} className="syn-punctuation">{labelMatch[3]}</span>);
    tokens.push(<span key={key++}>{labelMatch[4]}</span>);
    // Opcode and operand
    const rest = labelMatch[5];
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx > 0) {
      tokens.push(<span key={key++} className="syn-keyword">{rest.substring(0, spaceIdx)}</span>);
      tokens.push(<span key={key++}>{rest.substring(spaceIdx)}</span>);
    } else {
      tokens.push(<span key={key++} className="syn-keyword">{rest}</span>);
    }
    return tokens;
  }

  // .method, .maxstack etc
  const directiveMatch = line.match(/^(\s*)(\.method|\.maxstack|\.locals|\.entrypoint|\.try|\.catch|\.finally)(\s*)(.*)/);
  if (directiveMatch) {
    tokens.push(<span key={key++}>{directiveMatch[1]}</span>);
    tokens.push(<span key={key++} className="syn-attribute">{directiveMatch[2]}</span>);
    tokens.push(<span key={key++}>{directiveMatch[3]}</span>);
    tokens.push(<span key={key++}>{directiveMatch[4]}</span>);
    return tokens;
  }

  return [<span key={0}>{line}</span>];
}

export function CodeViewer({ code, language }: CodeViewerProps) {
  const lines = useMemo(() => code.split('\n'), [code]);

  if (!code) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a type or method to view its code
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto font-mono text-[13px] leading-5">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-accent/30">
              <td className="text-right pr-4 pl-4 select-none text-muted-foreground w-12 align-top">
                {i + 1}
              </td>
              <td className="pr-4 whitespace-pre">
                {highlightLine(line, language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
