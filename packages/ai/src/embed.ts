/**
 * packages/ai/src/embed.ts — capability⇄scope embeddings for the pgvector semantic match (CLAUDE.md §6).
 * Anthropic models do NOT produce embeddings; Voyage does. The dimension MUST match the DB's vector
 * columns (@hermes/db EMBED_DIM = 1024 for voyage-3.5) or we fail closed.
 */

/** MUST match @hermes/db `EMBED_DIM` (voyage-3.5 → 1024). Pinned here to keep @hermes/ai DB-free. */
export const EMBED_DIM = 1024;

interface VoyageResponse {
  data: { embedding: number[] }[];
}

export async function embed(text: string, model = "voyage-3.5"): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set.");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: text, model }),
  });
  if (!res.ok) throw new Error(`Voyage embedding failed: ${res.status} ${res.statusText}`);

  const json = (await res.json()) as VoyageResponse;
  const embedding = json.data[0]?.embedding;
  if (!embedding) throw new Error("Voyage embedding response had no data.");
  if (embedding.length !== EMBED_DIM) {
    throw new Error(`Embedding dimension ${embedding.length} != expected ${EMBED_DIM} (${model}).`);
  }
  return embedding;
}
