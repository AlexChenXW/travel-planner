import { getPrisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id: parseInt(id) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(conversation);
}
