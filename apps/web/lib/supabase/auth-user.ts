import { createClient } from "./server";
import { prisma } from "@whatsapp-crm/db";

/**
 * Retrieves authenticated user and ensures existence in Prisma DB
 * to prevent foreign key violations across the application.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  try {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email || "" },
      create: { id: user.id, email: user.email || "" },
    });
  } catch (err) {
    console.error("User sync error:", err);
  }

  return { supabase, user };
}
