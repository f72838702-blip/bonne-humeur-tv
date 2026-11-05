import { describe, expect, it } from "vitest";
import {
  applyLiveConfig,
  chooseLiveFromApi,
  parseRssEntries,
} from "@/lib/direct/core";
import type { LiveConfig } from "@/lib/direct/core";

/**
 * Tests du module DIRECT YouTube — noyau PURE uniquement (réseau et base
 * jamais touchés) :
 * • parsing RSS de la chaîne (15 entrées, ordre, titres XML-échappés) ;
 * • choix du direct dans la réponse videos.list (UPCOMING/none refusés) ;
 * • matrice de décision applyLiveConfig (§ direction : jamais de lecteur
 *   vide, aucune ancienne diffusion présentée comme direct).
 */

function cfg(p: Partial<LiveConfig> = {}): LiveConfig {
  return {
    enabled: true,
    mode: "auto",
    manualVideoId: null,
    replayVideoId: null,
    lastState: null,
    lastCheckedAt: null,
    ...p,
  };
}

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<title>YouTube</title>
<entry>
  <id>yt:video:aBCdef12345</id>
  <yt:videoId>aBCdef12345</yt:videoId>
  <title>Émission spéciale &amp; débat</title>
</entry>
<entry>
  <id>yt:video:xYz123456789</id>
  <yt:videoId>xYz12345678</yt:videoId>
  <title>Le Grand Journal</title>
</entry>
</feed>`;

describe("parseRssEntries", () => {
  it("extrait les IDs vidéo dans l'ordre du flux", () => {
    const entries = parseRssEntries(RSS_SAMPLE);
    expect(entries.map((e) => e.id)).toEqual(["aBCdef12345", "xYz12345678"]);
  });

  it("décode les entités XML dans les titres", () => {
    const entries = parseRssEntries(RSS_SAMPLE);
    expect(entries[0]?.title).toBe("Émission spéciale & débat");
  });

  it("ignore une entrée sans ID vidéo (pas une vidéo)", () => {
    const xml = "<feed><entry><title>Bannière chaîne</title></entry></feed>";
    expect(parseRssEntries(xml)).toEqual([]);
  });

  it("un flux vide ou invalide → aucune vidéo (jamais de faux direct)", () => {
    expect(parseRssEntries("")).toEqual([]);
    expect(parseRssEntries("<html>not rss</html>")).toEqual([]);
  });
});

describe("chooseLiveFromApi", () => {
  it("sélectionne SEULEMENT liveBroadcastContent === \"live\"", () => {
    expect(
      chooseLiveFromApi([
        { id: "aBCdef12345", snippet: { liveBroadcastContent: "none", title: "Ordinaire" } },
        { id: "xYz12345678", snippet: { liveBroadcastContent: "live", title: "En direct" } },
      ])
    ).toEqual({ videoId: "xYz12345678", title: "En direct" });
  });

  it("rejette « upcoming » — une émission à venir n'est pas un direct", () => {
    expect(
      chooseLiveFromApi([
        { id: "aBCdef12345", snippet: { liveBroadcastContent: "upcoming", title: "À venir" } },
      ])
    ).toBeNull();
  });

  it("un item sans ID/snippet est ignoré", () => {
    expect(chooseLiveFromApi([{ id: null }, { snippet: null }, {} as never])).toBeNull();
  });
});

describe("applyLiveConfig — décision d'affichage", () => {
  it("module désactivé ou absent → section entièrement masquée", () => {
    expect(applyLiveConfig(null, { status: "live", videoId: "xYz12345678", title: null }).show).toBeNull();
    expect(applyLiveConfig(cfg({ enabled: false }), { status: "live", videoId: "xYz12345678", title: null }).show).toBeNull();
    expect(applyLiveConfig(cfg({ mode: "off" }), { status: "live", videoId: "xYz12345678", title: null }).show).toBeNull();
  });

  it("mode auto + direct CONFIRMÉ → lecteur du direct", () => {
    const decision = applyLiveConfig(cfg(), { status: "live", videoId: "xYz12345678", title: "Débat" });
    expect(decision).toEqual({ show: "player", videoId: "xYz12345678", title: "Débat" });
  });

  it("mode auto sans direct → présentation discrète de la chaîne (JAMAIS de lecteur)", () => {
    const decision = applyLiveConfig(cfg(), { status: "none" });
    expect(decision).toEqual({ show: "channel", replayVideoId: null, reason: "not-live" });
  });

  it("clé API absente (« unconfigured ») → présentation discrète, raison honnête", () => {
    const decision = applyLiveConfig(cfg(), { status: "unconfigured" });
    expect(decision).toMatchObject({ show: "channel", reason: "unconfigured" });
  });

  it("erreur réseau → présentation discrète, jamais un faux direct", () => {
    expect(applyLiveConfig(cfg(), { status: "error" })).toMatchObject({
      show: "channel",
      reason: "error",
    });
    expect(applyLiveConfig(cfg(), null)).toMatchObject({ show: "channel", reason: "not-live" });
  });

  it("mode manuel avec lien VALIDE → lecteur quel que soit l'état détecté", () => {
    const decision = applyLiveConfig(cfg({ mode: "manual", manualVideoId: "aBCdef12345" }), { status: "none" });
    expect(decision).toEqual({ show: "player", videoId: "aBCdef12345", title: null });
  });

  it("mode manuel SANS lien → présentation de chaîne (jamais de lecteur vide)", () => {
    const decision = applyLiveConfig(cfg({ mode: "manual" }), { status: "live", videoId: "xYz12345678", title: null });
    expect(decision).toEqual({ show: "channel", replayVideoId: null, reason: "manual-missing" });
  });

  it("la rediffusion est renvoyée DISTINCTEMENT dans l'état « channel » uniquement", () => {
    const decision = applyLiveConfig(cfg({ replayVideoId: "aBCdef12345" }), { status: "none" });
    expect(decision).toEqual({ show: "channel", replayVideoId: "aBCdef12345", reason: "not-live" });

    // Aucune rediffusion proposée pendant un direct réel.
    expect(applyLiveConfig(cfg({ replayVideoId: "aBCdef12345" }), { status: "live", videoId: "xYz12345678", title: null }))
      .toEqual({ show: "player", videoId: "xYz12345678", title: null });
    // Aucune rediffusion sur un module désactivé.
    expect(applyLiveConfig(cfg({ enabled: false, replayVideoId: "aBCdef12345" }), null).show).toBeNull();
  });
});
