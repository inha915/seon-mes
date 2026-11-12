import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** 인터랙티브 트랜잭션 클라이언트 타입 */
export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
