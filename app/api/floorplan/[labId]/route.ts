import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ labId: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { labId } = await ctx.params;
  const img = await prisma.floorplanImage.findUnique({ where: { labId } });
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
