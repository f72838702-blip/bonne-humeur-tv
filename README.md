# Bonne Humeur TV 🇬🇳

Plateforme Web TV & Vitrine B2B — « La Télé de la nouvelle génération » (Conakry, Guinée).

**Stack :** Next.js 15 (App Router, TypeScript) · Tailwind CSS v3 · Zustand · Supabase · Vercel

## Démarrage

```bash
npm install
cp .env.local.example .env.local   # renseigner les clés Supabase
npm run dev
```

> Sans clés Supabase, le site fonctionne en **mode démo** : les formulaires
> logguent dans la console au lieu d'insérer en base.

## Supabase — tables à créer

```sql
create table partnership_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organisation text not null,
  contact_name text not null,
  email text not null,
  phone text,
  service text not null,
  budget text,
  message text not null
);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null
);

-- Activer RLS puis autoriser l'insertion publique :
alter table partnership_requests enable row level security;
alter table contact_messages enable row level security;
create policy "insert public" on partnership_requests for insert to anon with check (true);
create policy "insert public" on contact_messages for insert to anon with check (true);
```

## Structure

```
app/
  ├─ page.tsx                  Accueil (hero player, flash infos, grille filtrable, CTA B2B)
  ├─ partenariats/             Offres B2B + mot du PDG + formulaire devis
  ├─ videos/                   Galerie + recherche instantanée
  │   └─ [slug]/               Détail vidéo (SEO dynamique, partage, recommandations)
  └─ contact/                  Coordonnées + formulaire + carte OSM
components/
  ├─ home/    BreakingNews, HeroPlayer, VideosGrid, B2BCta
  ├─ video/   VideoCard, VideosGallery, ShareButtons
  ├─ partenariats/ ServicesGrid, PartnershipForm
  ├─ contact/ ContactForm
  └─ layout/  Header, Footer
lib/          videos.ts (mock → à migrer vers Supabase), supabase.ts, utils.ts
store/        theme.ts (dark mode), filters.ts (catégories, recherche)
```

## Architecture vidéo (anti-surcoût bande passante)

- Le lecteur hero n'embarque l'**iframe YouTube qu'au clic** (couverture légère par défaut).
- `youtube-nocookie.com` est utilisé pour l'embed.
- Aucune vidéo auto-hébergée sur Vercel : tout passe par YouTube/Vimeo/Cloudflare Stream.

## À personnaliser

- [ ] Vrais IDs YouTube dans `lib/videos.ts` (puis migration vers table `videos` Supabase)
- [ ] Plaquette PDF → `public/plaquette-institutionnelle.pdf`
- [ ] Téléphone / email officiels (footer + page contact)
- [ ] Logo réel + `app/icon.png` + images OpenGraph
