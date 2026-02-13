import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "operaciones@vectus.local" },
    update: {},
    create: {
      email: "operaciones@vectus.local",
      name: "Operaciones",
      role: "ADMIN",
      area: "OPERATIONS",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });