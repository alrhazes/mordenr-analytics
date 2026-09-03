import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@sentra.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "sentra-admin-change-me";
  const name = process.env.SEED_ADMIN_NAME || "SENTRA Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: Role.ADMIN },
    create: { email, passwordHash, name, role: Role.ADMIN },
  });

  await prisma.appSetting.upsert({
    where: { key: "product_name" },
    update: { value: "SENTRA" },
    create: { key: "product_name", value: "SENTRA" },
  });

  console.log(`Seeded admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
