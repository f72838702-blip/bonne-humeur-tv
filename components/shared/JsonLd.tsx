/**
 * Données structurées JSON-LD (schema.org) — injectées UNIQUEMENT
 * avec des données réelles : jamais de balisage sur du contenu fictif.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}