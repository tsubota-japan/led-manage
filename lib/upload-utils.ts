import { prisma } from "./prisma";

export const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/**
 * 表示名の重複を確認し、重複があれば "(2)", "(3)"... と連番を付与して返す。
 */
export async function resolveDisplayName(name: string): Promise<string> {
  const existing = await prisma.file.findFirst({ where: { name } });
  if (!existing) return name;

  const dotIndex = name.lastIndexOf(".");
  const basename = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";

  let n = 2;
  while (true) {
    const candidate = `${basename} (${n})${ext}`;
    const conflict = await prisma.file.findFirst({ where: { name: candidate } });
    if (!conflict) return candidate;
    n++;
  }
}
