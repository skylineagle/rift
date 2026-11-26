import { describe, expect, test } from "bun:test";

import {
  bytesToMegabytes,
  hasDestinationError,
  hasEnabledSink,
  isDirty,
  isHttpUrl,
  logFilePaths,
  megabytesToBytes,
  toConfig,
  toDraft,
  validateDraft,
} from "@/lib/loggingSettings";
import type { LoggingConfig } from "@/lib/types";

const config: LoggingConfig = {
  level: "info",
  stats_interval_secs: 60,
  console: { enabled: false, format: "text" },
  file: { enabled: false, file_name: "rift.log", rotate: "size", max_file_bytes: 10_485_760, max_files: 10 },
  http: {
    enabled: false,
    url: "http://localhost:8080",
    format: "ndjson",
    batch_size: 100,
    flush_interval_secs: 5,
    timeout_secs: 10,
    headers: { Authorization: "token" },
  },
};

describe("logging settings", () => {
  test("converts megabytes without losing odd byte counts", () => {
    expect(bytesToMegabytes(10_485_760)).toBe(10);
    expect(megabytesToBytes(bytesToMegabytes(100_000_000))).toBe(100_000_000);
  });

  test("round trips a config through the draft", () => {
    expect(toConfig(toDraft(config), config)).toEqual(config);
    expect(isDirty(toDraft(config), config)).toBe(false);
  });

  test("ignores blank header rows", () => {
    const draft = toDraft(config);
    draft.http.headers.push({ id: 1, name: "", value: "" });
    expect(isDirty(draft, config)).toBe(false);
    expect(toConfig(draft, config).http.headers).toEqual({ Authorization: "token" });
  });

  test("detects changes and clears the storage cap", () => {
    const capped = { ...config, file: { ...config.file, max_total_bytes: 1_048_576 } };
    const draft = toDraft(capped);
    draft.file.maxTotalMegabytes = null;
    expect(isDirty(draft, capped)).toBe(true);
    expect(toConfig(draft, capped).file.max_total_bytes).toBeUndefined();
  });

  test("only validates enabled sinks", () => {
    const draft = toDraft(config);
    draft.http.url = "nope";
    draft.file.maxFiles = null;
    expect(validateDraft(draft)).toEqual({});
    expect(toConfig(draft, config).file.max_files).toBe(10);
    draft.http.enabled = true;
    draft.file.enabled = true;
    expect(Object.keys(validateDraft(draft)).sort()).toEqual(["maxFiles", "url"]);
    expect(hasDestinationError(validateDraft(draft), "http")).toBe(true);
    expect(hasDestinationError(validateDraft(draft), "console")).toBe(false);
  });

  test("skips the size limit for time rotation", () => {
    const draft = toDraft(config);
    draft.file = { ...draft.file, enabled: true, rotate: "daily", maxFileMegabytes: null };
    expect(validateDraft(draft)).toEqual({});
  });

  test("rejects unnamed and duplicate headers", () => {
    const draft = toDraft(config);
    draft.http.enabled = true;
    draft.http.headers = [{ id: 0, name: "", value: "x" }];
    expect(validateDraft(draft).headers).toBe("Every header needs a name");
    draft.http.headers = [
      { id: 0, name: "a", value: "1" },
      { id: 1, name: "A", value: "2" },
    ];
    expect(validateDraft(draft).headers).toBe("Header names must be unique");
  });

  test("accepts only http urls", () => {
    expect(isHttpUrl("https://logs.example.com/in")).toBe(true);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("http://")).toBe(false);
  });

  test("reports enabled sinks and log paths", () => {
    expect(hasEnabledSink(null)).toBe(false);
    expect(hasEnabledSink(config)).toBe(false);
    expect(hasEnabledSink({ ...config, console: { enabled: true, format: "json" } })).toBe(true);
    expect(logFilePaths(config, "/var/logs/").current).toBe("/var/logs/rift.log");
  });
});
