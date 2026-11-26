import type { FileSinkConfig, HttpSinkConfig, LoggingConfig } from "@/lib/types";

const BYTES_PER_MEGABYTE = 1024 * 1024;

export type HeaderRow = { id: number; name: string; value: string };

export type FileDraft = Omit<FileSinkConfig, "max_file_bytes" | "max_files" | "max_total_bytes"> & {
  maxFileMegabytes: number | null;
  maxFiles: number | null;
  maxTotalMegabytes: number | null;
};

export type HttpDraft = Omit<HttpSinkConfig, "batch_size" | "flush_interval_secs" | "timeout_secs" | "headers"> & {
  batchSize: number | null;
  flushIntervalSeconds: number | null;
  timeoutSeconds: number | null;
  headers: HeaderRow[];
};

export type LoggingDraft = Pick<LoggingConfig, "level" | "console"> & {
  statsIntervalSeconds: number | null;
  file: FileDraft;
  http: HttpDraft;
};

export type LoggingField =
  | "statsInterval"
  | "fileName"
  | "maxFileSize"
  | "maxFiles"
  | "maxTotalSize"
  | "url"
  | "headers"
  | "batchSize"
  | "flushInterval"
  | "timeout";

export type LoggingErrors = Partial<Record<LoggingField, string>>;

export type Destination = "console" | "file" | "http";

const DESTINATION_FIELDS: Record<Destination, LoggingField[]> = {
  console: [],
  file: ["fileName", "maxFileSize", "maxFiles", "maxTotalSize"],
  http: ["url", "headers", "batchSize", "flushInterval", "timeout"],
};

export const bytesToMegabytes = (bytes: number) => bytes / BYTES_PER_MEGABYTE;

export const DEFAULT_LOG_FILE_NAME = "rift-desktop.log";

export const megabytesToBytes = (megabytes: number) => Math.round(megabytes * BYTES_PER_MEGABYTE);

export const toDraft = ({ level, stats_interval_secs, console, file, http }: LoggingConfig): LoggingDraft => ({
  level,
  console,
  statsIntervalSeconds: stats_interval_secs,
  file: {
    enabled: file.enabled,
    directory: file.directory,
    file_name: file.file_name,
    rotate: file.rotate,
    maxFileMegabytes: bytesToMegabytes(file.max_file_bytes),
    maxFiles: file.max_files,
    maxTotalMegabytes: file.max_total_bytes === undefined ? null : bytesToMegabytes(file.max_total_bytes),
  },
  http: {
    enabled: http.enabled,
    url: http.url,
    format: http.format,
    batchSize: http.batch_size,
    flushIntervalSeconds: http.flush_interval_secs,
    timeoutSeconds: http.timeout_secs,
    headers: Object.entries(http.headers).map(([name, value], id) => ({ id, name, value })),
  },
});

const filledHeaders = (rows: HeaderRow[]) => rows.filter((row) => row.name.trim() || row.value);

const isWholeAtLeast = (value: number | null, minimum: number) =>
  value !== null && Number.isInteger(value) && value >= minimum;

const wholeOr = (value: number | null, minimum: number, fallback: number) =>
  value !== null && isWholeAtLeast(value, minimum) ? value : fallback;

const isPositive = (value: number | null) => value !== null && value > 0;

export const toConfig = (draft: LoggingDraft, saved: LoggingConfig): LoggingConfig => {
  const { file, http } = draft;
  return {
    level: draft.level,
    console: draft.console,
    stats_interval_secs: wholeOr(draft.statsIntervalSeconds, 0, saved.stats_interval_secs),
    file: {
      enabled: file.enabled,
      directory: file.directory,
      file_name: file.file_name.trim(),
      rotate: file.rotate,
      max_file_bytes:
        file.maxFileMegabytes !== null && file.maxFileMegabytes > 0
          ? megabytesToBytes(file.maxFileMegabytes)
          : saved.file.max_file_bytes,
      max_files: wholeOr(file.maxFiles, 0, saved.file.max_files),
      max_total_bytes:
        file.maxTotalMegabytes !== null && file.maxTotalMegabytes > 0
          ? megabytesToBytes(file.maxTotalMegabytes)
          : undefined,
    },
    http: {
      enabled: http.enabled,
      url: http.url.trim(),
      format: http.format,
      batch_size: wholeOr(http.batchSize, 1, saved.http.batch_size),
      flush_interval_secs: wholeOr(http.flushIntervalSeconds, 1, saved.http.flush_interval_secs),
      timeout_secs: wholeOr(http.timeoutSeconds, 1, saved.http.timeout_secs),
      headers: Object.fromEntries(filledHeaders(http.headers).map((row) => [row.name.trim(), row.value])),
    },
  };
};

export const isHttpUrl = (value: string) => {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) && URL.canParse(trimmed);
};

const headersError = (rows: HeaderRow[]) => {
  const names = filledHeaders(rows).map((row) => row.name.trim().toLowerCase());
  if (names.includes("")) return "Every header needs a name";
  if (new Set(names).size !== names.length) return "Header names must be unique";
  return undefined;
};

const fileErrors = (file: FileDraft): LoggingErrors => {
  return {
    fileName: /[/\\]/.test(file.file_name.trim()) ? "Enter a file name without slashes" : undefined,
    maxFileSize:
      file.rotate === "size" && !isPositive(file.maxFileMegabytes) ? "Must be above 0" : undefined,
    maxFiles: isWholeAtLeast(file.maxFiles, 0) ? undefined : "Whole number, 0 or more",
    maxTotalSize:
      file.maxTotalMegabytes !== null && !isPositive(file.maxTotalMegabytes) ? "Must be above 0" : undefined,
  };
};

const atLeastOne = (value: number | null) =>
  isWholeAtLeast(value, 1) ? undefined : "Whole number, 1 or more";

const httpErrors = (http: HttpDraft): LoggingErrors => ({
  url: isHttpUrl(http.url) ? undefined : "Enter a URL starting with http:// or https://",
  headers: headersError(http.headers),
  batchSize: atLeastOne(http.batchSize),
  flushInterval: atLeastOne(http.flushIntervalSeconds),
  timeout: atLeastOne(http.timeoutSeconds),
});

export const validateDraft = (draft: LoggingDraft): LoggingErrors => {
  const errors: LoggingErrors = {
    statsInterval: isWholeAtLeast(draft.statsIntervalSeconds, 0) ? undefined : "Whole number, 0 or more",
    ...(draft.file.enabled ? fileErrors(draft.file) : {}),
    ...(draft.http.enabled ? httpErrors(draft.http) : {}),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
};

export const hasDestinationError = (errors: LoggingErrors, destination: Destination) =>
  DESTINATION_FIELDS[destination].some((field) => errors[field] !== undefined);

const comparable = (draft: LoggingDraft) =>
  JSON.stringify({
    ...draft,
    http: {
      ...draft.http,
      headers: filledHeaders(draft.http.headers).map(({ name, value }) => [name, value]),
    },
  });

export const isDirty = (draft: LoggingDraft, saved: LoggingConfig) =>
  comparable(draft) !== comparable(toDraft(saved));

export const hasEnabledSink = (config: LoggingConfig | null) =>
  config !== null && (config.console.enabled || config.file.enabled || config.http.enabled);

export const logFilePaths = ({ file }: LoggingConfig, defaultDirectory: string) => {
  const directory = file.directory ?? defaultDirectory;
  return { directory, current: `${directory.replace(/[/\\]$/, "")}/${file.file_name || DEFAULT_LOG_FILE_NAME}` };
};
