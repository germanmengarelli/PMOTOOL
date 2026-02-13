import { Vertical } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";

const createProjectSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  vertical: z.nativeEnum(Vertical),
  ownerId: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export async function createProject(input: CreateProjectInput) {
  const parsedInput = createProjectSchema.parse(input);

  return prisma.project.create({
    data: parsedInput,
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });
}
