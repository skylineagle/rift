const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export const formatInteger = (value: number) => value.toLocaleString("en-US");

export const formatBytes = (value: number) => {
  const rounded = Math.round(value);
  if (rounded < 1000) return `${rounded} B`;
  if (rounded < 1e6) return `${(rounded / 1e3).toFixed(1)} kB`;
  if (rounded < 1e9) return `${(rounded / 1e6).toFixed(2)} MB`;
  return `${(rounded / 1e9).toFixed(2)} GB`;
};

export const formatRate = (value: number) => `${formatBytes(value)}/s`;

export const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};

const hexByte = (byte: number) => byte.toString(16).toUpperCase().padStart(2, "0");

export const hexString = (bytes: number[], limit = bytes.length) => {
  const shown = bytes.slice(0, limit).map(hexByte).join(" ");
  return limit < bytes.length ? `${shown} …` : shown;
};

export const printableAscii = (bytes: number[]) =>
  bytes.map((byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".")).join("");

export type HexDumpLine = { offset: string; hex: string; ascii: string };

export const hexDumpLines = (bytes: number[]): HexDumpLine[] => {
  const lines: HexDumpLine[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    lines.push({
      offset: offset.toString(16).padStart(4, "0"),
      hex: chunk.map(hexByte).join(" ").padEnd(47, " "),
      ascii: printableAscii(chunk),
    });
  }
  return lines;
};

export const errorMessage = (error: unknown) =>
  typeof error === "string" ? error : error instanceof Error ? error.message : "Unknown error";
