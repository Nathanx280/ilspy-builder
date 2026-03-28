// Builds a tree structure from parsed assembly metadata

import { ParsedAssembly, getMethodsForType, getFieldsForType } from './pe-parser';
import { disassembleIL, generatePseudoSource } from './il-disassembler';

export interface TreeNode {
  id: string;
  label: string;
  icon: 'assembly' | 'namespace' | 'class' | 'interface' | 'struct' | 'enum' | 'method' | 'field' | 'property';
  children: TreeNode[];
  data?: {
    typeIndex?: number;
    methodIndex?: number;
    fieldIndex?: number;
  };
}

export function buildAssemblyTree(assembly: ParsedAssembly): TreeNode {
  const root: TreeNode = {
    id: 'root',
    label: assembly.assemblyInfo?.name || 'Unknown Assembly',
    icon: 'assembly',
    children: [],
    data: {},
  };

  // Group types by namespace
  const namespaceMap = new Map<string, { type: typeof assembly.typeDefs[0]; index: number }[]>();

  for (let i = 0; i < assembly.typeDefs.length; i++) {
    const type = assembly.typeDefs[i];
    // Skip the <Module> type
    if (type.name === '<Module>') continue;
    // Skip compiler-generated types
    if (type.name.startsWith('<') || type.name.includes('__')) continue;

    const ns = type.namespace || '(global)';
    if (!namespaceMap.has(ns)) {
      namespaceMap.set(ns, []);
    }
    namespaceMap.get(ns)!.push({ type, index: i });
  }

  // Sort namespaces
  const sortedNamespaces = Array.from(namespaceMap.keys()).sort();

  for (const ns of sortedNamespaces) {
    const types = namespaceMap.get(ns)!;
    const nsNode: TreeNode = {
      id: `ns:${ns}`,
      label: ns,
      icon: 'namespace',
      children: [],
    };

    for (const { type, index } of types) {
      const isInterface = (type.flags & 0x0020) !== 0;
      const isEnum = false; // Simplified - would need to check base type
      const isStruct = false; // Simplified

      const typeIcon = isInterface ? 'interface' : isEnum ? 'enum' : isStruct ? 'struct' : 'class';

      const typeNode: TreeNode = {
        id: `type:${index}`,
        label: type.name,
        icon: typeIcon,
        children: [],
        data: { typeIndex: index },
      };

      // Add fields
      const fields = getFieldsForType(assembly, index);
      for (let fi = 0; fi < fields.length; fi++) {
        const field = fields[fi];
        if (field.name.startsWith('<')) continue; // Skip backing fields
        typeNode.children.push({
          id: `field:${index}:${fi}`,
          label: field.name,
          icon: 'field',
          children: [],
          data: { typeIndex: index, fieldIndex: fi },
        });
      }

      // Add methods
      const methods = getMethodsForType(assembly, index);
      for (let mi = 0; mi < methods.length; mi++) {
        const method = methods[mi];
        if (method.name.startsWith('<')) continue; // Skip compiler-generated
        const methodLabel = method.name === '.ctor' ? `${type.name}()` :
                           method.name === '.cctor' ? `static ${type.name}()` :
                           `${method.name}()`;
        typeNode.children.push({
          id: `method:${index}:${mi}`,
          label: methodLabel,
          icon: 'method',
          children: [],
          data: { typeIndex: index, methodIndex: mi },
        });
      }

      nsNode.children.push(typeNode);
    }

    // Sort types by name
    nsNode.children.sort((a, b) => a.label.localeCompare(b.label));
    root.children.push(nsNode);
  }

  return root;
}

export function getCodeForType(assembly: ParsedAssembly, typeIndex: number): string {
  const type = assembly.typeDefs[typeIndex];
  if (!type) return '// Type not found';

  const methods = getMethodsForType(assembly, typeIndex);
  const fields = getFieldsForType(assembly, typeIndex);

  const methodsWithIL = methods
    .filter(m => !m.name.startsWith('<'))
    .map(m => ({
      name: m.name,
      flags: m.flags,
      il: m.ilBody ? disassembleIL(m.ilBody) : null,
    }));

  const fieldsData = fields
    .filter(f => !f.name.startsWith('<'))
    .map(f => ({
      name: f.name,
      flags: f.flags,
    }));

  return generatePseudoSource(type.name, type.namespace, type.flags, methodsWithIL, fieldsData);
}

export function getILForMethod(assembly: ParsedAssembly, typeIndex: number, methodLocalIndex: number): string {
  const methods = getMethodsForType(assembly, typeIndex);
  const method = methods[methodLocalIndex];
  if (!method) return '// Method not found';

  const lines: string[] = [];
  lines.push(`// Method: ${method.name}`);
  lines.push(`// RVA: 0x${method.rva.toString(16).padStart(8, '0')}`);
  lines.push(`// Flags: 0x${method.flags.toString(16).padStart(4, '0')}`);
  lines.push('');

  if (method.ilBody) {
    const instructions = disassembleIL(method.ilBody);
    lines.push(`.method ${method.name}`);
    lines.push('{');
    lines.push(`    .maxstack 8`);
    lines.push('');
    for (const inst of instructions) {
      const operandStr = inst.operand ? ` ${inst.operand}` : '';
      lines.push(`    IL_${inst.offset.toString(16).padStart(4, '0')}: ${inst.opcode}${operandStr}`);
    }
    lines.push('}');
  } else {
    lines.push('// No IL body available (abstract, interface, or native method)');
  }

  return lines.join('\n');
}
