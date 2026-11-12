import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  env,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";

// Manufacturer photos stay in ignored .local. Only numerical descriptors are exported.
const sources = JSON.parse(
  await readFile("docs/reference-sources.json", "utf8"),
);
await mkdir(".local/reference-images", { recursive: true });
env.localModelPath = "./public/models/";
env.allowRemoteModels = false;
const model = await CLIPVisionModelWithProjection.from_pretrained(
  "clip-vit-base-patch32",
  { dtype: "q8", device: "cpu" },
);
const processor = await AutoProcessor.from_pretrained("clip-vit-base-patch32");
const references = [];
try {
  for (const source of sources.references) {
    const local = `.local/reference-images/${source.file}`;
    let image;
    try {
      image = await readFile(local);
    } catch {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok)
        throw new Error(
          `Reference download failed: ${source.id} ${response.status}`,
        );
      image = Buffer.from(await response.arrayBuffer());
      await writeFile(local, image);
    }
    const sha256 = createHash("sha256").update(image).digest("hex");
    if (source.sha256 && source.sha256 !== sha256)
      throw new Error(
        `Reference changed: ${source.id}. Review the image before updating its hash.`,
      );
    let transform = sharp(image);
    if (source.crop) {
      const [left, top, width, height] = source.crop;
      transform = transform.extract({ left, top, width, height });
    }
    const pixels = await transform
      .flatten({ background: "#fff" })
      .resize(512, 512, { fit: "contain", background: "#fff" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const inputs = await processor(
      new RawImage(new Uint8ClampedArray(pixels), 512, 512, 4),
    );
    const outputs = await model(inputs);
    const values = Array.from(outputs.image_embeds.data);
    const norm = Math.hypot(...values);
    if (values.length !== 512 || !Number.isFinite(norm) || norm === 0)
      throw new Error("Invalid descriptor");
    references.push({
      id: source.id,
      guideId: source.guideId,
      embedding: values.map((n) => Number((n / norm).toFixed(8))),
      sha256,
    });
    source.sha256 = sha256;
    for (const tensor of Object.values(outputs)) tensor.dispose?.();
    inputs.pixel_values.dispose?.();
    console.log(`Indexed ${source.id} → ${source.guideId}`);
  }
} finally {
  await model.dispose();
}
await writeFile(
  "docs/reference-sources.json",
  JSON.stringify(sources, null, 2) + "\n",
);
await writeFile(
  "public/visual-references.json",
  JSON.stringify({
    schema: "examguard.visual.v1",
    model: sources.model,
    revision: sources.revision,
    preprocess:
      "white letterbox 512px; CLIP processor; q8 vision projection; L2 normalize",
    references,
  }),
);
console.log(
  `${references.length} references indexed. This is not an accuracy evaluation.`,
);
