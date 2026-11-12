import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  env,
  RawImage,
} from "@huggingface/transformers";
import { rankReferences } from "./photo-ranking";
import type { VisualReference } from "./photo-ranking";

type Request = {
  id: number;
  base: string;
  data: Uint8ClampedArray;
  width: number;
  height: number;
};
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(value: unknown): void;
};
let resources: ReturnType<typeof loadResources> | null = null;
async function loadResources(base: string, id: number) {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = `${base}models/`;
  env.useBrowserCache = false; // Our scoped service worker owns asset caching.
  env.useWasmCache = false; // Keep imports same-origin; do not create blob-module URLs.
  const wasm = env.backends.onnx.wasm!;
  wasm.numThreads = 1; // Works without COOP/COEP, including GitHub Pages.
  wasm.proxy = false;
  wasm.wasmPaths = {
    mjs: `${base}ort/ort-wasm-simd-threaded.mjs`,
    wasm: `${base}ort/ort-wasm-simd-threaded.wasm`,
  };
  const [model, processor, response] = await Promise.all([
    CLIPVisionModelWithProjection.from_pretrained("clip-vit-base-patch32", {
      dtype: "q8",
      device: "wasm",
      progress_callback: (progress) => {
        if (progress.status === "progress" && "progress" in progress)
          scope.postMessage({
            type: "progress",
            id,
            message: `사진 대조 모델 준비 중 · ${Math.round(progress.progress)}% 다운로드`,
          });
      },
    }),
    AutoProcessor.from_pretrained("clip-vit-base-patch32"),
    fetch(`${base}visual-references.json`),
  ]);
  if (!response.ok) throw new Error("도감 참조 데이터를 읽지 못했습니다.");
  const catalog = (await response.json()) as { references: VisualReference[] };
  return { model, processor, references: catalog.references };
}
scope.onmessage = async (event) => {
  const { id, base, data, width, height } = event.data;
  try {
    resources ??= loadResources(base, id).catch((error) => {
      resources = null;
      throw error;
    });
    const { model, processor, references } = await resources;
    scope.postMessage({
      type: "progress",
      id,
      message: "사진의 외형을 도감 참조 이미지와 비교하고 있습니다…",
    });
    const image = new RawImage(data, width, height, 4);
    const inputs = await processor(image);
    const output = await model(inputs);
    const candidates = rankReferences(
      output.image_embeds.data as Float32Array,
      references,
    );
    for (const tensor of Object.values(output))
      (tensor as { dispose?: () => void }).dispose?.();
    (inputs.pixel_values as { dispose?: () => void }).dispose?.();
    scope.postMessage({ type: "result", id, candidates });
  } catch (error) {
    scope.postMessage({
      type: "error",
      id,
      message:
        error instanceof Error
          ? error.message
          : "사진 대조를 실행하지 못했습니다.",
    });
  }
};
