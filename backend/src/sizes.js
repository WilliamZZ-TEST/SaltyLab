export const SIZE_OPTIONS = {
  "2K": { width: 2048, height: 2048 },
  "4K": { width: 4096, height: 4096 },
  "3840x2160": { width: 3840, height: 2160 },
  "2160x3840": { width: 2160, height: 3840 },
  "1024x1536": { width: 1024, height: 1536 },
  "1536x1024": { width: 1536, height: 1024 },
  "Amazon A+ 1463x600": { width: 1463, height: 600 }
};

export function resolveSize(label) {
  return SIZE_OPTIONS[label] || SIZE_OPTIONS["1024x1536"];
}
