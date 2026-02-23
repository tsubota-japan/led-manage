import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DisplayPlayer from "@/components/display/DisplayPlayer";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const display = await prisma.display.findUnique({
    where: { code },
  });

  if (!display) {
    notFound();
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      <DisplayPlayer code={code} />
    </div>
  );
}
