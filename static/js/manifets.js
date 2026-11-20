
export async function listImages(folder) {
  let manifest;
  manifest ??= await fetch('images/manifest.json').then((r) => r.json());
  return manifest[folder] ?? [];
}