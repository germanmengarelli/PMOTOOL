import { NextResponse } from "next/server";
import { z } from "zod";
import { advanceProjectPhase } from "@/server/gates/service";
import { appRoleSchema, areaSchema, type SessionUser } from "@/server/auth/authorization";

const payloadSchema = z.object({
  toPhase: z.enum(["F0", "F1", "F2", "F3", "F4", "F5", "F6"]),
});

function parseActor(request: Request): SessionUser {
  const actorId = request.headers.get("x-user-id") ?? "";
  const actorEmail = request.headers.get("x-user-email") ?? "";
  const roleRaw = request.headers.get("x-user-role") ?? "USER";
  const areaRaw = request.headers.get("x-user-area") ?? "OPERATIONS";

  return {
    id: actorId,
    email: actorEmail,
    role: appRoleSchema.parse(roleRaw),
    area: areaSchema.parse(areaRaw),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const actor = parseActor(request);
  const body = payloadSchema.parse(await request.json());
  const { projectId } = await context.params;

  const project = await advanceProjectPhase({
    projectId,
    toPhase: body.toPhase,
  }, actor);

  return NextResponse.json(project);
}