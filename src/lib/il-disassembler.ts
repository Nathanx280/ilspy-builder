// IL Instruction Disassembler
// Converts IL bytecode to human-readable IL assembly

interface ILInstruction {
  offset: number;
  opcode: string;
  operand: string;
  bytes: string;
}

const oneByteOpcodes: Record<number, [string, number]> = {
  0x00: ['nop', 0],
  0x01: ['break', 0],
  0x02: ['ldarg.0', 0],
  0x03: ['ldarg.1', 0],
  0x04: ['ldarg.2', 0],
  0x05: ['ldarg.3', 0],
  0x06: ['ldloc.0', 0],
  0x07: ['ldloc.1', 0],
  0x08: ['ldloc.2', 0],
  0x09: ['ldloc.3', 0],
  0x0A: ['stloc.0', 0],
  0x0B: ['stloc.1', 0],
  0x0C: ['stloc.2', 0],
  0x0D: ['stloc.3', 0],
  0x0E: ['ldarg.s', 1],
  0x0F: ['ldarga.s', 1],
  0x10: ['starg.s', 1],
  0x11: ['ldloc.s', 1],
  0x12: ['ldloca.s', 1],
  0x13: ['stloc.s', 1],
  0x14: ['ldnull', 0],
  0x15: ['ldc.i4.m1', 0],
  0x16: ['ldc.i4.0', 0],
  0x17: ['ldc.i4.1', 0],
  0x18: ['ldc.i4.2', 0],
  0x19: ['ldc.i4.3', 0],
  0x1A: ['ldc.i4.4', 0],
  0x1B: ['ldc.i4.5', 0],
  0x1C: ['ldc.i4.6', 0],
  0x1D: ['ldc.i4.7', 0],
  0x1E: ['ldc.i4.8', 0],
  0x1F: ['ldc.i4.s', 1],
  0x20: ['ldc.i4', 4],
  0x21: ['ldc.i8', 8],
  0x22: ['ldc.r4', 4],
  0x23: ['ldc.r8', 8],
  0x25: ['dup', 0],
  0x26: ['pop', 0],
  0x27: ['jmp', 4],
  0x28: ['call', 4],
  0x29: ['calli', 4],
  0x2A: ['ret', 0],
  0x2B: ['br.s', 1],
  0x2C: ['brfalse.s', 1],
  0x2D: ['brtrue.s', 1],
  0x2E: ['beq.s', 1],
  0x2F: ['bge.s', 1],
  0x30: ['bgt.s', 1],
  0x31: ['ble.s', 1],
  0x32: ['blt.s', 1],
  0x33: ['bne.un.s', 1],
  0x34: ['bge.un.s', 1],
  0x35: ['bgt.un.s', 1],
  0x36: ['ble.un.s', 1],
  0x37: ['blt.un.s', 1],
  0x38: ['br', 4],
  0x39: ['brfalse', 4],
  0x3A: ['brtrue', 4],
  0x3B: ['beq', 4],
  0x3C: ['bge', 4],
  0x3D: ['bgt', 4],
  0x3E: ['ble', 4],
  0x3F: ['blt', 4],
  0x40: ['bne.un', 4],
  0x41: ['bge.un', 4],
  0x42: ['bgt.un', 4],
  0x43: ['ble.un', 4],
  0x44: ['blt.un', 4],
  0x45: ['switch', -1], // variable length
  0x46: ['ldind.i1', 0],
  0x47: ['ldind.u1', 0],
  0x48: ['ldind.i2', 0],
  0x49: ['ldind.u2', 0],
  0x4A: ['ldind.i4', 0],
  0x4B: ['ldind.u4', 0],
  0x4C: ['ldind.i8', 0],
  0x4D: ['ldind.i', 0],
  0x4E: ['ldind.r4', 0],
  0x4F: ['ldind.r8', 0],
  0x50: ['ldind.ref', 0],
  0x51: ['stind.ref', 0],
  0x52: ['stind.i1', 0],
  0x53: ['stind.i2', 0],
  0x54: ['stind.i4', 0],
  0x55: ['stind.i8', 0],
  0x56: ['stind.r4', 0],
  0x57: ['stind.r8', 0],
  0x58: ['add', 0],
  0x59: ['sub', 0],
  0x5A: ['mul', 0],
  0x5B: ['div', 0],
  0x5C: ['div.un', 0],
  0x5D: ['rem', 0],
  0x5E: ['rem.un', 0],
  0x5F: ['and', 0],
  0x60: ['or', 0],
  0x61: ['xor', 0],
  0x62: ['shl', 0],
  0x63: ['shr', 0],
  0x64: ['shr.un', 0],
  0x65: ['neg', 0],
  0x66: ['not', 0],
  0x67: ['conv.i1', 0],
  0x68: ['conv.i2', 0],
  0x69: ['conv.i4', 0],
  0x6A: ['conv.i8', 0],
  0x6B: ['conv.r4', 0],
  0x6C: ['conv.r8', 0],
  0x6D: ['conv.u4', 0],
  0x6E: ['conv.u8', 0],
  0x6F: ['callvirt', 4],
  0x70: ['cpobj', 4],
  0x71: ['ldobj', 4],
  0x72: ['ldstr', 4],
  0x73: ['newobj', 4],
  0x74: ['castclass', 4],
  0x75: ['isinst', 4],
  0x76: ['conv.r.un', 0],
  0x79: ['unbox', 4],
  0x7A: ['throw', 0],
  0x7B: ['ldfld', 4],
  0x7C: ['ldflda', 4],
  0x7D: ['stfld', 4],
  0x7E: ['ldsfld', 4],
  0x7F: ['ldsflda', 4],
  0x80: ['stsfld', 4],
  0x81: ['stobj', 4],
  0x83: ['conv.ovf.i1.un', 0],
  0x84: ['conv.ovf.i2.un', 0],
  0x85: ['conv.ovf.i4.un', 0],
  0x86: ['conv.ovf.i8.un', 0],
  0x87: ['conv.ovf.u1.un', 0],
  0x88: ['conv.ovf.u2.un', 0],
  0x89: ['conv.ovf.u4.un', 0],
  0x8A: ['conv.ovf.u8.un', 0],
  0x8B: ['conv.ovf.i.un', 0],
  0x8C: ['box', 4],
  0x8D: ['newarr', 4],
  0x8E: ['ldlen', 0],
  0x8F: ['ldelema', 4],
  0x90: ['ldelem.i1', 0],
  0x91: ['ldelem.u1', 0],
  0x92: ['ldelem.i2', 0],
  0x93: ['ldelem.u2', 0],
  0x94: ['ldelem.i4', 0],
  0x95: ['ldelem.u4', 0],
  0x96: ['ldelem.i8', 0],
  0x97: ['ldelem.i', 0],
  0x98: ['ldelem.r4', 0],
  0x99: ['ldelem.r8', 0],
  0x9A: ['ldelem.ref', 0],
  0x9B: ['stelem.i', 0],
  0x9C: ['stelem.i1', 0],
  0x9D: ['stelem.i2', 0],
  0x9E: ['stelem.i4', 0],
  0x9F: ['stelem.i8', 0],
  0xA0: ['stelem.r4', 0],
  0xA1: ['stelem.r8', 0],
  0xA2: ['stelem.ref', 0],
  0xA3: ['ldelem', 4],
  0xA4: ['stelem', 4],
  0xA5: ['unbox.any', 4],
  0xB3: ['conv.ovf.i1', 0],
  0xB4: ['conv.ovf.u1', 0],
  0xB5: ['conv.ovf.i2', 0],
  0xB6: ['conv.ovf.u2', 0],
  0xB7: ['conv.ovf.i4', 0],
  0xB8: ['conv.ovf.u4', 0],
  0xB9: ['conv.ovf.i8', 0],
  0xBA: ['conv.ovf.u8', 0],
  0xC2: ['refanyval', 4],
  0xC6: ['mkrefany', 4],
  0xD0: ['ldtoken', 4],
  0xD1: ['conv.u2', 0],
  0xD2: ['conv.u1', 0],
  0xD3: ['conv.i', 0],
  0xD4: ['conv.ovf.i', 0],
  0xD5: ['conv.ovf.u', 0],
  0xD6: ['add.ovf', 0],
  0xD7: ['add.ovf.un', 0],
  0xD8: ['mul.ovf', 0],
  0xD9: ['mul.ovf.un', 0],
  0xDA: ['sub.ovf', 0],
  0xDB: ['sub.ovf.un', 0],
  0xDC: ['endfinally', 0],
  0xDD: ['leave', 4],
  0xDE: ['leave.s', 1],
  0xDF: ['stind.i', 0],
  0xE0: ['conv.u', 0],
};

const twoByteOpcodes: Record<number, [string, number]> = {
  0x00: ['arglist', 0],
  0x01: ['ceq', 0],
  0x02: ['cgt', 0],
  0x03: ['cgt.un', 0],
  0x04: ['clt', 0],
  0x05: ['clt.un', 0],
  0x06: ['ldftn', 4],
  0x07: ['ldvirtftn', 4],
  0x09: ['ldarg', 2],
  0x0A: ['ldarga', 2],
  0x0B: ['starg', 2],
  0x0C: ['ldloc', 2],
  0x0D: ['ldloca', 2],
  0x0E: ['stloc', 2],
  0x0F: ['localloc', 0],
  0x11: ['endfilter', 0],
  0x12: ['unaligned.', 1],
  0x13: ['volatile.', 0],
  0x14: ['tail.', 0],
  0x15: ['initobj', 4],
  0x16: ['constrained.', 4],
  0x17: ['cpblk', 0],
  0x18: ['initblk', 0],
  0x1A: ['rethrow', 0],
  0x1C: ['sizeof', 4],
  0x1D: ['refanytype', 0],
  0x1E: ['readonly.', 0],
};

export function disassembleIL(ilBytes: Uint8Array): ILInstruction[] {
  const instructions: ILInstruction[] = [];
  let pos = 0;

  const readByte = () => ilBytes[pos++];
  const readInt8 = () => {
    const val = ilBytes[pos];
    pos++;
    return val > 127 ? val - 256 : val;
  };
  const readUint16 = () => {
    const val = ilBytes[pos] | (ilBytes[pos + 1] << 8);
    pos += 2;
    return val;
  };
  const readInt32 = () => {
    const val = ilBytes[pos] | (ilBytes[pos + 1] << 8) | (ilBytes[pos + 2] << 16) | (ilBytes[pos + 3] << 24);
    pos += 4;
    return val;
  };
  const readUint32 = () => {
    const val = (ilBytes[pos] | (ilBytes[pos + 1] << 8) | (ilBytes[pos + 2] << 16) | ((ilBytes[pos + 3] << 24) >>> 0)) >>> 0;
    pos += 4;
    return val;
  };

  while (pos < ilBytes.length) {
    const offset = pos;
    let byte = readByte();
    let opcodeEntry: [string, number] | undefined;
    let isTwoByte = false;

    if (byte === 0xFE) {
      isTwoByte = true;
      const byte2 = readByte();
      opcodeEntry = twoByteOpcodes[byte2];
      if (!opcodeEntry) {
        instructions.push({
          offset,
          opcode: `unknown_0xFE${byte2.toString(16).padStart(2, '0')}`,
          operand: '',
          bytes: `FE ${byte2.toString(16).padStart(2, '0')}`,
        });
        continue;
      }
    } else {
      opcodeEntry = oneByteOpcodes[byte];
      if (!opcodeEntry) {
        instructions.push({
          offset,
          opcode: `unknown_0x${byte.toString(16).padStart(2, '0')}`,
          operand: '',
          bytes: byte.toString(16).padStart(2, '0'),
        });
        continue;
      }
    }

    const [name, operandSize] = opcodeEntry;
    let operand = '';
    const byteStr = isTwoByte ? `FE ${(byte).toString(16).padStart(2, '0')}` : byte.toString(16).padStart(2, '0');

    if (operandSize === -1 && name === 'switch') {
      // Switch instruction
      const count = readUint32();
      const targets: number[] = [];
      for (let i = 0; i < count && pos + 4 <= ilBytes.length; i++) {
        targets.push(readInt32());
      }
      operand = `(${targets.map(t => `IL_${(pos + t).toString(16).padStart(4, '0')}`).join(', ')})`;
    } else if (operandSize === 1) {
      const val = readInt8();
      if (name.includes('br') || name === 'leave.s') {
        operand = `IL_${(pos + val).toString(16).padStart(4, '0')}`;
      } else {
        operand = val.toString();
      }
    } else if (operandSize === 2) {
      operand = readUint16().toString();
    } else if (operandSize === 4) {
      if (name.includes('br') || name === 'leave') {
        const target = readInt32();
        operand = `IL_${(pos + target).toString(16).padStart(4, '0')}`;
      } else if (name === 'ldc.i4') {
        operand = readInt32().toString();
      } else if (name === 'ldc.r4') {
        const view = new DataView(ilBytes.buffer, ilBytes.byteOffset + pos - 4, 4);
        // Already read 4 bytes
        pos -= 4;
        const val = new DataView(ilBytes.buffer, ilBytes.byteOffset + pos, 4).getFloat32(0, true);
        pos += 4;
        operand = val.toString();
      } else {
        // Token operand
        const token = readUint32();
        const tableId = (token >> 24) & 0xFF;
        const rowId = token & 0x00FFFFFF;
        operand = `/* ${formatToken(tableId, rowId)} */ (${token.toString(16).padStart(8, '0')}h)`;
      }
    } else if (operandSize === 8) {
      if (name === 'ldc.i8') {
        const low = readUint32();
        const high = readInt32();
        operand = `0x${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
      } else {
        const view = new DataView(ilBytes.buffer, ilBytes.byteOffset + pos, 8);
        const val = view.getFloat64(0, true);
        pos += 8;
        operand = val.toString();
      }
    }

    instructions.push({ offset, opcode: name, operand, bytes: byteStr });
  }

  return instructions;
}

function formatToken(tableId: number, rowId: number): string {
  const tableNames: Record<number, string> = {
    0x01: 'TypeRef',
    0x02: 'TypeDef',
    0x04: 'Field',
    0x06: 'MethodDef',
    0x08: 'Param',
    0x0A: 'MemberRef',
    0x0B: 'Constant',
    0x0C: 'CustomAttribute',
    0x11: 'StandAloneSig',
    0x1B: 'TypeSpec',
    0x20: 'Assembly',
    0x23: 'AssemblyRef',
    0x2A: 'GenericParam',
    0x2B: 'MethodSpec',
    0x70: 'String',
  };
  const tableName = tableNames[tableId] || `Table0x${tableId.toString(16)}`;
  return `${tableName}:${rowId}`;
}

export function formatILToString(instructions: ILInstruction[]): string {
  return instructions.map(inst => {
    const offsetStr = `IL_${inst.offset.toString(16).padStart(4, '0')}`;
    const operandStr = inst.operand ? ` ${inst.operand}` : '';
    return `${offsetStr}: ${inst.opcode}${operandStr}`;
  }).join('\n');
}

// Generate pseudo-C# from IL metadata
export function generatePseudoSource(
  typeName: string,
  namespace: string,
  typeFlags: number,
  methods: { name: string; flags: number; il: ILInstruction[] | null }[],
  fields: { name: string; flags: number }[]
): string {
  const lines: string[] = [];

  if (namespace) {
    lines.push(`namespace ${namespace}`);
    lines.push('{');
  }

  const isInterface = (typeFlags & 0x0020) !== 0;
  const isAbstract = (typeFlags & 0x0080) !== 0;
  const isSealed = (typeFlags & 0x0100) !== 0;

  const vis = getTypeVis(typeFlags);
  const typeKeyword = isInterface ? 'interface' : 'class';
  const modifiers: string[] = [];
  if (vis) modifiers.push(vis);
  if (isAbstract && !isInterface) modifiers.push('abstract');
  if (isSealed && !isInterface) modifiers.push('sealed');
  modifiers.push(typeKeyword);

  const indent = namespace ? '    ' : '';
  lines.push(`${indent}${modifiers.join(' ')} ${typeName}`);
  lines.push(`${indent}{`);

  // Fields
  for (const field of fields) {
    const fVis = getFieldVis(field.flags);
    const isStatic = (field.flags & 0x0010) !== 0;
    const staticMod = isStatic ? 'static ' : '';
    lines.push(`${indent}    ${fVis} ${staticMod}object ${field.name};`);
  }

  if (fields.length > 0 && methods.length > 0) {
    lines.push('');
  }

  // Methods
  for (const method of methods) {
    const mVis = getMethodVis(method.flags);
    const isStatic = (method.flags & 0x0010) !== 0;
    const isVirtual = (method.flags & 0x0040) !== 0;
    const isAbstractM = (method.flags & 0x0400) !== 0;
    const staticMod = isStatic ? 'static ' : '';
    const virtualMod = isVirtual && !isInterface ? 'virtual ' : '';
    const abstractMod = isAbstractM ? 'abstract ' : '';

    const isCtor = method.name === '.ctor' || method.name === '.cctor';
    const returnType = isCtor ? '' : 'void ';
    const methodName = isCtor ? typeName : method.name;

    lines.push(`${indent}    ${mVis} ${staticMod}${virtualMod}${abstractMod}${returnType}${methodName}()`);

    if (isAbstractM || isInterface) {
      lines.push(`${indent}    {`);
      lines.push(`${indent}        // Abstract method`);
      lines.push(`${indent}    }`);
    } else if (method.il && method.il.length > 0) {
      lines.push(`${indent}    {`);
      lines.push(`${indent}        // IL Body (${method.il.length} instructions):`);
      for (const inst of method.il.slice(0, 50)) {
        const operandStr = inst.operand ? ` ${inst.operand}` : '';
        lines.push(`${indent}        // IL_${inst.offset.toString(16).padStart(4, '0')}: ${inst.opcode}${operandStr}`);
      }
      if (method.il.length > 50) {
        lines.push(`${indent}        // ... ${method.il.length - 50} more instructions`);
      }
      lines.push(`${indent}    }`);
    } else {
      lines.push(`${indent}    {`);
      lines.push(`${indent}        // Method body not available`);
      lines.push(`${indent}    }`);
    }
    lines.push('');
  }

  lines.push(`${indent}}`);
  if (namespace) {
    lines.push('}');
  }

  return lines.join('\n');
}

function getTypeVis(flags: number): string {
  const vis = flags & 0x07;
  if (vis === 0x01) return 'public';
  if (vis === 0x02) return 'public'; // nested public
  return 'internal';
}

function getFieldVis(flags: number): string {
  const access = flags & 0x07;
  switch (access) {
    case 0x06: return 'public';
    case 0x05: return 'protected internal';
    case 0x04: return 'protected';
    case 0x03: return 'internal';
    default: return 'private';
  }
}

function getMethodVis(flags: number): string {
  const access = flags & 0x0007;
  switch (access) {
    case 0x0006: return 'public';
    case 0x0005: return 'protected internal';
    case 0x0004: return 'protected';
    case 0x0003: return 'internal';
    default: return 'private';
  }
}
