import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import formidable from "formidable";
import { IncomingMessage } from "http";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

// Convert Next.js Request to Node IncomingMessage for formidable
async function toNodeRequest(req: NextRequest): Promise<IncomingMessage> {
  const buf = await req.arrayBuffer();
  const readable = new IncomingMessage({} as never);
  readable.headers = Object.fromEntries(req.headers.entries());
  readable.method = req.method;
  readable.url = req.url;
  readable.push(Buffer.from(buf));
  readable.push(null);
  return readable;
}

export async function GET() {
  const files = await prisma.file.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const nodeReq = await toNodeRequest(req);

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    filename: (_name, ext) => `${nanoid()}${ext}`,
  });

  return new Promise<NextResponse>((resolve) => {
    form.parse(nodeReq, async (err, _fields, files) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        return;
      }

      const uploaded = Array.isArray(files.file) ? files.file : files.file ? [files.file] : [];
      if (uploaded.length === 0) {
        resolve(NextResponse.json({ error: "No file uploaded" }, { status: 400 }));
        return;
      }

      const results = [];
      for (const f of uploaded) {
        const relativePath = `/uploads/${path.basename(f.filepath)}`;
        const record = await prisma.file.create({
          data: {
            name: f.originalFilename || path.basename(f.filepath),
            path: relativePath,
            mimeType: f.mimetype || "application/octet-stream",
            size: f.size,
          },
        });
        results.push(record);
      }

      resolve(NextResponse.json(results[0]));
    });
  });
}
