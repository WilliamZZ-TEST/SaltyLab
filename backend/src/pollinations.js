const POLLINATIONS_IMAGE_BASE = "https://image.pollinations.ai/prompt";

export async function generatePollinationsImage({ prompt, width, height, modelLabel, seed }) {
  const mappedModel = modelLabel === "Nano Banana" ? "flux" : "turbo";
  const url = new URL(`${POLLINATIONS_IMAGE_BASE}/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("model", mappedModel);
  url.searchParams.set("seed", String(seed ?? Math.floor(Math.random() * 999999)));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("enhance", "true");

  const response = await fetch(url, {
    headers: { accept: "image/*" },
    signal: AbortSignal.timeout(90000)
  });

  if (!response.ok) {
    throw new Error(`Pollinations request failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType
  };
}
