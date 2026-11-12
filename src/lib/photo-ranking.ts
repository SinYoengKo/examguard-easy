export interface VisualReference {
  id: string;
  guideId: string;
  embedding: number[];
}
export interface PhotoCandidate {
  guideId: string;
  similarity: number;
  referenceId: string;
}
export function normalizeVector(input: ArrayLike<number>): number[] {
  const values = Array.from(input);
  const length = Math.hypot(...values);
  if (values.length !== 512 || !Number.isFinite(length) || length < 1e-9)
    throw new Error("유효한 이미지 특징을 만들지 못했습니다.");
  return values.map((value) => value / length);
}
/** Cosine similarity is an ordering metric, never a class probability. */
export function rankReferences(
  query: ArrayLike<number>,
  references: VisualReference[],
): PhotoCandidate[] {
  const unit = normalizeVector(query);
  const grouped = new Map<string, PhotoCandidate>();
  for (const reference of references) {
    const normalized = normalizeVector(reference.embedding);
    const similarity = unit.reduce(
      (sum, value, i) => sum + value * normalized[i]!,
      0,
    );
    if (
      !grouped.has(reference.guideId) ||
      grouped.get(reference.guideId)!.similarity < similarity
    )
      grouped.set(reference.guideId, {
        guideId: reference.guideId,
        similarity,
        referenceId: reference.id,
      });
  }
  return [...grouped.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}
