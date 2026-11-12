import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const modelRevision = "6b7c523703ae26e39be4b03774966f8571c7f523";
export const modelFiles = [
  [
    "config.json",
    "493ef57ff783e42d1530c91b53469b7fdf8db8a9c1408e86998fcb7899a4f495",
  ],
  [
    "preprocessor_config.json",
    "6f638fb9401a6d6296feff533ee7efe657b787c49f954f82f5906b36ef2a1b1f",
  ],
  [
    "onnx/vision_model_quantized.onnx",
    "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299",
  ],
];
const digest = (data) => createHash("sha256").update(data).digest("hex");
for (const [file, expected] of modelFiles) {
  const target = path.join("public/models/clip-vit-base-patch32", file);
  let data;
  try {
    data = await readFile(target);
  } catch {
    /* Download missing assets. */
  }
  if (!data || digest(data) !== expected) {
    console.log(`Downloading pinned model asset: ${file}`);
    const response = await fetch(
      `https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/${modelRevision}/${file}`,
      { signal: AbortSignal.timeout(180_000) },
    );
    if (!response.ok)
      throw new Error(`Model download failed: ${response.status} ${file}`);
    data = Buffer.from(await response.arrayBuffer());
    if (digest(data) !== expected)
      throw new Error(`Integrity mismatch: ${file}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  console.log(`Verified ${file}: ${(data.length / 1_000_000).toFixed(2)} MB`);
}
await mkdir("public/ort", { recursive: true });
for (const file of [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
]) {
  await copyFile(
    `node_modules/onnxruntime-web/dist/${file}`,
    `public/ort/${file}`,
  );
}
await copyFile("public/licenses/onnxruntime-MIT.txt", "public/ort/LICENSE.txt");
console.log(
  "Model and local WASM runtime are ready. No runtime CDN is needed.",
);
