import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Médiathèque — Supabase Storage (bucket « media », public en lecture).
 * Toutes les écritures passent par le client service_role CÔTÉ SERVEUR :
 * aucun upload anonyme possible (aucune policy d'écriture).
 */

export const MEDIA_BUCKET = "media";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export interface MediaObject {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string;
}

export interface MediaListResult {
  objects: MediaObject[];
  unavailable: boolean;
}

function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export async function listMedia(): Promise<MediaListResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { objects: [], unavailable: true };

  const { data, error } = await admin.storage.from(MEDIA_BUCKET).list("uploads", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    console.error("[data/media] listMedia :", error.message);
    return { objects: [], unavailable: true };
  }

  const objects: MediaObject[] = (data ?? [])
    .filter((o) => o.id !== null && !o.name.startsWith("."))
    .map((o) => ({
      name: o.name,
      path: `uploads/${o.name}`,
      size: o.metadata?.size ?? 0,
      type: o.metadata?.mimetype ?? "",
      url: publicUrl(`uploads/${o.name}`),
    }));

  return { objects, unavailable: false };
}

/**
 * Upload validé côté serveur : MIME images uniquement, 5 Mo max,
 * nom de fichier sécurisé (slugifié + horodatage).
 */
export async function uploadMedia(
  file: File
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "storage_not_configured" };

  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: `Type non autorisé (${file.type || "inconnu"})` };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "Fichier trop lourd (5 Mo maximum)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `uploads/${safeName}`;

  const { error } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[data/media] uploadMedia :", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, url: publicUrl(path) };
}

export async function deleteMedia(
  path: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, error: "storage_not_configured" };

  // Sécurité : uniquement des fichiers du dossier uploads/, sans ../
  if (!path.startsWith("uploads/") || path.includes("..")) {
    return { ok: false, error: "Chemin refusé" };
  }

  const { error } = await admin.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}