import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@bdcat.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "bdcat-admin-change-me";
  const name = process.env.SEED_ADMIN_NAME || "Votlytics Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: Role.ADMIN },
    create: { email, passwordHash, name, role: Role.ADMIN },
  });

  await prisma.appSetting.upsert({
    where: { key: "product_name" },
    update: { value: "Votlytics" },
    create: { key: "product_name", value: "Votlytics" },
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
