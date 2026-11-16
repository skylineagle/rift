import type { PayloadFormat, Target } from "@/lib/types";

export const TARGET_LABELS: Record<Target, string> = { A: "A", B: "B", Both: "A+B" };

export const FORMAT_LABELS: Record<PayloadFormat, string> = {
  text: "TXT",
  hex: "HEX",
  binary: "BIN",
  file: "FILE",
};

export const FORMAT_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "hex", label: "Hex" },
  { value: "binary", label: "Binary" },
  { value: "file", label: "File" },
];

export const PLACEHOLDERS: Record<PayloadFormat, string> = {
  text: "$PUBX,00*33\\r\\n",
  hex: "B5 62 06 08 06 00",
  binary: "00100100 01010000",
  file: "",
};

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
