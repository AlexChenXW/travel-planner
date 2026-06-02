import { getPrisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const prisma = getPrisma();
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return NextResponse.json(conversations);
}

export async function DELETE(req: Request) {
  const prisma = getPrisma();
  const { id } = await req.json();
  await prisma.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
