/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@/generated/prisma/client";

let _prisma: any;

export function getPrisma() {
  if (!_prisma) {
    _prisma = new (PrismaClient as any)();
  }
  return _prisma;
}
