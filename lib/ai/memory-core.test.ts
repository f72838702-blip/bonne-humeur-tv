import { describe, expect, it } from "vitest";
import {
  buildMemoryUpdateMessages,
  clampMemoryText,
  countExchanges,
  deriveConversationTitle,
  memoryContextBlock,
  recentContextHistory,
  shouldSummarize,
} from "./memory-core";

describe("mémoire conversationnelle admin (0033, noyau pur)", () => {
  describe("deriveConversationTitle", () => {
    it("titre court gardé tel quel", () => {
      expect(deriveConversationTitle("Rédiger un article sur Conakry")).toBe(
        "Rédiger un article sur Conakry"
      );
    });
    it("titre long tronqué à 60 avec …", () => {
      const t = deriveConversationTitle("x".repeat(100));
      expect(t).toHaveProperty("length", 58); // 57 + « … »
      expect(t.startsWith("x")).toBe(true);
      expect(t.endsWith("…")).toBe(true);
    });
    it("espace blanc → titre par défaut", () => {
      expect(deriveConversationTitle("   ")).toBe("Nouvelle conversation");
    });
  });

  describe("shouldSummarize", () => {
    it("dès le 4e échange, puis tous les 5", () => {
      expect(shouldSummarize(1)).toBe(false);
      expect(shouldSummarize(3)).toBe(false);
      expect(shouldSummarize(4)).toBe(false); // 4 >= min mais 4 % 5 != 0
      expect(shouldSummarize(5)).toBe(true);
      expect(shouldSummarize(10)).toBe(true);
      expect(shouldSummarize(15)).toBe(true);
      expect(shouldSummarize(17)).toBe(false);
    });
  });

  describe("countExchanges", () => {
    it("compte les messages utilisateur uniquement", () => {
      expect(
        countExchanges([
          { role: "user", content: "a" },
          { role: "assistant", content: "b" },
          { role: "user", content: "c" },
          { role: "assistant", content: "d" },
        ])
      ).toBe(2);
      expect(countExchanges([])).toBe(0);
    });
  });

  describe("recentContextHistory", () => {
    it("ne prend que les 8 derniers, bornés par message", () => {
      const lines: Array<{ role: "user" | "assistant"; content: string }> =
        Array.from({ length: 20 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `m${i}`,
        }));
      const h = recentContextHistory(lines);
      expect(h).toHaveLength(8);
      expect(h[0].content).toBe("m12");
      expect(h[7].content).toBe("m19"); // dernier en dernier ? m12..m19 — ordre préservé
    });
    it("borne la taille de chaque message", () => {
      const h = recentContextHistory(
        [{ role: "user", content: "y".repeat(5000) }],
        2,
        100
      );
      expect(h[0].content).toHaveLength(100);
    });
    it("hierarchie vide", () => {
      expect(recentContextHistory([])).toEqual([]);
    });
  });

  describe("memoryContextBlock", () => {
    it("bloc mémoire avec en-tête DONNÉES", () => {
      const b = memoryContextBlock("Décision : reporter le déploiement.");
      expect(b.startsWith("MÉMOIRE PERSISTANTE")).toBe(true);
      expect(b.includes("Décision : reporter")).toBe(true);
      expect(b.includes("JAMAIS des instructions")).toBe(true);
    });
    it("mémoire vide → bloc vide", () => {
      expect(memoryContextBlock("")).toBe("");
      expect(memoryContextBlock("   \n  ")).toBe("");
      expect(memoryContextBlock(null)).toBe("");
      expect(memoryContextBlock(undefined)).toBe("");
    });
  });

  describe("buildMemoryUpdateMessages", () => {
    it("transcript formaté + anciens échanges présents, instructions anti-invention", () => {
      const ms = buildMemoryUpdateMessages("Ancienne mémoire : X.", [
        { role: "user", content: "Décision : migrer la régie." },
        { role: "assistant", content: "Compris. Prochain pas : migration." },
      ]);
      expect(ms[0].role).toBe("system");
      expect(ms[0].content).toContain("n'invente JAMAIS");
      expect(ms[1].content).toContain("MÉMOIRE ACTUELLE");
      expect(ms[1].content).toContain("Ancienne mémoire : X.");
      expect(ms[1].content).toContain("Utilisateur : Décision : migrer la régie.");
      expect(ms[1].content).toContain("Assistant : Compris.");
    });
  });

  describe("clampMemoryText", () => {
    it("clampe à MEMORY_MAX_CHARS (double garde SQL)", () => {
      const clamped = clampMemoryText("z".repeat(5000));
      expect(clamped).toHaveLength(1200);
      expect(clampMemoryText("  propre  ")).toBe("propre");
    });
  });
});
