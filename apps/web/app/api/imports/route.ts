import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@whatsapp-crm/db";

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tagName = formData.get("tagName") as string | undefined;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const fileExt = file.name.toLowerCase().split(".").pop();
    if (!allowedTypes.includes(file.type) && !["csv", "xlsx", "xls"].includes(fileExt || "")) {
      return NextResponse.json(
        { error: "Only CSV and Excel files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB" },
        { status: 400 }
      );
    }

    // Create ImportBatch record
    const batch = await prisma.importBatch.create({
      data: {
        userId: user.id,
        filename: file.name,
        status: "UPLOADED",
        tagName: tagName || null,
      },
    });

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const storageKey = `${user.id}/${batch.id}/${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const adminSupabase = createAdminClient();
    const { error: uploadError } = await adminSupabase.storage
      .from("imports")
      .upload(storageKey, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: "FAILED", errorMessage: uploadError.message },
      });

      const message = uploadError.message.toLowerCase().includes("bucket not found")
        ? "Storage bucket 'imports' not found. Please create a bucket named 'imports' in your Supabase Dashboard -> Storage."
        : `Upload failed: ${uploadError.message}`;

      return NextResponse.json({ error: message }, { status: 500 });
    }

  // Update batch with storage key
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { storageKey, status: "PARSING" },
  });

  // Parse headers for column mapping (synchronously for small/medium files)
  let detectedHeaders: string[] = [];
  try {
    if (fileExt === "csv") {
      const text = Buffer.from(arrayBuffer).toString("utf-8");
      const firstLine = text.split("\n")[0];
      detectedHeaders = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    } else {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      detectedHeaders = (json[0] || []).map(String);
    }
  } catch {
    detectedHeaders = [];
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "VALIDATING" },
  });

    return NextResponse.json({
      batch: { id: batch.id, filename: batch.filename },
      detectedHeaders,
      storageKey,
    }, { status: 201 });
  } catch (err: any) {
    console.error("Import upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process import file" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { user } = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batches = await prisma.importBatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ batches });
}
