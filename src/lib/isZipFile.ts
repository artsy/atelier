export function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    return true;
  }
  return file.type === "application/zip" || file.type === "application/x-zip-compressed";
}
