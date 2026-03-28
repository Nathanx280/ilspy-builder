// .NET PE/CLI Metadata Parser
// Reads .NET assembly metadata from DLL/EXE files

export interface AssemblyInfo {
  name: string;
  version: string;
  culture: string;
  flags: number;
}

export interface TypeDefInfo {
  name: string;
  namespace: string;
  flags: number;
  fullName: string;
  methodStart: number;
  fieldStart: number;
  extends: number;
}

export interface MethodDefInfo {
  name: string;
  rva: number;
  implFlags: number;
  flags: number;
  signature: number;
  paramStart: number;
  ilBody: Uint8Array | null;
}

export interface FieldDefInfo {
  name: string;
  flags: number;
  signature: number;
}

export interface ParamInfo {
  name: string;
  flags: number;
  sequence: number;
}

export interface PropertyInfo {
  name: string;
  flags: number;
}

export interface ParsedAssembly {
  assemblyInfo: AssemblyInfo | null;
  typeDefs: TypeDefInfo[];
  methodDefs: MethodDefInfo[];
  fieldDefs: FieldDefInfo[];
  params: ParamInfo[];
  properties: PropertyInfo[];
  strings: Map<number, string>;
  userStrings: Map<number, string>;
  error?: string;
}

class BinaryReader {
  private view: DataView;
  private pos: number;
  private data: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    this.data = new Uint8Array(buffer);
    this.view = new DataView(buffer);
    this.pos = 0;
  }

  get position() { return this.pos; }
  set position(v: number) { this.pos = v; }
  get length() { return this.data.length; }

  readByte(): number {
    return this.data[this.pos++];
  }

  readUint16(): number {
    const val = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return val;
  }

  readUint32(): number {
    const val = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readInt32(): number {
    const val = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readBytes(count: number): Uint8Array {
    const slice = this.data.slice(this.pos, this.pos + count);
    this.pos += count;
    return slice;
  }

  readNullTerminatedString(): string {
    let result = '';
    while (this.pos < this.data.length) {
      const b = this.data[this.pos++];
      if (b === 0) break;
      result += String.fromCharCode(b);
    }
    return result;
  }

  readFixedString(length: number): string {
    const bytes = this.readBytes(length);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) break;
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }

  readStringAt(offset: number): string {
    const savedPos = this.pos;
    this.pos = offset;
    const str = this.readNullTerminatedString();
    this.pos = savedPos;
    return str;
  }

  readCompressedUint(): number {
    const b0 = this.readByte();
    if ((b0 & 0x80) === 0) return b0;
    if ((b0 & 0xC0) === 0x80) {
      const b1 = this.readByte();
      return ((b0 & 0x3F) << 8) | b1;
    }
    if ((b0 & 0xE0) === 0xC0) {
      const b1 = this.readByte();
      const b2 = this.readByte();
      const b3 = this.readByte();
      return ((b0 & 0x1F) << 24) | (b1 << 16) | (b2 << 8) | b3;
    }
    return 0;
  }
}

interface SectionHeader {
  name: string;
  virtualSize: number;
  virtualAddress: number;
  rawSize: number;
  rawOffset: number;
}

const TABLE_ASSEMBLY = 0x20;
const TABLE_TYPEDEF = 0x02;
const TABLE_METHODDEF = 0x06;
const TABLE_FIELD = 0x04;
const TABLE_PARAM = 0x08;
const TABLE_PROPERTY = 0x17;
const TABLE_MEMBERREF = 0x0A;
const TABLE_TYPEREF = 0x01;
const TABLE_ASSEMBLYREF = 0x23;
const TABLE_MODULE = 0x00;
const TABLE_CUSTOMATTRIBUTE = 0x0C;
const TABLE_INTERFACEIMPL = 0x09;
const TABLE_CONSTANT = 0x0B;
const TABLE_PROPERTYMAP = 0x15;
const TABLE_METHODSEMANTICS = 0x18;
const TABLE_STANDALONE_SIG = 0x11;
const TABLE_TYPESPEC = 0x1B;
const TABLE_EVENT = 0x14;
const TABLE_EVENTMAP = 0x12;
const TABLE_NESTEDCLASS = 0x29;
const TABLE_GENERICPARAM = 0x2A;
const TABLE_METHODSPEC = 0x2B;
const TABLE_GENERICPARAMCONSTRAINT = 0x2C;
const TABLE_IMPLMAP = 0x1C;
const TABLE_FIELDLAYOUT = 0x10;
const TABLE_CLASSLAYOUT = 0x0F;
const TABLE_FIELDMARSHAL = 0x0D;
const TABLE_DECLSECURITY = 0x0E;
const TABLE_FIELDRVA = 0x1D;
const TABLE_MANIFESTRESOURCE = 0x28;
const TABLE_EXPORTEDTYPE = 0x27;
const TABLE_FILE = 0x26;
const TABLE_ENCLOG = 0x1E;
const TABLE_ENCMAP = 0x1F;

const TOTAL_TABLES = 64;

export function parseAssembly(buffer: ArrayBuffer): ParsedAssembly {
  const reader = new BinaryReader(buffer);
  const result: ParsedAssembly = {
    assemblyInfo: null,
    typeDefs: [],
    methodDefs: [],
    fieldDefs: [],
    params: [],
    properties: [],
    strings: new Map(),
    userStrings: new Map(),
  };

  try {
    // DOS Header
    const mz = reader.readUint16();
    if (mz !== 0x5A4D) {
      return { ...result, error: 'Not a valid PE file (missing MZ header)' };
    }

    reader.position = 0x3C;
    const peOffset = reader.readUint32();
    reader.position = peOffset;

    // PE Signature
    const peSignature = reader.readUint32();
    if (peSignature !== 0x00004550) {
      return { ...result, error: 'Invalid PE signature' };
    }

    // COFF Header
    const machine = reader.readUint16();
    const numberOfSections = reader.readUint16();
    reader.readUint32(); // timestamp
    reader.readUint32(); // symbol table pointer
    reader.readUint32(); // number of symbols
    const optionalHeaderSize = reader.readUint16();
    const characteristics = reader.readUint16();

    // Optional Header
    const optionalHeaderStart = reader.position;
    const magic = reader.readUint16();
    const isPE32Plus = magic === 0x20B;

    reader.position = optionalHeaderStart + (isPE32Plus ? 112 : 96);
    const numberOfDataDirs = reader.readUint32();

    // Read data directories
    const dataDirs: { rva: number; size: number }[] = [];
    for (let i = 0; i < numberOfDataDirs && i < 16; i++) {
      dataDirs.push({
        rva: reader.readUint32(),
        size: reader.readUint32(),
      });
    }

    // CLI Header is at data directory index 14
    if (dataDirs.length < 15 || dataDirs[14].rva === 0) {
      return { ...result, error: 'Not a .NET assembly (no CLI header)' };
    }

    // Section Headers
    reader.position = optionalHeaderStart + optionalHeaderSize;
    const sections: SectionHeader[] = [];
    for (let i = 0; i < numberOfSections; i++) {
      const name = reader.readFixedString(8);
      const virtualSize = reader.readUint32();
      const virtualAddress = reader.readUint32();
      const rawSize = reader.readUint32();
      const rawOffset = reader.readUint32();
      reader.readBytes(16); // skip relocations, line numbers, etc.
      sections.push({ name, virtualSize, virtualAddress, rawSize, rawOffset });
    }

    const rvaToOffset = (rva: number): number => {
      for (const section of sections) {
        if (rva >= section.virtualAddress && rva < section.virtualAddress + section.rawSize) {
          return rva - section.virtualAddress + section.rawOffset;
        }
      }
      return rva;
    };

    // CLI Header
    const cliOffset = rvaToOffset(dataDirs[14].rva);
    reader.position = cliOffset;
    const cliHeaderSize = reader.readUint32();
    const majorRuntimeVersion = reader.readUint16();
    const minorRuntimeVersion = reader.readUint16();
    const metadataRva = reader.readUint32();
    const metadataSize = reader.readUint32();

    // Metadata Root
    const metadataOffset = rvaToOffset(metadataRva);
    reader.position = metadataOffset;

    const metadataSignature = reader.readUint32();
    if (metadataSignature !== 0x424A5342) {
      return { ...result, error: 'Invalid metadata signature' };
    }

    reader.readUint16(); // major version
    reader.readUint16(); // minor version
    reader.readUint32(); // reserved
    const versionLength = reader.readUint32();
    const versionString = reader.readFixedString(versionLength);
    // Align to 4 bytes
    reader.position = metadataOffset + 16 + versionLength;
    if (reader.position % 4 !== 0) {
      reader.position += 4 - (reader.position % 4);
    }

    reader.readUint16(); // flags
    const numberOfStreams = reader.readUint16();

    // Stream headers
    let stringsStreamOffset = 0, stringsStreamSize = 0;
    let usStreamOffset = 0, usStreamSize = 0;
    let guidStreamOffset = 0, guidStreamSize = 0;
    let blobStreamOffset = 0, blobStreamSize = 0;
    let tablesStreamOffset = 0, tablesStreamSize = 0;

    for (let i = 0; i < numberOfStreams; i++) {
      const offset = reader.readUint32();
      const size = reader.readUint32();
      const streamName = reader.readNullTerminatedString();
      // Align to 4 bytes
      while (reader.position % 4 !== 0) reader.readByte();

      const absOffset = metadataOffset + offset;

      if (streamName === '#Strings') {
        stringsStreamOffset = absOffset;
        stringsStreamSize = size;
      } else if (streamName === '#US') {
        usStreamOffset = absOffset;
        usStreamSize = size;
      } else if (streamName === '#GUID') {
        guidStreamOffset = absOffset;
        guidStreamSize = size;
      } else if (streamName === '#Blob') {
        blobStreamOffset = absOffset;
        blobStreamSize = size;
      } else if (streamName === '#~' || streamName === '#-') {
        tablesStreamOffset = absOffset;
        tablesStreamSize = size;
      }
    }

    // Read strings heap
    const readHeapString = (index: number): string => {
      if (index === 0) return '';
      if (result.strings.has(index)) return result.strings.get(index)!;
      const saved = reader.position;
      reader.position = stringsStreamOffset + index;
      const str = reader.readNullTerminatedString();
      reader.position = saved;
      result.strings.set(index, str);
      return str;
    };

    // Tables stream
    reader.position = tablesStreamOffset;
    reader.readUint32(); // reserved
    const majorVersion = reader.readByte();
    const minorVersion2 = reader.readByte();
    const heapSizes = reader.readByte();
    reader.readByte(); // reserved

    const valid = readUint64(reader);
    const sorted = readUint64(reader);

    const stringIndexSize = (heapSizes & 0x01) ? 4 : 2;
    const guidIndexSize = (heapSizes & 0x02) ? 4 : 2;
    const blobIndexSize = (heapSizes & 0x04) ? 4 : 2;

    // Count rows for each table
    const rowCounts: number[] = new Array(TOTAL_TABLES).fill(0);
    for (let i = 0; i < TOTAL_TABLES; i++) {
      if (valid[i]) {
        rowCounts[i] = reader.readUint32();
      }
    }

    const readStringIndex = (): number => {
      return stringIndexSize === 4 ? reader.readUint32() : reader.readUint16();
    };
    const readGuidIndex = (): number => {
      return guidIndexSize === 4 ? reader.readUint32() : reader.readUint16();
    };
    const readBlobIndex = (): number => {
      return blobIndexSize === 4 ? reader.readUint32() : reader.readUint16();
    };

    // Coded index sizes
    const codedIndexSize = (tables: number[], tagBits: number): number => {
      let maxRows = 0;
      for (const t of tables) {
        if (t < rowCounts.length) maxRows = Math.max(maxRows, rowCounts[t]);
      }
      return maxRows < (1 << (16 - tagBits)) ? 2 : 4;
    };

    const readCodedIndex = (tables: number[], tagBits: number): number => {
      const size = codedIndexSize(tables, tagBits);
      return size === 4 ? reader.readUint32() : reader.readUint16();
    };

    // Table index sizes
    const tableIndexSize = (tableId: number): number => {
      return rowCounts[tableId] > 0xFFFF ? 4 : 2;
    };
    const readTableIndex = (tableId: number): number => {
      return tableIndexSize(tableId) === 4 ? reader.readUint32() : reader.readUint16();
    };

    // TypeDefOrRef coded index
    const typeDefOrRefTables = [TABLE_TYPEDEF, TABLE_TYPEREF, TABLE_TYPESPEC];
    // HasConstant
    const hasConstantTables = [TABLE_FIELD, TABLE_PARAM, TABLE_PROPERTY];
    // HasCustomAttribute
    const hasCustomAttributeTables = [
      TABLE_METHODDEF, TABLE_FIELD, TABLE_TYPEREF, TABLE_TYPEDEF,
      TABLE_PARAM, TABLE_INTERFACEIMPL, TABLE_MEMBERREF, TABLE_MODULE,
      0xFF, TABLE_PROPERTY, TABLE_EVENT, 0xFF, 0xFF, 0xFF,
      TABLE_ASSEMBLY, TABLE_ASSEMBLYREF, TABLE_FILE, TABLE_EXPORTEDTYPE,
      TABLE_MANIFESTRESOURCE, TABLE_GENERICPARAM, TABLE_GENERICPARAMCONSTRAINT, TABLE_METHODSPEC,
    ];
    // CustomAttributeType
    const customAttributeTypeTables = [0xFF, 0xFF, TABLE_METHODDEF, TABLE_MEMBERREF, 0xFF];
    // HasDeclSecurity
    const hasDeclSecurityTables = [TABLE_TYPEDEF, TABLE_METHODDEF, TABLE_ASSEMBLY];
    // MemberRefParent
    const memberRefParentTables = [TABLE_TYPEDEF, TABLE_TYPEREF, TABLE_MODULE, TABLE_METHODDEF, TABLE_TYPESPEC];
    // HasSemantics
    const hasSemanticsTables = [TABLE_EVENT, TABLE_PROPERTY];
    // MethodDefOrRef
    const methodDefOrRefTables = [TABLE_METHODDEF, TABLE_MEMBERREF];
    // MemberForwarded
    const memberForwardedTables = [TABLE_FIELD, TABLE_METHODDEF];
    // Implementation
    const implementationTables = [TABLE_FILE, TABLE_ASSEMBLYREF, TABLE_EXPORTEDTYPE];
    // HasFieldMarshal
    const hasFieldMarshalTables = [TABLE_FIELD, TABLE_PARAM];
    // TypeOrMethodDef
    const typeOrMethodDefTables = [TABLE_TYPEDEF, TABLE_METHODDEF];
    // ResolutionScope
    const resolutionScopeTables = [TABLE_MODULE, 0x1A, TABLE_ASSEMBLYREF, TABLE_TYPEREF];

    // Now parse each table sequentially
    // Module (0x00)
    for (let i = 0; i < rowCounts[TABLE_MODULE]; i++) {
      reader.readUint16(); // generation
      readStringIndex(); // name
      readGuidIndex(); // mvid
      readGuidIndex(); // encId
      readGuidIndex(); // encBaseId
    }

    // TypeRef (0x01)
    for (let i = 0; i < rowCounts[TABLE_TYPEREF]; i++) {
      readCodedIndex(resolutionScopeTables, 2); // resolution scope
      readStringIndex(); // name
      readStringIndex(); // namespace
    }

    // TypeDef (0x02)
    for (let i = 0; i < rowCounts[TABLE_TYPEDEF]; i++) {
      const flags = reader.readUint32();
      const nameIdx = readStringIndex();
      const namespaceIdx = readStringIndex();
      const extendsIdx = readCodedIndex(typeDefOrRefTables, 2);
      const fieldStart = readTableIndex(TABLE_FIELD);
      const methodStart = readTableIndex(TABLE_METHODDEF);

      const name = readHeapString(nameIdx);
      const namespace = readHeapString(namespaceIdx);
      const fullName = namespace ? `${namespace}.${name}` : name;

      result.typeDefs.push({
        name, namespace, flags, fullName, methodStart, fieldStart, extends: extendsIdx
      });
    }

    // Field (0x04)
    for (let i = 0; i < rowCounts[TABLE_FIELD]; i++) {
      const flags = reader.readUint16();
      const nameIdx = readStringIndex();
      const signature = readBlobIndex();
      result.fieldDefs.push({ name: readHeapString(nameIdx), flags, signature });
    }

    // MethodDef (0x06)
    for (let i = 0; i < rowCounts[TABLE_METHODDEF]; i++) {
      const rva = reader.readUint32();
      const implFlags = reader.readUint16();
      const flags = reader.readUint16();
      const nameIdx = readStringIndex();
      const signature = readBlobIndex();
      const paramStart = readTableIndex(TABLE_PARAM);

      let ilBody: Uint8Array | null = null;
      if (rva !== 0) {
        const saved = reader.position;
        try {
          const bodyOffset = rvaToOffset(rva);
          const bodyReader = new BinaryReader(buffer);
          bodyReader.position = bodyOffset;
          const headerByte = bodyReader.readByte();

          if ((headerByte & 0x03) === 0x02) {
            // Tiny header
            const codeSize = headerByte >> 2;
            bodyReader.position = bodyOffset + 1;
            ilBody = bodyReader.readBytes(codeSize);
          } else if ((headerByte & 0x03) === 0x03) {
            // Fat header
            bodyReader.position = bodyOffset;
            const flags16 = bodyReader.readUint16();
            const maxStack = bodyReader.readUint16();
            const codeSize = bodyReader.readUint32();
            const localVarSigTok = bodyReader.readUint32();
            ilBody = bodyReader.readBytes(Math.min(codeSize, 65536));
          }
        } catch {
          // Skip IL body if there's an error
        }
        reader.position = saved;
      }

      result.methodDefs.push({
        name: readHeapString(nameIdx), rva, implFlags, flags, signature, paramStart, ilBody
      });
    }

    // Param (0x08)
    for (let i = 0; i < rowCounts[TABLE_PARAM]; i++) {
      const flags = reader.readUint16();
      const sequence = reader.readUint16();
      const nameIdx = readStringIndex();
      result.params.push({ name: readHeapString(nameIdx), flags, sequence });
    }

    // Skip remaining tables by reading through them
    // InterfaceImpl (0x09)
    for (let i = 0; i < rowCounts[TABLE_INTERFACEIMPL]; i++) {
      readTableIndex(TABLE_TYPEDEF);
      readCodedIndex(typeDefOrRefTables, 2);
    }

    // MemberRef (0x0A)
    for (let i = 0; i < rowCounts[TABLE_MEMBERREF]; i++) {
      readCodedIndex(memberRefParentTables, 3);
      readStringIndex();
      readBlobIndex();
    }

    // Constant (0x0B)
    for (let i = 0; i < rowCounts[TABLE_CONSTANT]; i++) {
      reader.readUint16(); // type + padding
      readCodedIndex(hasConstantTables, 2);
      readBlobIndex();
    }

    // CustomAttribute (0x0C)
    for (let i = 0; i < rowCounts[TABLE_CUSTOMATTRIBUTE]; i++) {
      readCodedIndex(hasCustomAttributeTables, 5);
      readCodedIndex(customAttributeTypeTables, 3);
      readBlobIndex();
    }

    // FieldMarshal (0x0D)
    for (let i = 0; i < rowCounts[TABLE_FIELDMARSHAL]; i++) {
      readCodedIndex(hasFieldMarshalTables, 1);
      readBlobIndex();
    }

    // DeclSecurity (0x0E)
    for (let i = 0; i < rowCounts[TABLE_DECLSECURITY]; i++) {
      reader.readUint16();
      readCodedIndex(hasDeclSecurityTables, 2);
      readBlobIndex();
    }

    // ClassLayout (0x0F)
    for (let i = 0; i < rowCounts[TABLE_CLASSLAYOUT]; i++) {
      reader.readUint16();
      reader.readUint32();
      readTableIndex(TABLE_TYPEDEF);
    }

    // FieldLayout (0x10)
    for (let i = 0; i < rowCounts[TABLE_FIELDLAYOUT]; i++) {
      reader.readUint32();
      readTableIndex(TABLE_FIELD);
    }

    // StandAloneSig (0x11)
    for (let i = 0; i < rowCounts[TABLE_STANDALONE_SIG]; i++) {
      readBlobIndex();
    }

    // EventMap (0x12)
    for (let i = 0; i < rowCounts[TABLE_EVENTMAP]; i++) {
      readTableIndex(TABLE_TYPEDEF);
      readTableIndex(TABLE_EVENT);
    }

    // skip 0x13 (not defined)

    // Event (0x14)
    for (let i = 0; i < rowCounts[TABLE_EVENT]; i++) {
      reader.readUint16();
      readStringIndex();
      readCodedIndex(typeDefOrRefTables, 2);
    }

    // PropertyMap (0x15)
    for (let i = 0; i < rowCounts[TABLE_PROPERTYMAP]; i++) {
      readTableIndex(TABLE_TYPEDEF);
      readTableIndex(TABLE_PROPERTY);
    }

    // skip 0x16

    // Property (0x17)
    for (let i = 0; i < rowCounts[TABLE_PROPERTY]; i++) {
      const flags = reader.readUint16();
      const nameIdx = readStringIndex();
      readBlobIndex();
      result.properties.push({ name: readHeapString(nameIdx), flags });
    }

    // MethodSemantics (0x18)
    for (let i = 0; i < rowCounts[TABLE_METHODSEMANTICS]; i++) {
      reader.readUint16();
      readTableIndex(TABLE_METHODDEF);
      readCodedIndex(hasSemanticsTables, 1);
    }

    // Read Assembly table
    // We need to navigate back or the Assembly table position...
    // Actually Assembly is table 0x20, we've been reading sequentially
    // Let's skip tables 0x19-0x1F first

    // MethodImpl (0x19)
    for (let i = 0; i < rowCounts[0x19]; i++) {
      readTableIndex(TABLE_TYPEDEF);
      readCodedIndex(methodDefOrRefTables, 1);
      readCodedIndex(methodDefOrRefTables, 1);
    }

    // ModuleRef (0x1A)
    for (let i = 0; i < rowCounts[0x1A]; i++) {
      readStringIndex();
    }

    // TypeSpec (0x1B)
    for (let i = 0; i < rowCounts[TABLE_TYPESPEC]; i++) {
      readBlobIndex();
    }

    // ImplMap (0x1C)
    for (let i = 0; i < rowCounts[TABLE_IMPLMAP]; i++) {
      reader.readUint16();
      readCodedIndex(memberForwardedTables, 1);
      readStringIndex();
      readTableIndex(0x1A);
    }

    // FieldRVA (0x1D)
    for (let i = 0; i < rowCounts[TABLE_FIELDRVA]; i++) {
      reader.readUint32();
      readTableIndex(TABLE_FIELD);
    }

    // EncLog (0x1E)
    for (let i = 0; i < rowCounts[TABLE_ENCLOG]; i++) {
      reader.readUint32();
      reader.readUint32();
    }

    // EncMap (0x1F)
    for (let i = 0; i < rowCounts[TABLE_ENCMAP]; i++) {
      reader.readUint32();
    }

    // Assembly (0x20)
    for (let i = 0; i < rowCounts[TABLE_ASSEMBLY]; i++) {
      const hashAlgId = reader.readUint32();
      const majorVer = reader.readUint16();
      const minorVer = reader.readUint16();
      const buildNum = reader.readUint16();
      const revNum = reader.readUint16();
      const flags = reader.readUint32();
      readBlobIndex(); // public key
      const nameIdx = readStringIndex();
      const cultureIdx = readStringIndex();

      result.assemblyInfo = {
        name: readHeapString(nameIdx),
        version: `${majorVer}.${minorVer}.${buildNum}.${revNum}`,
        culture: readHeapString(cultureIdx),
        flags,
      };
    }

  } catch (err) {
    result.error = `Parse error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return result;
}

function readUint64(reader: { readUint32(): number }): boolean[] {
  const low = reader.readUint32();
  const high = reader.readUint32();
  const bits: boolean[] = [];
  for (let i = 0; i < 32; i++) bits.push((low & (1 << i)) !== 0);
  for (let i = 0; i < 32; i++) bits.push((high & (1 << i)) !== 0);
  return bits;
}

// Helper: get methods for a type
export function getMethodsForType(assembly: ParsedAssembly, typeIndex: number): MethodDefInfo[] {
  const type = assembly.typeDefs[typeIndex];
  if (!type) return [];

  const startIdx = type.methodStart - 1; // 1-based to 0-based
  const nextType = assembly.typeDefs[typeIndex + 1];
  const endIdx = nextType ? nextType.methodStart - 1 : assembly.methodDefs.length;

  return assembly.methodDefs.slice(Math.max(0, startIdx), endIdx);
}

// Helper: get fields for a type
export function getFieldsForType(assembly: ParsedAssembly, typeIndex: number): FieldDefInfo[] {
  const type = assembly.typeDefs[typeIndex];
  if (!type) return [];

  const startIdx = type.fieldStart - 1;
  const nextType = assembly.typeDefs[typeIndex + 1];
  const endIdx = nextType ? nextType.fieldStart - 1 : assembly.fieldDefs.length;

  return assembly.fieldDefs.slice(Math.max(0, startIdx), endIdx);
}

// Method visibility helpers
export function getMethodVisibility(flags: number): string {
  const access = flags & 0x0007;
  switch (access) {
    case 0x0006: return 'public';
    case 0x0005: return 'family or assembly';
    case 0x0004: return 'family';
    case 0x0003: return 'assembly';
    case 0x0002: return 'private';
    case 0x0001: return 'private';
    default: return 'private';
  }
}

export function isMethodStatic(flags: number): boolean {
  return (flags & 0x0010) !== 0;
}

export function isMethodVirtual(flags: number): boolean {
  return (flags & 0x0040) !== 0;
}

export function isMethodAbstract(flags: number): boolean {
  return (flags & 0x0400) !== 0;
}

// Type visibility helpers
export function getTypeVisibility(flags: number): string {
  const vis = flags & 0x07;
  switch (vis) {
    case 0x00: return '';
    case 0x01: return 'public';
    case 0x02: return 'nested public';
    case 0x03: return 'nested private';
    default: return '';
  }
}

export function isTypeAbstract(flags: number): boolean {
  return (flags & 0x0080) !== 0;
}

export function isTypeSealed(flags: number): boolean {
  return (flags & 0x0100) !== 0;
}

export function isTypeInterface(flags: number): boolean {
  return (flags & 0x0020) !== 0;
}
