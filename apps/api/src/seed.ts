import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin12345"; // change this in real deployments

async function main() {
  const existing = await prisma.admin.findUnique({
    where: { username: ADMIN_USERNAME },
  });

  if (existing) {
    console.log(`Admin "${ADMIN_USERNAME}" already exists. Skipping.`);
    return;
  }

  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
  });

  await prisma.admin.create({
    data: {
      username: ADMIN_USERNAME,
      passwordHash,
    },
  });

  console.log(`Created admin "${ADMIN_USERNAME}".`);
  console.log(`Password: "${ADMIN_PASSWORD}" (store this securely).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });