import { getPrisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const prisma = getPrisma();
  const profile = await prisma.profile.findFirst();
  if (!profile) {
    return NextResponse.json({
      departureCities: "深圳/香港/广州",
      preferences: {},
      constraints: {},
      visitedPlaces: [],
      feedback: [],
    });
  }
  return NextResponse.json({
    ...profile,
    preferences: JSON.parse(profile.preferences),
    constraints: JSON.parse(profile.constraints),
    visitedPlaces: JSON.parse(profile.visitedPlaces),
    feedback: JSON.parse(profile.feedback),
  });
}

export async function POST(req: Request) {
  const prisma = getPrisma();
  const body = await req.json();
  const existing = await prisma.profile.findFirst();

  const data = {
    departureCities: body.departureCities || "深圳/香港/广州",
    preferences: JSON.stringify(body.preferences || {}),
    constraints: JSON.stringify(body.constraints || {}),
    visitedPlaces: JSON.stringify(body.visitedPlaces || []),
    feedback: JSON.stringify(body.feedback || []),
  };

  const profile = existing
    ? await prisma.profile.update({ where: { id: existing.id }, data })
    : await prisma.profile.create({ data });

  return NextResponse.json(profile);
}
