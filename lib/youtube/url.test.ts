import { describe, expect, it } from "vitest";
import {
  extractYouTubeId,
  isoDurationToDisplay,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "./url";

/**
 * Directive §1 — YouTube UNIQUEMENT : les 4 formats d'URL acceptés,
 * l'ID brut, et le REFUS de toute source externe arbitraire.
 */

describe("extractYouTubeId", () => {
  it("accepte les 4 formats officiels de la directive", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepte l'ID brut seul (11 caractères)", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });

  it("accepte les variantes courantes (paramètres, mobile, shorts, v/)", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("REFUSE toute URL externe arbitraire (règle absolue de la directive)", () => {
    expect(extractYouTubeId("https://vimeo.com/123456")).toBeNull();
    expect(extractYouTubeId("https://evil-example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYouTubeId("https://youtube.com.evil.com/dQw4w9WgXcQ")).toBeNull();
    expect(extractYouTubeId("https://download.example.com/video.mp4")).toBeNull();
    expect(extractYouTubeId("https://supabase.co/storage/v1/video.mp4")).toBeNull();
  });

  it("refuse les identifiants et schémas invalides", () => {
    expect(extractYouTubeId("dQw4w9WgXc")).toBeNull(); // 10 caractères
    expect(extractYouTubeId("dQw4w9WgXcQX")).toBeNull(); // 12 caractères
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("ftp://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYouTubeId("javascript:alert(1)")).toBeNull();
    expect(extractYouTubeId("https://youtube.com/watch?v=")).toBeNull();
  });
});

describe("helpers d'URL", () => {
  it("youtubeEmbedUrl utilise youtube-nocookie (pas de cookies)", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("youtubeWatchUrl reconstruit l'URL canonique", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });

  it("youtubeThumbnailUrl pointe vers i.ytimg (jamais retéléchargée)", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ", "mq")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    );
  });
});

describe("isoDurationToDisplay", () => {
  it("convertit les durées ISO 8601 YouTube en format affichable", () => {
    expect(isoDurationToDisplay("PT12M45S")).toBe("12:45");
    expect(isoDurationToDisplay("PT1H2M3S")).toBe("1:02:03");
    expect(isoDurationToDisplay("PT45S")).toBe("0:45");
  });

  it("retourne null pour une entrée invalide", () => {
    expect(isoDurationToDisplay("12:45")).toBeNull();
    expect(isoDurationToDisplay("")).toBeNull();
  });
});