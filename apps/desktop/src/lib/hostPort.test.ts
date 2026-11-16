import { describe, expect, test } from "bun:test";

import { isValidPort, joinHostPort, parseHostPort } from "@/lib/hostPort";

describe("parseHostPort", () => {
  test("splits hostname and ipv4 addresses", () => {
    expect(parseHostPort("localhost:9000")).toEqual({ host: "localhost", port: "9000" });
    expect(parseHostPort("0.0.0.0:5000")).toEqual({ host: "0.0.0.0", port: "5000" });
  });

  test("keeps partial input editable", () => {
    expect(parseHostPort("host:")).toEqual({ host: "host", port: "" });
    expect(parseHostPort(":80")).toEqual({ host: "", port: "80" });
    expect(parseHostPort("")).toEqual({ host: "", port: "" });
    expect(parseHostPort("host")).toEqual({ host: "host", port: "" });
  });

  test("understands bracketed ipv6", () => {
    expect(parseHostPort("[::1]:9000")).toEqual({ host: "::1", port: "9000" });
    expect(parseHostPort("[fe80::1]:")).toEqual({ host: "fe80::1", port: "" });
  });

  test("treats bare ipv6 as a host without a port", () => {
    expect(parseHostPort("::1")).toEqual({ host: "::1", port: "" });
  });
});

describe("joinHostPort", () => {
  test("joins and brackets ipv6 hosts", () => {
    expect(joinHostPort({ host: "localhost", port: "9000" })).toBe("localhost:9000");
    expect(joinHostPort({ host: "::1", port: "9000" })).toBe("[::1]:9000");
  });

  test("round trips", () => {
    for (const address of ["h:1", "[::1]:65535", ":22", "host:"]) {
      expect(joinHostPort(parseHostPort(address))).toBe(address);
    }
  });
});

describe("isValidPort", () => {
  test("accepts 1 to 65535 only", () => {
    expect(isValidPort("1")).toBe(true);
    expect(isValidPort("65535")).toBe(true);
    expect(isValidPort("0")).toBe(false);
    expect(isValidPort("65536")).toBe(false);
    expect(isValidPort("")).toBe(false);
    expect(isValidPort("80.5")).toBe(false);
    expect(isValidPort("-1")).toBe(false);
  });
});
