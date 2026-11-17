export type HexDumpLine = { offset: string; hex: string; ascii: string };

const hexByte = (byte: number) => byte.toString(16).padStart(2, '0');
const printable = (byte: number) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.');

export const bytesFromText = (text: string): number[] =>
  Array.from(text, (character) => character.charCodeAt(0));

export const hexDumpLines = (bytes: number[]): HexDumpLine[] => {
  const lines: HexDumpLine[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    lines.push({
      offset: offset.toString(16).padStart(4, '0'),
      hex: chunk.map(hexByte).join(' ').padEnd(47, ' '),
      ascii: chunk.map(printable).join(''),
    });
  }
  return lines;
};
