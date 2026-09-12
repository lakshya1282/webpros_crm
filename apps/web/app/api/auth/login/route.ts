import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", req.url));
  }

  // Ensure user exists in Prisma database to satisfy foreign keys
  try {
    const { prisma } = await import("@whatsapp-crm/db");
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { email: data.user.email || email },
      create: { id: data.user.id, email: data.user.email || email },
    });
  } catch (err) {
    console.error("Failed to sync user to database:", err);
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
