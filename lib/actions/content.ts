"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import {
  isAllowedDuration,
  classifyFlash,
  computeExpiry,
  formatConakryDateTime,
  formatConakryTime,
  humanizeDuration,
  parseConakryInput,
  DEFAULT_DURATION_MINUTES,
} from "@/lib/flash/flash-core";
import {
  articleSchema,
  breakingNewsSchema,
  categorySchema,
  deleteArticleSchema,
  deleteBreakingNewsSchema,
  deleteCategorySchema,
  deleteVideoSchema,
  flashRenewSchema,
  videoSchema,
} from "@/lib/validation/schemas";
import {
  ActionState,
  ensureUniqueSlug,
  errorState,
  formDataBool,
  formDataTags,
  slugFromTitleOrInput,
  successState,
  zodFieldErrors,
} from "./helpers";
import { validateImageMarkers } from "@/lib/content/image-marker";

/**
 * Actions du CMS (articles, vidéos, flash-infos, catégories).
 * Garde serveur requireRole() AVANT toute écriture ; la RLS applique
 * en dernier ressort la même règle côté base (défense en profondeur).
 * Aucune écriture en service_role ici : toujours le client de session.
 */

const DENIED_MESSAGES: Record<string, string> = {
  unauthenticated: "Connectez-vous pour effectuer cette action.",
  forbidden: "Votre rôle ne permet pas cette action.",
  unconfigured: "Le back-office n'est pas configuré (voir supabase/README-CONFIGURATION.md).",
};

function deniedState(denied: string): ActionState {
  return errorState(DENIED_MESSAGES[denied] ?? "Action refusée.");
}

// ─────────────────────────────────────────────────────────────
// ARTICLES
// ─────────────────────────────────────────────────────────────

/** Code PostgreSQL « column does not exist » (42703) ou colonne ALT absente. */
function isMissingAltColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || /featured_image_alt/.test(error.message ?? "");
}

const ALT_MIGRATION_MESSAGE =
  "Le texte ALT exige l'activation de la migration 0023 (colonne featured_image_alt) sur le serveur Supabase. Enregistrez sans ALT pour l'instant, ou faites appliquer la migration par la direction.";

export async function saveArticle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor", "reporter"]);
  if ("denied" in guard) return deniedState(guard.denied);
  const { profile } = guard.session;
  const role = profile?.role ?? "reporter";
  const isStaff = role === "admin" || role === "editor";

  const parsed = articleSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    content: formData.get("content"),
    featured_image: formData.get("featured_image") ?? "",
    featured_image_alt: formData.get("featured_image_alt") ?? "",
    category_id: formData.get("category_id") || undefined,
    status: formData.get("status"),
    scheduled_at: formData.get("scheduled_at") ?? "",
    meta_title: formData.get("meta_title") ?? "",
    meta_description: formData.get("meta_description") ?? "",
    is_featured: formDataBool(formData, "is_featured"),
    tags: formDataTags(formData),
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  // Marqueurs images intégrées [[image:chemin]] : chacun doit être valide —
  // un marqueur malformé serait rendu comme texte inerte (jamais comme
  // image) ; on refuse plutôt l'enregistrement avec la ligne fautive.
  const markerProblems = validateImageMarkers(input.content);
  if (markerProblems.length > 0) {
    return errorState(
      `Un marqueur d'image n'est pas valide (ligne ${markerProblems[0].line}) : « ${markerProblems[0].reason} ». Utilisez le bouton « Insérer une image » ou corrigez cette ligne avant d'enregistrer.`
    );
  }

  /**
   * Intention explicite du formulaire (« Publier maintenant », « Enregistrer
   * comme brouillon », « Programmer la publication ») : le bouton soumis
   * l'emporte sur le menu Statut. La valeur d'un submit est garantie dans
   * la FormData — aucun état client. Le reste (rôles, transitions, RLS)
   * est revérifié ci-dessous et en base.
   */
  const INTENT_STATUS = {
    draft: "draft",
    review: "review",
    publish: "published",
    schedule: "scheduled",
  } as const;
  const intentRaw = formData.get("intent");
  const intent =
    typeof intentRaw === "string" && intentRaw in INTENT_STATUS
      ? (intentRaw as keyof typeof INTENT_STATUS)
      : null;
  const status = intent ? INTENT_STATUS[intent] : input.status;

  // Un reporter ne peut soumettre qu'en draft/review (la RLS le
  // réapplique, mais on refuse ici avec un message clair).
  if (!isStaff && !["draft", "review"].includes(status)) {
    return errorState("En tant que reporter, vous ne pouvez enregistrer qu'un brouillon ou le soumettre à validation.");
  }
  // Publication programmée : la date est obligatoire.
  if (status === "scheduled" && !input.scheduled_at) {
    return errorState("Indiquez la date et l'heure de publication programmée.", {
      scheduled_at: "Date requise pour une publication programmée",
    });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const slug = await ensureUniqueSlug("articles", slugFromTitleOrInput(input.title, input.slug), input.id);

  // published_at : figé à la première publication réelle, jamais modifié ensuite.
  let publishedAt: string | null = null;
  if (input.id) {
    const { data: existing } = await supabase
      .from("articles")
      .select("published_at, author_id")
      .eq("id", input.id)
      .maybeSingle();
    if (!existing) {
      return errorState("Article introuvable ou vous n'avez pas la permission de le modifier.");
    }
    // Un reporter ne modifie que ses propres articles (la RLS bloque sinon).
    if (!isStaff && existing.author_id !== guard.session.userId) {
      return errorState("Article introuvable ou vous n'avez pas la permission de le modifier.");
    }
    publishedAt = existing.published_at ?? null;
  }
  if (status === "published" && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  const row = {
    title: input.title,
    slug,
    excerpt: input.excerpt ?? null,
    content: input.content,
    featured_image: input.featured_image ?? null,
    /**
     * ALT de la couverture : transmis UNIQUEMENT s'il est renseigné.
     * Sans la migration 0023 (colonne featured_image_alt absente du serveur),
     * une sauvegarde sans ALT reste fonctionnelle ; avec ALT, l'erreur 42703
     * est traduite en message compréhensible (voir plus bas). Aucun HTML/URL :
     * la validation zod (optionnelText) garantit du texte simple.
     */
    ...(input.featured_image_alt ? { featured_image_alt: input.featured_image_alt } : {}),
    category_id: input.category_id ?? null,
    status,
    scheduled_at: input.scheduled_at ?? null,
    published_at: publishedAt,
    meta_title: input.meta_title ?? null,
    meta_description: input.meta_description ?? null,
    is_featured: input.is_featured,
  };

  let articleId = input.id;
  if (articleId) {
    const { error } = await supabase.from("articles").update(row).eq("id", articleId);
    if (error) {
      if (isMissingAltColumn(error)) {
        return errorState(ALT_MIGRATION_MESSAGE);
      }
      console.error("[actions/content] saveArticle update :", error.message);
      return errorState("Enregistrement impossible. Vérifiez vos droits sur cet article.");
    }
  } else {
    const { data, error } = await supabase
      .from("articles")
      .insert({ ...row, author_id: guard.session.userId })
      .select("id")
      .single();
    if (error || !data) {
      if (error && isMissingAltColumn(error)) {
        return errorState(ALT_MIGRATION_MESSAGE);
      }
      console.error("[actions/content] saveArticle insert :", error?.message);
      return errorState("Création impossible.");
    }
    articleId = data.id;
  }

  // Tags : gérés par editor+ uniquement (policy article_tags_manage).
  // Pour un reporter, le champ est ignoré sans erreur.
  if (articleId && isStaff) {
    await syncArticleTags(supabase, articleId, input.tags);
  }

  revalidatePath("/");
  revalidatePath("/actualites");
  revalidatePath(`/actualites/${slug}`);
  revalidatePath("/admin/articles");

  // Message fidèle à l'action réellement effectuée. Une publication
  // redirige vers la page publique : vérification visuelle immédiate.
  const message =
    status === "published"
      ? "Article publié."
      : status === "scheduled"
        ? "Article programmé : il passera automatiquement en ligne à l'échéance indiquée."
        : status === "review"
          ? "Article soumis à la validation d'un éditeur."
          : status === "archived"
            ? "Article archivé."
            : "Brouillon enregistré.";
  return successState(message, status === "published" ? `/actualites/${slug}` : "/admin/articles");
}

/**
 * Publication directe depuis la liste `/admin/articles` (admin+editor).
 * UPDATE minimal (status + published_at) — reste sous la policy RLS
 * articles_update (le client de session, jamais service_role).
 * La date de publication d'origine est préservée (jamais réinitialisée).
 */
export async function publishArticle(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = deleteArticleSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return errorState("Identifiant d'article invalide.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { data: existing } = await supabase
    .from("articles")
    .select("status, published_at, slug")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing) {
    return errorState("Article introuvable ou vous n'avez pas la permission de le publier.");
  }
  if (existing.status === "published") {
    return errorState("Cet article est déjà publié.");
  }

  const { error } = await supabase
    .from("articles")
    .update({
      status: "published",
      published_at: existing.published_at ?? new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[actions/content] publishArticle :", error.message);
    return errorState("Publication impossible. Vérifiez vos droits sur cet article.");
  }

  revalidatePath("/");
  revalidatePath("/actualites");
  revalidatePath(`/actualites/${existing.slug}`);
  revalidatePath("/admin/articles");
  return successState("Article publié.");
}

/** Remplace les tags d'un article (upsert par slug, puis liaison). */
async function syncArticleTags(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  articleId: string,
  tagNames: string[]
): Promise<void> {
  await supabase.from("article_tags").delete().eq("article_id", articleId);
  if (tagNames.length === 0) return;

  const slugify = (await import("@/lib/utils")).slugify;
  const rows = tagNames.map((name) => ({
    name,
    slug: slugify(name) || slugify(`tag-${Date.now()}`),
  }));

  const { data: tagRows, error } = await supabase
    .from("tags")
    .upsert(rows, { onConflict: "slug" })
    .select("id");
  if (error || !tagRows) {
    console.error("[actions/content] syncArticleTags upsert :", error?.message);
    return;
  }

  const { error: linkError } = await supabase.from("article_tags").insert(
    tagRows.map((t) => ({ article_id: articleId, tag_id: t.id }))
  );
  if (linkError) {
    console.error("[actions/content] syncArticleTags insert :", linkError.message);
  }
}

export async function deleteArticle(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = deleteArticleSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return errorState("Identifiant invalide.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { error } = await supabase.from("articles").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[actions/content] deleteArticle :", error.message);
    return errorState("Suppression impossible.");
  }

  revalidatePath("/");
  revalidatePath("/actualites");
  revalidatePath("/admin/articles");
  return successState("Article supprimé.");
}

// ─────────────────────────────────────────────────────────────
// VIDÉOS — editor+
// ─────────────────────────────────────────────────────────────

export async function saveVideo(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = videoSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    youtube_id: formData.get("youtube_id") ?? "",
    youtube_url: formData.get("youtube_url") ?? "",
    thumbnail_url: formData.get("thumbnail_url") ?? "",
    category_id: formData.get("category_id") || undefined,
    duration: formData.get("duration") ?? "",
    published_at: formData.get("published_at") ?? "",
    status: formData.get("status"),
    is_featured: formDataBool(formData, "is_featured"),
    is_live: formDataBool(formData, "is_live"),
    position: formData.get("position") ?? 0,
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  // Directive §1 : YouTube UNIQUEMENT. L'identifiant vient de l'ID brut
  // ou d'une URL YouTube strictement validée (watch/youtu.be/embed/live).
  // Toute URL d'un autre domaine est refusée — jamais de source arbitraire.
  const { extractYouTubeId } = await import("@/lib/youtube/url");
  const youtubeId = extractYouTubeId(input.youtube_id ?? "") ??
    extractYouTubeId(input.youtube_url ?? "");
  if (!youtubeId) {
    return errorState("Source vidéo invalide : collez une URL YouTube (watch?v=, youtu.be, /embed/ ou /live/) ou l'identifiant à 11 caractères.", {
      youtube_url: "URL YouTube ou ID invalide",
    });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const slug = await ensureUniqueSlug("videos", slugFromTitleOrInput(input.title, input.slug), input.id);

  const row = {
    title: input.title,
    slug,
    description: input.description ?? null,
    youtube_id: youtubeId,
    thumbnail_url: input.thumbnail_url ?? null,
    category_id: input.category_id ?? null,
    duration: input.duration ?? null,
    status: input.status,
    is_featured: input.is_featured,
    is_live: input.is_live,
    position: input.position,
    // published_at = saisie éditoriale OU maintenant pour une publication immédiate.
    published_at: input.published_at
      ? new Date(input.published_at).toISOString()
      : input.status === "published"
        ? new Date().toISOString()
        : null,
  };

  if (input.id) {
    const { error } = await supabase.from("videos").update(row).eq("id", input.id);
    if (error) {
      console.error("[actions/content] saveVideo update :", error.message);
      return errorState("Enregistrement impossible.");
    }
  } else {
    const { error } = await supabase.from("videos").insert(row);
    if (error) {
      console.error("[actions/content] saveVideo insert :", error.message);
      return errorState("Création impossible.");
    }
  }

  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath(`/videos/${slug}`);
  revalidatePath("/admin/videos");
  return successState("Vidéo enregistrée.", "/admin/videos");
}

export async function deleteVideo(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = deleteVideoSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return errorState("Identifiant invalide.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { error } = await supabase.from("videos").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[actions/content] deleteVideo :", error.message);
    return errorState("Suppression impossible.");
  }

  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath("/admin/videos");
  return successState("Vidéo supprimée.");
}

// ─────────────────────────────────────────────────────────────
// FLASH-INFOS — editor+
// Durée de diffusion (menu déroulant) + horloge SERVEUR exclusivement
// (§3/§5) : expiration = début + durée, calculée ici, jamais côté
// navigateur. Durées contrôlées contre la liste autorisée (§10).
// ─────────────────────────────────────────────────────────────

const ALLOWED_FLASH_INTENTS = ["publish", "draft", "update"] as const;

/** Code PostgreSQL « column does not exist » (42703) : colonne « level »
 *  absente (migration 0024 non appliquée) — message clair, pas d'échec brut. */
function isMissingLevelColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || /level/.test(error.message ?? "");
}

const LEVEL_MIGRATION_MESSAGE =
  "Le niveau des flash-infos exige l'application de la migration 0024 (colonne level) sur le serveur Supabase par la direction : l'action est refusée tant que la migration n'est pas appliquée.";

export async function saveBreakingNews(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  // Intention explicite portée par le BOUTON soumis (valeur garantie dans
  // la FormData, aucun état client — même mécanisme que les articles).
  const intentRaw = formData.get("flash_intent");
  const intent = ALLOWED_FLASH_INTENTS.find((i) => i === intentRaw) ?? "update";

  const parsed = breakingNewsSchema.safeParse({
    id: formData.get("id") || undefined,
    content: formData.get("content"),
    link: formData.get("link") ?? "",
    is_active: intent === "publish",
    start_at: formData.get("start_at") ?? "",
    end_at: formData.get("end_at") ?? "",
    position: Number(formData.get("position") ?? 0) || 0,
    level: formData.get("level") || "normal",
    duration_minutes:
      typeof formData.get("duration_minutes") === "string" &&
      formData.get("duration_minutes") !== ""
        ? Number(formData.get("duration_minutes"))
        : undefined,
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  // ── CRÉATION (ou publication d'un brouillon existant) ──────────
  const isPublication = !input.id || intent === "publish";
  const isDraft = !input.id && intent === "draft";
  const isUpdate = Boolean(input.id) && intent === "update";

  // Programmation facultative : le champ « schedule_start » est lu pour
  // une publication ; interprété en heure de Conakry (UTC+0 constant).
  const scheduleRaw = String(formData.get("schedule_start") ?? "").trim();
  const scheduleIso = parseConakryInput(scheduleRaw);
  if (scheduleRaw && scheduleIso === null) {
    return errorState("Date de programmation invalide. Utilisez le sélecteur de date et heure.",
      { schedule_start: "Date invalide" });
  }

  if (isPublication && !isAllowedDuration(input.duration_minutes ?? null)) {
    return errorState("Choisissez une durée de diffusion.", {
      duration_minutes: "Durée requise (valeur de la liste uniquement)",
    });
  }

  if (isPublication) {
    // Horloge SERVEUR (§3) — jamais l'horloge du navigateur.
    const startIso =
      isAllowedDuration(input.duration_minutes ?? null) &&
      scheduleIso
        ? scheduleIso // programmé : la durée démarre au DÉBUT programmé (§6)
        : new Date().toISOString();
    const endIso = computeExpiry(startIso, input.duration_minutes ?? DEFAULT_DURATION_MINUTES);
    if (!endIso) {
      return errorState("Calcul de l'expiration impossible (durée ou programmation invalides).");
    }
    const row = {
      content: input.content,
      link: input.link ?? null,
      is_active: true,
      start_at: startIso,
      end_at: endIso,
      position: input.position,
      level: input.level,
    };

    const message_base = scheduleIso
      ? `Flash Info programmé : diffusé à partir de ${formatConakryDateTime(startIso)} pendant ${humanizeDuration(input.duration_minutes ?? 0)} — fin à ${formatConakryTime(endIso)} (Conakry).`
      : `Flash Info diffusé : il défilera en boucle pendant ${humanizeDuration(input.duration_minutes ?? 0)} et disparaîtra automatiquement à ${formatConakryTime(endIso)} (heure de Conakry).`;

    if (input.id) {
      const { error } = await supabase.from("breaking_news").update(row).eq("id", input.id);
      if (error) {
        console.error("[actions/content] saveBreakingNews publish update :", error.message);
        if (isMissingLevelColumn(error)) {
          return errorState(LEVEL_MIGRATION_MESSAGE);
        }
        return errorState("Publication impossible.");
      }
      revalidatePath("/");
      revalidatePath("/admin/flash-infos");
      return successState(message_base, "/admin/flash-infos");
    }
    const { error } = await supabase.from("breaking_news").insert(row);
    if (error) {
      console.error("[actions/content] saveBreakingNews publish insert :", error.message);
      if (isMissingLevelColumn(error)) {
        return errorState(LEVEL_MIGRATION_MESSAGE);
      }
      return errorState("Création impossible.");
    }
    revalidatePath("/");
    revalidatePath("/admin/flash-infos");
    return successState(message_base, "/admin/flash-infos");
  }

  if (isDraft) {
    const row = {
      content: input.content,
      link: input.link ?? null,
      is_active: false,
      start_at: null, // période définie à la PUBLICATION (§3), pas au brouillon
      end_at: null,
      position: input.position,
      level: input.level,
    };
    const { error } = await supabase.from("breaking_news").insert(row);
    if (error) {
      console.error("[actions/content] saveBreakingNews draft :", error.message);
      if (isMissingLevelColumn(error)) {
        return errorState(LEVEL_MIGRATION_MESSAGE);
      }
      return errorState("Création du brouillon impossible.");
    }
    revalidatePath("/");
    revalidatePath("/admin/flash-infos");
    return successState("Flash Info enregistré comme brouillon (non diffusé).", "/admin/flash-infos");
  }

  // ── MODIFICATION d'un flash EXISTANT (§7) : texte, lien, niveau,
  // position — JAMAIS sa période : elle est rechargée du serveur.
  if (isUpdate) {
    const { data: existing } = await supabase
      .from("breaking_news")
      .select("is_active")
      .eq("id", input.id!)
      .maybeSingle();
    if (!existing) {
      return errorState("Flash Info introuvable ou vous n'avez pas la permission de le modifier.");
    }
    const row = {
      content: input.content,
      link: input.link ?? null,
      position: input.position,
      level: input.level,
      is_active: existing.is_active, // préservé : aucune réactivation accidentelle
      // start_at / end_at NON transmis : période inchangée.
    };
    const { error } = await supabase.from("breaking_news").update(row).eq("id", input.id!);
    if (error) {
      console.error("[actions/content] saveBreakingNews update :", error.message);
      if (isMissingLevelColumn(error)) {
        return errorState(LEVEL_MIGRATION_MESSAGE);
      }
      return errorState("Enregistrement impossible.");
    }
    revalidatePath("/");
    revalidatePath("/admin/flash-infos");
    return successState(
      "Flash Info mis à jour — sa période de diffusion est inchangée (utilisez « Prolonger la diffusion » pour l'étendre).",
      "/admin/flash-infos"
    );
  }

  return errorState("Action inconnue.");
}

/**
 * PROLONGER / RÉACTIVER (§7) — admin+editor.
 *  extend      : re-calcule l'expiration à partir de l'HEURE DE
 *                CONFIRMATION (now serveur) ; le début est conservé.
 *  reactivate  : redémarre une diffusion complète (début = maintenant,
 *                fin = maintenant + durée) pour un brouillon/expiré.
 * Règles serveur strictes : prolonger exige un flash actif à fin définie ;
 * réactiver exige un flash inactif ou expiré (jamais de réactivation
 * accidentelle). Toujours le client de session (RLS), jamais service_role.
 */
export async function renewBreakingNews(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = flashRenewSchema.safeParse({
    id: formData.get("id"),
    mode: formData.get("mode"),
    duration_minutes:
      typeof formData.get("duration_minutes") === "string" && formData.get("duration_minutes") !== ""
        ? Number(formData.get("duration_minutes"))
        : undefined,
  });
  if (!parsed.success) {
    return errorState("Relancez l'action depuis la liste des flash-infos.", zodFieldErrors(parsed.error));
  }
  const { id, mode, duration_minutes } = parsed.data;
  if (!isAllowedDuration(duration_minutes ?? null)) {
    return errorState("Choisissez une durée de la liste.", {
      duration_minutes: "Durée non autorisée",
    });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { data: existing } = await supabase
    .from("breaking_news")
    .select("is_active, start_at, end_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return errorState("Flash Info introuvable ou vous n'avez pas la permission de le modifier.");
  }

  const nowIso = new Date().toISOString(); // horloge SERVEUR
  const lifecycle = classifyFlash(nowIso, existing.is_active, existing.start_at, existing.end_at);

  if (mode === "extend") {
    if (lifecycle !== "active" && lifecycle !== "active_no_expiry") {
      return errorState(
        lifecycle === "expired"
          ? "Ce Flash Info a expiré : utilisez « Réactiver la diffusion »."
          : "Seul un Flash Info actif peut être prolongé."
      );
    }
    const endIso = computeExpiry(nowIso, duration_minutes);
    if (!endIso) return errorState("Calcul de l'expiration impossible.");
    const { error } = await supabase.from("breaking_news").update({ end_at: endIso }).eq("id", id);
    if (error) {
      console.error("[actions/content] renewBreakingNews extend :", error.message);
      return errorState("Prolongation impossible.");
    }
    revalidatePath("/");
    revalidatePath("/admin/flash-infos");
    return successState(
      `Diffusion prolongée : la fin est désormais ${formatConakryDateTime(endIso)}.`,
      "/admin/flash-infos"
    );
  }

  // reactivate
  if (lifecycle === "active" || lifecycle === "active_no_expiry") {
    return errorState("Ce Flash Info est déjà diffusé : utilisez « Prolonger la diffusion ».");
  }
  const endIso = computeExpiry(nowIso, duration_minutes);
  if (!endIso) return errorState("Calcul de l'expiration impossible.");
  const { error } = await supabase
    .from("breaking_news")
    .update({ is_active: true, start_at: nowIso, end_at: endIso })
    .eq("id", id);
  if (error) {
    console.error("[actions/content] renewBreakingNews reactivate :", error.message);
    return errorState("Réactivation impossible.");
  }
  revalidatePath("/");
  revalidatePath("/admin/flash-infos");
  return successState(
    `Diffusion relancée : ${humanizeDuration(duration_minutes)} à partir de maintenant, fin à ${formatConakryTime(endIso)} (Conakry).`,
    "/admin/flash-infos"
  );
}

export async function deleteBreakingNews(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = deleteBreakingNewsSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return errorState("Identifiant invalide.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { error } = await supabase.from("breaking_news").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[actions/content] deleteBreakingNews :", error.message);
    return errorState("Suppression impossible.");
  }

  revalidatePath("/");
  revalidatePath("/admin/flash-infos");
  return successState("Flash-info supprimé.");
}

// ─────────────────────────────────────────────────────────────
// CATÉGORIES — editor+ (structure éditoriale, jamais de faux contenu)
// ─────────────────────────────────────────────────────────────

export async function saveCategory(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return errorState("Veuillez corriger les champs signalés.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const slug = await ensureUniqueSlug("categories", slugFromTitleOrInput(input.name, input.slug), input.id);

  const row = {
    name: input.name,
    slug,
    description: input.description ?? null,
  };

  if (input.id) {
    const { error } = await supabase.from("categories").update(row).eq("id", input.id);
    if (error) {
      console.error("[actions/content] saveCategory update :", error.message);
      return errorState("Enregistrement impossible.");
    }
  } else {
    const { error } = await supabase.from("categories").insert(row);
    if (error) {
      console.error("[actions/content] saveCategory insert :", error.message);
      return errorState("Création impossible.");
    }
  }

  revalidatePath("/");
  revalidatePath("/actualites");
  revalidatePath("/admin/categories");
  return successState("Catégorie enregistrée.", "/admin/categories");
}

export async function deleteCategory(formData: FormData): Promise<ActionState> {
  const guard = await requireRole(["admin", "editor"]);
  if ("denied" in guard) return deniedState(guard.denied);

  const parsed = deleteCategorySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return errorState("Identifiant invalide.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return deniedState("unconfigured");

  const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[actions/content] deleteCategory :", error.message);
    // 23503 : FK articles/videos → catégorie encore utilisée.
    if (error.code === "23503") {
      return errorState("Cette catégorie est utilisée par des contenus : réaffectez-les d'abord.");
    }
    return errorState("Suppression impossible.");
  }

  revalidatePath("/");
  revalidatePath("/actualites");
  revalidatePath("/admin/categories");
  return successState("Catégorie supprimée.");
}