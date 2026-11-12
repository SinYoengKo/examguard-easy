import {
  readdir,
  readFile,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

// Only synthetic / licensed test screenshots are published. Never copy reports or uploads.
async function walk(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(file)));
    else paths.push(file);
  }
  return paths;
}
await mkdir("dist/previews", { recursive: true });
await writeFile(
  "dist/previews/README.txt",
  "ExamGuard test screenshots. App and diagrams: MIT. The photo visible in photo-results screenshots is CCadio's Ray-Ban Meta Gen 1 smart glasses with charging case, cropped; CC BY 4.0. Source: https://commons.wikimedia.org/wiki/File:Ray-Ban_Meta_Gen_1_smart_glasses_with_charging_case.jpg License: https://creativecommons.org/licenses/by/4.0/ No endorsement implied. More: https://github.com/epoko77-ai/examguard/blob/main/docs/THIRD_PARTY.md\n",
);
const files = await walk("test-results");
for (const [project, label] of [
  ["chromium", "desktop"],
  ["webkit-mobile", "mobile"],
]) {
  for (const view of [
    "wireless",
    "guide",
    "guide-detail",
    "optical",
    "photo-results",
    "signature-results",
    "name-hints",
    "focused-scan",
    "browser-guidance",
  ]) {
    const file = files.find(
      (file) => file.includes(project) && path.basename(file) === `${view}.png`,
    );
    if (!file) throw new Error(`Missing screenshot: ${project}/${view}`);
    await copyFile(file, `dist/previews/${label}-${view}.png`);
  }
}
const report = JSON.parse(await readFile("test-results/summary.json", "utf8"));
await writeFile(
  "dist/previews/verification.json",
  JSON.stringify(
    {
      commit: process.env.GITHUB_SHA,
      stats: report.stats,
      note: "Browser emulation and mocked hardware. Same-reference retrieval is not field accuracy.",
    },
    null,
    2,
  ),
);
console.log(
  "Published eighteen test screenshots and verification counts. Photo credit: CCadio / CC BY 4.0, cropped. See docs/THIRD_PARTY.md.",
);
