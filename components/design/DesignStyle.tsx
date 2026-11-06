import { cssDesignStyle } from "@/lib/design/tokens";
import type { DesignConfig } from "@/lib/design/schema";

/**
 * Injection du design publié — server-renderé, variables seules.
 * `config` null (défaut/table absente) = AUCUN style émis : le socle
 * historique s'applique tel quel, le site public ne change pas d'un
 * pixel tant que le Studio n'a rien publié.
 * Réglages light ET dark : le même design pilote les deux thèmes.
 */
export default function DesignStyle({ config }: { config: DesignConfig | null }) {
  if (!config) return null;
  const style = cssDesignStyle(config);
  if (!style) return null;
  // dangerouslySetInnerHTML volontaire : le contenu provient EXCLUSIVE-
  // MENT de cssDesignStyle (liste fermée de variables --bhtv-*, testée
  // par D10) — jamais d'entrée utilisateur libre.
  return <style dangerouslySetInnerHTML={{ __html: style }} data-bhtv-design />;
}
