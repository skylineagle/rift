import { expect, test } from "bun:test";

test("injection and logger component regressions in an isolated DOM", async () => {
  const process = Bun.spawn(["bun", "test", "./src/components/streamBehavior.check.tsx"], {
    cwd: import.meta.dir + "/../..",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, errors, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  expect({ exitCode, output: exitCode ? output + errors : "" }).toEqual({ exitCode: 0, output: "" });
});
