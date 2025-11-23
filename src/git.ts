import { execSync } from "child_process";


export function runGitCommand(cmd: string[], cwd?: string): { stdout: string, stderr: string } {
  try {
    const out = execSync(["git", ...cmd].join(" "), {
      encoding: "utf8",
      cwd: cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 100 * 1024 * 1024
    })

    return { stdout: out, stderr: " " };
  } catch (err: any) {
    const stderr = err.stderr ? String(err.stderr) : err.message;
    return { stdout: "", stderr };
  }
}


export function readStageDiff({ maxBytes = 200000 }: { maxBytes?: number } = {}) {
  const res = runGitCommand(["diff", "--cached", "--unified=10"]);
  let diff = res.stdout;
  if (!diff) return { diff: "", truncated: false, error: res.stderr || null };

  let truncated = false;
  if (Buffer.byteLength(diff, "utf8") > maxBytes) {
    diff = diff.slice(0, maxBytes);
    truncated = true;
  }

  return { diff, truncated, error: null };

}



export function readChangedFiles() {
  const res = runGitCommand(["diff", "--cached", "--name-only"]);
  const raw = res.stdout || "";
  const files = raw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
  return { files, error: res.stderr || null };
}

