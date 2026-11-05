import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  currentAiModel,
  extractResponseText,
  generateAi,
  AI_PROVIDER_NAME,
  DEFAULT_AI_MODEL,
  FALLBACK_AI_MODEL,
  AI_TIMEOUT_MS,
} from "@/lib/ai/client";
import { publicIdentifier, clientIpFromHeaders, publicFingerprint } from "@/lib/ai/identity";
import {
  memoryQuotaCheck,
  utcDayKey,
  ADMIN_OUTPUT_MAX_TOKENS,
  ADMIN_MSG_MAX_CHARS,
  ADMIN_USER_MAX_REQUESTS,
  ADMIN_DAILY_MAX_REQUESTS,
  PUBLIC_MSG_MAX_CHARS,
  PUBLIC_SESSION_MAX_REQUESTS,
  PUBLIC_DAILY_MAX_REQUESTS,
  OUTPUT_MAX_TOKENS,
} from "@/lib/ai/quotas";
import {
  AI_ADMIN_TASKS,
  ADMIN_SYSTEM_PROMPT,
  PUBLIC_FALLBACK_MESSAGE,
  PUBLIC_SYSTEM_PROMPT,
  buildAdminMessages,
  buildPublicMessages,
} from "@/lib/ai/prompts";
import { parseStructuredArticle } from "@/lib/ai/parse-article";
import {
  buildKnowledgeContext,
  KNOWLEDGE_MAX_KEYWORDS,
  tokenizeQuestion,
} from "@/lib/ai/knowledge";

// ─── Mocks de module (repli/timeout C4-C8 + contrôle des URLs C1) ──────────

// Binding factice : les tests posent globalThis.__TEST_AI_BINDING (null par
// défaut = « indisponible honnête » comme hors Worker).
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: { AI: (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING },
  }),
}));

// Recherche publiable contrôlée pour tester les URLs réellement construites.
const searchState = vi.hoisted(() => ({
  result: {
    articles: [] as { slug: string; title: string; excerpt: string | null }[],
    videos: [] as { slug: string; title: string }[],
    unavailable: true,
  },
  // Phase H (A2) : file de réponses par appel + journal des requêtes.
  queue: [] as unknown[],
  calls: [] as string[],
}));
vi.mock("@/lib/data/search", () => ({
  searchPublishedContent: async (q: string) => {
    searchState.calls.push(q);
    return searchState.queue.length > 0
      ? searchState.queue.shift()
      : searchState.result;
  },
}));

beforeEach(() => {
  delete (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING;
});
afterEach(() => {
  delete (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING;
  delete process.env.WORKERS_AI_MODEL;
});

// ─── Client IA (couche d'abstraction) ────────────────────────────────────

describe("lib/ai/client — extractResponseText", () => {
  it("accepte une réponse chaîne (format text.run)", () => {
    expect(extractResponseText("  Bonjour !  ")).toBe("  Bonjour !  ");
    expect(extractResponseText("   ")).toBeNull();
  });

  it("accepte la forme {response}", () => {
    expect(extractResponseText({ response: "Oui" })).toBe("Oui");
    expect(extractResponseText({ output_text: "Oui aussi" })).toBe("Oui aussi");
  });

  it("accepte la forme chat.completion", () => {
    expect(
      extractResponseText({ choices: [{ message: { content: "Réponse" } }] })
    ).toBe("Réponse");
  });

  it("renvoie null sur du vide ou du non-texte (jamais invention)", () => {
    expect(extractResponseText(null)).toBeNull();
    expect(extractResponseText(42)).toBeNull();
    expect(extractResponseText({})).toBeNull();
    expect(extractResponseText({ choices: [{ message: { content: null } }] })).toBeNull();
  });

  it("modèle par défaut du banc d'essai, sans secret ni clé API", () => {
    delete process.env.WORKERS_AI_MODEL;
    expect(currentAiModel()).toBe("@cf/qwen/qwen3-30b-a3b-fp8");
    process.env.WORKERS_AI_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
    expect(currentAiModel()).toBe("@cf/mistralai/mistral-small-3.1-24b-instruct");
    delete process.env.WORKERS_AI_MODEL;
  });

  it("hors Worker : indisponible honnête — jamais une réponse simulée", async () => {
    const result = await generateAi([{ role: "user", content: "Test" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
  });
});

// ─── Quotas (limite mémoire = filet) ─────────────────────────────────────

describe("lib/ai/quotas — filet mémoire", () => {
  const base = new Date("2026-11-05T12:00:00Z");

  it("autorise sous les limites", () => {
    const d = memoryQuotaCheck("public", "t-allowed", 400, 12, 600, base);
    expect(d).toBe("allowed");
  });

  it("refuse au-delà de la fenêtre courte", () => {
    const id = "t-window";
    for (let i = 0; i < PUBLIC_SESSION_MAX_REQUESTS; i++) {
      expect(
        memoryQuotaCheck("public", id, 400, PUBLIC_SESSION_MAX_REQUESTS, 600, base)
      ).toBe("allowed");
    }
    expect(
      memoryQuotaCheck("public", id, 400, PUBLIC_SESSION_MAX_REQUESTS, 600, base)
    ).toBe("limited");
  });

  it("refuse au quota journalier", () => {
    const id = "t-daily";
    const start = new Date("2026-11-05T00:01:00Z");
    for (let i = 0; i < ADMIN_DAILY_MAX_REQUESTS; i++) {
      start.setSeconds(start.getSeconds() + 61); // hors fenêtre courte
      expect(
        memoryQuotaCheck("admin", id, ADMIN_DAILY_MAX_REQUESTS, 40, 600, start)
      ).toBe("allowed");
    }
    start.setSeconds(start.getSeconds() + 61);
    expect(
      memoryQuotaCheck("admin", id, ADMIN_DAILY_MAX_REQUESTS, 40, 600, start)
    ).toBe("limited");
  });

  it("la fenêtre courte glisse (requête ancienne purgeée)", () => {
    const id = "t-gliss";
    const t0 = new Date("2026-11-05T08:00:00Z");
    for (let i = 0; i < 12; i++) {
      expect(memoryQuotaCheck("public", id, 400, 12, 600, t0)).toBe("allowed");
      t0.setSeconds(t0.getSeconds() + 60);
    }
    // La plus ancienne des 12 requêtes a > 600 s → une nouvelle passe.
    expect(memoryQuotaCheck("public", id, 400, 12, 600, t0)).toBe("allowed");
  });

  it("le quota journalier revient au changement de jour UTC", () => {
    const id = "t-day";
    const dayA = new Date("2026-11-05T23:00:00Z");
    for (let i = 0; i < PUBLIC_DAILY_MAX_REQUESTS; i++) { // jusqu'au plafond (paramétré)
      expect(memoryQuotaCheck("public", id, PUBLIC_DAILY_MAX_REQUESTS, 12, 600, dayA)).toBe("allowed");
      dayA.setSeconds(dayA.getSeconds() + 60); // la fenêtre courte glisse
    }
    // Jour suivant : 00:00 UTC → compteur remis.
    const dayB = new Date("2026-11-06T00:00:00Z");
    expect(memoryQuotaCheck("public", id, PUBLIC_DAILY_MAX_REQUESTS, 12, 600, dayB)).toBe("allowed");
    expect(utcDayKey(dayB)).toBe("2026-11-06");
  });

  it("les compteurs public et admin sont DISTINCTS", () => {
    const sameId = "t-sep";
    const dA = memoryQuotaCheck("admin", sameId, 120, 40, 600, base);
    const dB = memoryQuotaCheck("public", sameId, 400, 12, 600, base);
    expect(dA).toBe("allowed");
    expect(dB).toBe("allowed");
  });

  it("constantes cohérentes avec la demande (caps et parts réservées)", () => {
    expect(PUBLIC_MSG_MAX_CHARS).toBe(2000);
    expect(ADMIN_MSG_MAX_CHARS).toBe(6000);
    expect(PUBLIC_SESSION_MAX_REQUESTS).toBe(12);
    expect(ADMIN_USER_MAX_REQUESTS).toBe(40);
    expect(PUBLIC_DAILY_MAX_REQUESTS).toBeLessThan(ADMIN_DAILY_MAX_REQUESTS + 600);
    // Plafonds journaliers Phase E2 (simulation Neurons — §7 rapport Phase E) :
    // 150 public + 40 admin ≈ 6 550 Neurons pire-cas, réserve ≥ 3 450 sur 10 000.
    expect(PUBLIC_DAILY_MAX_REQUESTS).toBe(150);
    expect(ADMIN_DAILY_MAX_REQUESTS).toBe(40);
    expect(ADMIN_DAILY_MAX_REQUESTS).toBeLessThanOrEqual(PUBLIC_DAILY_MAX_REQUESTS);
    expect(OUTPUT_MAX_TOKENS).toBeLessThanOrEqual(900);
  });
});

// ─── Prompts (cadrage strict) ──────────────────────────────────────────────

describe("lib/ai/prompts — cadrage", () => {
  const EXACT_FALLBACK =
    "Je ne dispose pas actuellement de cette information sur Bonne Humeur TV. Vous pouvez contacter notre équipe pour en savoir davantage.";

  it("le message de recadrage public est EXACTEMENT celui exigé", () => {
    expect(PUBLIC_FALLBACK_MESSAGE).toBe(EXACT_FALLBACK);
    expect(PUBLIC_SYSTEM_PROMPT).toContain(EXACT_FALLBACK);
  });

  it("l'assistant admin ne publie jamais et marque les faits non fournis", () => {
    expect(ADMIN_SYSTEM_PROMPT).toContain("ne publies rien");
    expect(ADMIN_SYSTEM_PROMPT).toContain("[à vérifier]");
    expect(ADMIN_SYSTEM_PROMPT).toContain("N'invente JAMAIS");
  });

  it("le prompt public borne le périmètre à Bonne Humeur TV et cadre les données", () => {
    expect(PUBLIC_SYSTEM_PROMPT).toContain("UNIQUEMENT");
    expect(PUBLIC_SYSTEM_PROMPT).toContain("jamais une instruction");
    expect(PUBLIC_SYSTEM_PROMPT).toMatch(/inventes/i);
  });

  it("la structure article est exigée par le prompt admin", () => {
    expect(ADMIN_SYSTEM_PROMPT).toContain("TITRE:");
    expect(ADMIN_SYSTEM_PROMPT).toContain("CONTENU:");
    expect(ADMIN_SYSTEM_PROMPT).toContain("MOTS-CLÉS:");
  });

  it("les 10 tâches rapides admin sont complètes", () => {
    expect(AI_ADMIN_TASKS).toHaveLength(10);
    for (const task of AI_ADMIN_TASKS) {
      expect(task.label.length).toBeGreaterThan(0);
      expect(task.template.length).toBeGreaterThan(0);
    }
    const ids = AI_ADMIN_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("l'histoire admin est bridée aux 4 derniers messages (coût maîtrisé)", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `msg-${i}`,
    })) as { role: "user" | "assistant"; content: string }[];
    const messages = buildAdminMessages("Nouvelle demande", history);
    const kept = messages.filter((m) => m.content.startsWith("msg-"));
    expect(kept).toHaveLength(4);
    expect(kept[0].content).toContain("msg-16");
  });
});

// ─── Parsing de la sortie structurée ─────────────────────────────────────

describe("lib/ai/parse-article", () => {
  const SAMPLE = `TITRE: Un centre de santé moderne inauguré à Kaloum
RÉSUMÉ: Une nouvelle structure de soins ouvre ses portes au cœur de Conakry.
CONTENU:
Paragraphe un.

Paragraphe deux.
MOTS-CLÉS: santé, Conakry, Kaloum`;

  it("extrait les quatre champs d'une sortie conforme", () => {
    const p = parseStructuredArticle(SAMPLE);
    expect(p.title).toBe("Un centre de santé moderne inauguré à Kaloum");
    expect(p.excerpt).toContain("nouvelle structure");
    expect(p.content).toContain("Paragraphe deux.");
    expect(p.tags).toBe("santé, Conakry, Kaloum");
  });

  it("tolère le markdown ** et l'absence de RÉSUMÉ", () => {
    const p = parseStructuredArticle(
      "**TITRE:** Titre sans résumé\n**CONTENU:**\nCorps seul\n**MOTS-CLÉS:** guinée, télé"
    );
    expect(p.title).toBe("Titre sans résumé");
    expect(p.excerpt).toBeUndefined();
    expect(p.content).toContain("Corps seul");
  });

  it("gère une sortie non structurée sans lever d'erreur", () => {
    const p = parseStructuredArticle("Simple texte de reformulation.");
    expect(p.title).toBeUndefined();
    expect(p.content).toBeUndefined();
  });
});

// ─── Base de connaissances (RAG public) ────────────────────────────────────

describe("lib/ai/knowledge — périmètre public", () => {
  it("injecte la chaîne YouTube réelle, contacts et pages du site, sans donnée privée", async () => {
    const { context, degraded } = await buildKnowledgeContext("Vos émissions ?");

    expect(context).toContain("youtube.com/@Bonnehumeurt");
    expect(context).toContain("/contact");
    expect(context).toContain("/partenariats");
    expect(context).toContain("+224 662 860 976");
    expect(context).toContain("[DIRECT]");
    // Aucune donnée admin ou personnelle dans le contexte public.
    expect(context).not.toMatch(/SUPABASE|service_role|SERVICE_ROLE|BREVO|API_KEY/i);
    expect(degraded).toBe(true); // pas de backend en test : dégradé honnête
  });

  it("la question est bornée avant injection (anti-prompt-injection volumique)", async () => {
    const long = "x".repeat(5000);
    const { context } = await buildKnowledgeContext(long);
    // Tronquée à 300 caractères côté query — le contexte reste borné.
    expect(context.length).toBeLessThan(1000);
  });
});

// ─── C1-C2 (Phase E) : liens réels /actualites/ + jamais de page /direct ───

describe("lib/ai/knowledge — liens réels (C1-C2, audit Phase D)", () => {
  it("les articles citent /actualites/<slug> — JAMAIS /articles/<slug>", async () => {
    searchState.result = {
      articles: [{ slug: "mon-article", title: "Mon article", excerpt: "Un résumé." }],
      videos: [{ slug: "ma-video", title: "Ma vidéo" }],
      unavailable: false,
    };
    const { context } = await buildKnowledgeContext("mon article");
    expect(context).toContain("/actualites/mon-article");
    expect(context).not.toMatch(/\/articles\//); // aucun lien 404 produit
    expect(context).toContain("/videos/ma-video"); // liens vidéos corrects conservés
  });

  it("AUCUNE référence à une page /direct inexistante (C2) — direct = accueil", async () => {
    searchState.result = { articles: [], videos: [], unavailable: true };
    const { context } = await buildKnowledgeContext("le direct ?");
    expect(context).not.toContain("/direct");
    expect(context).not.toMatch(/ACTUELLEMENT EN DIRECT/i); // jamais d'état affirmé sans preuve
    expect(context).toContain("page d'accueil"); // le direct vit sur l'accueil (LiveSection)
  });
});

// ─── A2 (Phase H) : relance par mots-clés quand la phrase ne matche pas ───

describe("lib/ai/knowledge — tokenisation A2 (Phase H)", () => {
  beforeEach(() => {
    searchState.calls = [];
    searchState.queue = [];
    searchState.result = { articles: [], videos: [], unavailable: true };
  });

  it("tokenizeQuestion : filtre mots vides/courts/nombres, déduplique, plafonne", () => {
    // « article » = mot vide volontaire (jamais discriminant pour le SQL) ;
    // les accents sont CONSERVÉS (l'ilike SQL ignore la casse, pas les accents).
    expect(
      tokenizeQuestion("Peux-tu me parler de l'article « kldsljgekfdlm » ?")
    ).toEqual(["kldsljgekfdlm"]);
    expect(
      tokenizeQuestion("Quelles sont les dernières actualités de la chaîne ?")
    ).toEqual(["actualités", "chaîne"]);
    expect(tokenizeQuestion("conakry conakry CONAKRY")).toEqual(["conakry"]);
    expect(tokenizeQuestion("12 34 !!! ...")).toEqual([]); // nombres et ponctuation seuls
    expect(tokenizeQuestion("").length).toBe(0);
    const max = tokenizeQuestion(
      "transport bibliothèque vidéo interview musique sport culture économie"
    );
    expect(max.length).toBe(KNOWLEDGE_MAX_KEYWORDS); // budget plafonné à 5
  });

  it("relance par mots-clés UNIQUEMENT si la question entière ne matche rien", async () => {
    searchState.result = { articles: [], videos: [], unavailable: false };
    // Le mock sert queue AVANT result : la 1re entrée de file répond donc à
    // l'appel n°1 (question entière = rien), la 2e au mot-clé « santé ».
    searchState.queue = [
      { articles: [], videos: [], unavailable: false },
      { articles: [{ id: "a1", slug: "sante-publique", title: "Santé publique", excerpt: "Le plan.", category_name: "Santé", category_slug: "sante", featured_image: null, published_at: "2026-11-01" }], videos: [], unavailable: false },
    ];
    const { context, degraded } = await buildKnowledgeContext(
      "Bonjour, pouvez-vous me parler de santé ?"
    );
    // 1 appel question entière + 1 seul mot-clé porteur (« santé », accents conservés).
    expect(searchState.calls).toEqual([
      "Bonjour, pouvez-vous me parler de santé ?",
      "santé",
    ]);
    expect(context).toContain("/actualites/sante-publique"); // lien C1 préservé
    expect(degraded).toBe(false);
  });

  it("ne relance PAS quand la première recherche a déjà des résultats", async () => {
    searchState.result = {
      articles: [{ slug: "a", title: "A", excerpt: null }],
      videos: [],
      unavailable: false,
    };
    await buildKnowledgeContext("mon article");
    expect(searchState.calls).toEqual(["mon article"]); // 1 seul appel RPC
  });

  it("unavailable : dégradé honnête, AUCUNE relance", async () => {
    searchState.result = { articles: [], videos: [], unavailable: true };
    const { degraded } = await buildKnowledgeContext("parlez-moi de santé");
    expect(degraded).toBe(true);
    expect(searchState.calls).toEqual(["parlez-moi de santé"]);
  });

  it("plafonne les relances à KNOWLEDGE_MAX_KEYWORDS appels RPC (budget borné)", async () => {
    searchState.result = { articles: [], videos: [], unavailable: false };
    await buildKnowledgeContext(
      "transport bibliothèque vidéo interview musique sport culture"
    );
    expect(searchState.calls.length).toBe(1 + KNOWLEDGE_MAX_KEYWORDS);
  });

  it("déduplique les hits identiques renvoyés par deux mots-clés", async () => {
    searchState.result = { articles: [], videos: [], unavailable: false };
    const art = { id: "a1", slug: "sante", title: "Santé", excerpt: null };
    // File : question entière (rien), puis mot-clé 1, puis mot-clé 2.
    searchState.queue = [
      { articles: [], videos: [], unavailable: false },
      { articles: [art], videos: [], unavailable: false },
      { articles: [art], videos: [], unavailable: false },
    ];
    const { context } = await buildKnowledgeContext("santé publique et santé");
    const occurrences = context.split("/actualites/sante").length - 1;
    expect(occurrences).toBeLessThanOrEqual(1); // jamais de doublon dans le contexte
  });
});

// ─── C4 (Phase E) : /no_think public, admin avec raisonnement complet ─────

describe("lib/ai/prompts — /no_think (Phase E, prouvé au banc)", () => {
  it("le chatbot PUBLIC active /no_think (économie prouvée au banc : 587→42 tokens)", () => {
    const msgs = buildPublicMessages("Question", "Contexte");
    expect(msgs[0].content).toContain("/no_think");
    const count = msgs[0].content.split("/no_think").length - 1;
    expect(count).toBe(1); // exactement une fois, uniquement côté système
    expect(msgs[2].content).toBe("Question"); // la question reste intacte
  });

  it("l'assistant ADMIN garde le raisonnement complet (qualité des articles)", () => {
    const msgs = buildAdminMessages("Demande");
    expect(msgs.every((m) => !m.content.includes("/no_think"))).toBe(true);
  });
});

// ─── C4-C8 (Phase E) : repli Mistral, timeout, aucune bascule payante ─────

describe("lib/ai/client — repli et timeout (Phase E)", () => {
  it("repli Mistral UNIQUEMENT sur échec réel du principal (réponse vide)", async () => {
    const calls: string[] = [];
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: (model: string) => {
        calls.push(model);
        if (model === DEFAULT_AI_MODEL) {
          // Comportement réel observé au banc : content=null (raisonnement seul)
          return Promise.resolve({ choices: [{ message: { content: null } }] });
        }
        return Promise.resolve({ response: "Réponse du repli Mistral" });
      },
    };
    const result = await generateAi([{ role: "user", content: "Reformule" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toContain("repli Mistral");
    expect(calls).toEqual([DEFAULT_AI_MODEL, FALLBACK_AI_MODEL]); // 1 seul repli
  });

  it("AUCUN second appel quand le principal réussit (pas de double consommation)", async () => {
    const calls: string[] = [];
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: (model: string) => {
        calls.push(model);
        return Promise.resolve({ response: "Réponse du principal" });
      },
    };
    const result = await generateAi([{ role: "user", content: "Test" }]);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([DEFAULT_AI_MODEL]);
    if (result.ok) expect(result.model).toBe(DEFAULT_AI_MODEL);
  });

  it("AUCUN repli quand le principal EST déjà le modèle de repli", async () => {
    process.env.WORKERS_AI_MODEL = FALLBACK_AI_MODEL;
    const calls: string[] = [];
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: (model: string) => {
        calls.push(model);
        return Promise.resolve({ response: "" }); // vide → échec
      },
    };
    const result = await generateAi([{ role: "user", content: "Test" }]);
    expect(result.ok).toBe(false);
    expect(calls).toEqual([FALLBACK_AI_MODEL]); // une seule tentative
  });

  it("timeout explicite seul (C8) : rejet rapide avec message compréhensible", async () => {
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: () => new Promise(() => {}),
    };
    const result = await generateAi([{ role: "user", content: "Test" }], { timeoutMs: 30 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("délai dépassé");
  });

  it("E2 : un TIMEOUT ne déclenche JAMAIS le repli (jamais 2 générations simultanées)", async () => {
    const calls: string[] = [];
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: (model: string) => {
        calls.push(model); // le binding continuerait de tourner après coup
        if (model === DEFAULT_AI_MODEL) return new Promise(() => {});
        return Promise.resolve({ response: "Réponse du repli" }); // NE DOIT PAS être appelé
      },
    };
    const t0 = Date.now();
    const result = await generateAi([{ role: "user", content: "Test" }], { timeoutMs: 40 });
    expect(Date.now() - t0).toBeLessThan(5000); // réponse rapide, sans attendre le repli
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("provider-error"); // erreur propre, pas de repli
      expect(result.error).toContain("délai dépassé");
    }
    expect(calls).toEqual([DEFAULT_AI_MODEL]); // un SEUL appel lancé
  });

  it("E2 : une ERREUR du binding (échec définitif) déclenche le repli — pas le timeout", async () => {
    const calls: string[] = [];
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: (model: string) => {
        calls.push(model);
        if (model === DEFAULT_AI_MODEL) {
          return Promise.reject(new Error("modèle indisponible")); // définitif
        }
        return Promise.resolve({ response: "Réponse du repli" });
      },
    };
    const result = await generateAi([{ role: "user", content: "Test" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.model).toBe(FALLBACK_AI_MODEL);
    expect(calls).toEqual([DEFAULT_AI_MODEL, FALLBACK_AI_MODEL]);
  });

  it("échec final propre : principal ET repli échouent → erreur du primary, rien d'inventé", async () => {
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: () => Promise.resolve({ response: "   " }), // vide partout
    };
    const result = await generateAi([{ role: "user", content: "Test" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("provider-error");
      expect(result.error).toContain("réponse vide");
    }
  });

  it("timeout explicite seul (C8) : rejet rapide avec message compréhensible", async () => {
    (globalThis as { __TEST_AI_BINDING?: unknown }).__TEST_AI_BINDING = {
      run: () => new Promise(() => {}),
    };
    const result = await generateAi([{ role: "user", content: "Test" }], { timeoutMs: 30 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("délai dépassé");
  });

  it("AUCUN fournisseur ou modèle payant (GLM 5.x / kimi / deepseek exclus) — repli = Workers AI", () => {
    delete process.env.WORKERS_AI_MODEL;
    const ids = [AI_PROVIDER_NAME, DEFAULT_AI_MODEL, FALLBACK_AI_MODEL, currentAiModel()];
    expect(AI_PROVIDER_NAME).toBe("workers-ai"); // jamais un fournisseur externe payant
    expect(ids.join("|")).not.toMatch(/glm-5|kimi-|deepseek|gateway:/i);
    expect(FALLBACK_AI_MODEL).toBe("@cf/mistralai/mistral-small-3.1-24b-instruct"); // binding, aucune clé API
    expect(AI_TIMEOUT_MS).toBe(60_000); // délai documenté, couvre les réponses lentes observées
  });

  it("max_tokens admin relevé à 2000 (fiabilité C4), sortie publique plafonnée à 900", () => {
    expect(ADMIN_OUTPUT_MAX_TOKENS).toBe(2000);
    expect(OUTPUT_MAX_TOKENS).toBe(900);
  });
});

// ─── C5 (Phase E) : empreinte anti-abus, CF-Connecting-IP prioritaire ─────

describe("lib/ai/identity — empreinte publique (C5)", () => {
  const hdrs = (map: Record<string, string>) => (name: string) => map[name] ?? null;

  it("CF-Connecting-IP est prioritaire (posé par l'edge, non forgeable par le client)", () => {
    expect(
      clientIpFromHeaders(
        hdrs({ "cf-connecting-ip": "41.79.10.5", "x-forwarded-for": "1.2.3.4, 5.6.7.8" })
      )
    ).toBe("41.79.10.5"); // le XFF fourni par le client est ignoré
  });

  it("recours X-Forwarded-For (1er élément) hors Cloudflare, « inconnu » si rien — dev local", () => {
    expect(clientIpFromHeaders(hdrs({ "x-forwarded-for": "41.79.10.5, 10.0.0.1" }))).toBe("41.79.10.5");
    expect(clientIpFromHeaders(hdrs({}))).toBe("inconnu");
  });

  it("l'empreinte ne contient JAMAIS l'IP en clair et tourne chaque jour UTC", () => {
    const fp1 = publicFingerprint("41.79.10.5", "Mozilla/5.0 Test/1.0", new Date("2026-11-05T23:59:59Z"));
    const fp2 = publicFingerprint("41.79.10.5", "Mozilla/5.0 Test/1.0", new Date("2026-11-06T00:00:01Z"));
    expect(fp1).toHaveLength(48);
    expect(fp1).not.toContain("41.79.10.5"); // jamais d'IP stockée en clair
    expect(fp2).not.toBe(fp1); // rotation quotidienne réelle (jour dans le hash)
    expect(publicFingerprint("41.79.10.5", "Autre UA", new Date("2026-11-05T23:59:59Z"))).not.toBe(fp1);
  });

  it("publicIdentifier tronque l'UA et reste stable pour le même (ip, ua tronqué, jour)", () => {
    const a = publicIdentifier(hdrs({ "cf-connecting-ip": "41.79.10.5" }), "U".repeat(600));
    const b = publicIdentifier(hdrs({ "cf-connecting-ip": "41.79.10.5" }), "U".repeat(301) + "suffixe-différent");
    expect(a).toHaveLength(48);
    expect(b).toBe(a); // troncature à 300 : suffixe ignoré
  });
});

// ─── C3 (Phase E) : la migration 0032 conserve la purge de 0002 ──────────

describe("supabase/migrations/0032 — purge réintégrée (C3)", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "0032_assistants_ia.sql"),
    "utf-8"
  );

  it("contient le bloc de purge identique à 0002 (aléatoire 5 % + rétention 7 jours)", () => {
    expect(sql).toMatch(/if random\(\) < 0\.05 then/);
    expect(sql).toMatch(/delete from public\.form_submissions\s+where created_at < now\(\) - interval '7 days'/);
  });

  it("reste additive : whitelist à 4 types, contrainte 0001 alignée, create or replace de check_rate_limit", () => {
    expect(sql).toMatch(/not in \('contact', 'partnership', 'assistant_public', 'assistant_admin'\)/);
    expect(sql).toMatch(/form_submissions_form_type_check/); // nom exact de la contrainte 0001
    expect(sql).toMatch(/create or replace function public\.check_rate_limit/);
  });
});
