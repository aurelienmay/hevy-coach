# Brief : agent personnel unifié (« coach »)

> **Pour qui** : l'agent qui conçoit l'architecture cible. Il n'a pas accès au Mac de l'utilisateur.
> **Entrées** : [`assistant-audit.md`](assistant-audit.md) (l'ancien bot Telegram) et le code de ce repo (`hevy-coach`).
> **Statut** : les décisions de la §1 sont **prises par l'utilisateur**. Les « recommandations » des autres sections sont des propositions argumentées que l'architecte peut challenger.

---

## 0. Le problème à résoudre

L'utilisateur s'est dispersé entre plusieurs repos et idées : un bot `assistant` en Python, `hevy-coach` en Next.js et Supabase, `pricewatch`, Scorecast et le trading. Il veut **un seul agent personnel**, joignable sur Telegram, qui :

- couvre sport, nutrition, courses et assistant perso (et le trading), avec une mémoire partagée ;
- **s'étend lui-même**. Exemple : « ajoute des alertes sur les promos du site xyz quand la taille L est à −30 % » doit aboutir à une fonctionnalité implémentée, testée et déployée après validation, comme le fait Claude Code dans une session distante ;
- devient le **seul endroit** où atterrit toute nouvelle idée, pour arrêter de créer un repo par idée.

---

## 1. Décisions déjà prises

| # | Décision |
|---|---|
| D1 | **Un nouveau repo**, un seul bot Telegram. `assistant` sera archivé une fois le portage fini. `hevy-coach` sera absorbé ou archivé (voir §3). |
| D2 | **Hébergement cloud** sur un serveur dédié (à louer, l'utilisateur n'en a pas encore). Le Mac n'héberge plus rien. |
| D3 | **Le cerveau est le Claude Agent SDK** (le moteur de Claude Code), pas un framework maison ni OpenClaw. |
| D4 | **Auto-extension avec validation humaine** : l'agent code sur une branche, lance les tests, puis demande une validation sur Telegram (boutons). Rien n'est déployé sans un clic. |
| D5 | **Scorecast est abandonné** (`/standing`, `/digest` et le job launchd ne sont pas portés). |
| D6 | **Le trading est conservé** : calendrier économique et analyse Gold SMC/ICT, sous forme de plugin. |
| D7 | **Les alertes de promos (Kuiu)** sont conservées et **généralisées** à n'importe quel site. |

---

## 2. Vision fonctionnelle

- **Un bot, plusieurs personas** (coach sport, nutritionniste, assistant perso, trading). Elles partagent un profil, une mémoire et un **état de la semaine**.
- **Remplacer Yazio** avec un journal alimentaire dans Telegram :
  - photo d'un code-barres, puis recherche dans Open Food Facts (et Migros via GTIN) ;
  - recettes préenregistrées ;
  - **confirmation automatique à midi** du repas prévu (« J'ai noté ton bowl poulet ✅ — corriger ? ») ;
  - **estimation sur photo** au resto, avec la vision de Claude.
- **Budgets hebdomadaires** de calories et de volume d'entraînement : l'utilisateur saute des jours, rattrape, mange au resto le week-end. C'est la semaine qui compte, pas la journée.
- **Données santé iPhone** (pas, calories actives, poids) envoyées par une automatisation Raccourcis vers un webhook HTTPS.
- **Hevy** : séances et routines, avec la logique de `hevy-coach` (volume en séries de travail par muscle, objectifs, revue hebdo, écriture des routines).
- **Migros et courses** : promos (filtre protéines), recherche produit, liste de courses alimentée par les recettes et le plan de la semaine.
- **Assistant perso** : agenda (iCloud CalDAV), todos, météo à la demande.
- **Proactivité** : rappels, bilans, alertes. L'agent peut créer ses propres rappels.
- **Apprentissage** : il retient les habitudes (repas récurrents, jours d'entraînement, préférences) et les propose par défaut.

---

## 3. Inventaire : quoi porter depuis l'existant

> ⚠️ Le repo `assistant` est **local, sans remote GitHub**. Pour que l'architecte (ou l'agent) puisse porter son code, il faut d'abord le pousser dans un repo privé ou copier les modules ci-dessous dans le nouveau repo.

| Source | Élément | Décision | Remarque |
|---|---|---|---|
| `assistant/pricewatch/` (≈ 1 000 lignes, 30 tests) | Alertes de soldes Shopify (watchlist par produit et scan du catalogue, filtres YAML, anti-doublon SQLite) | **Porter**, c'est le modèle de plugin | Généraliser au-delà de Shopify : un fetcher par type de site. |
| `assistant/mcps/migros_client.py` | API interne Migros (token invité, promos, recherche, **GTIN**) | **Porter** | Repose sur `curl_cffi` (empreinte TLS de Chrome) pour passer Cloudflare. **Ce n'est pas faisable simplement en Node**, voir §4.2. |
| `assistant/mcps/caldav_client.py` | iCloud CalDAV (list/search/create/delete) | **Porter** | |
| `assistant/mcps/notion_client.py` | Todos et courses Notion | **À trancher** (Q1) | Garder Notion ou migrer en base. |
| `assistant/mcps/economic_calendar_client.py`, `gold_session_client.py` | ForexFactory et yfinance avec prompt SMC/ICT | **Porter** (plugin trading) | Supprimer le repli sur des données de démo factices. |
| `assistant/mcps/meteo_client.py` | Open-Meteo | Porter (simple) | |
| `assistant/context.md` | Profil utilisateur | **Amorce de la mémoire** | À importer en faits structurés, pas tel quel. |
| `assistant/bot.py`, `migros_mcp.py`, routage regex, docs, scripts | — | **Jeter** | Voir l'audit, §8. |
| `hevy-coach/lib/` (`hevy.ts`, `workoutStats.ts`, `muscleMap.ts`, `volumeTargets.ts`, `coach.ts`, `planVolume.ts`, `trainingReference.ts`…) | Logique métier du sport | **Porter** | C'est la partie métier la plus riche et la plus récente. |
| `hevy-coach/schema.sql` | `user_settings`, `favorite_routines`, `coach_reviews`, `adapted_plan_routines`, `compare_plan_routines` (multi-utilisateurs, RLS) | Réutiliser le projet Supabase | Le coach est mono-utilisateur : simplifier. |
| `hevy-coach/app/` (UI Next.js) | Tableau de bord | **Optionnel** | Utile pour les graphiques, mais Telegram reste l'interface principale. |

---

## 4. Architecture recommandée

### 4.1 Vue d'ensemble

```
            Telegram ───────────────┐            iPhone Raccourcis ──┐
                                    ▼                                ▼
┌──────────────────────── Serveur cloud (VPS Linux) ──────────────────────────────┐
│  Reverse proxy HTTPS (Caddy)  →  /telegram (webhook)   /health (webhook santé)  │
│                                                                                 │
│  ┌─ runtime (service systemd, user `coach`) ─────────────────────────────────┐  │
│  │  Passerelle Telegram  →  Routeur de personas  →  Claude Agent SDK         │  │
│  │                                                    │ outils = plugins     │  │
│  │  Scheduler (jobs déclarés par les plugins)  ───────┤ + mémoire            │  │
│  │  Plugins : promos · migros · nutrition · hevy · santé · agenda · trading  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ atelier (user `builder`, sans secrets de prod) ──────────────────────────┐  │
│  │  Agent SDK en mode code : worktree git sur une branche, tests, diff       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       ▼
                   Supabase (Postgres) : mémoire, journaux, état des plugins
                   GitHub : repo source, branches proposées par l'agent
```

### 4.2 Langage

**Recommandation** : un **cœur en TypeScript**, avec des **plugins dans n'importe quel langage** derrière un contrat commun.

- Pour TypeScript : la logique sport de `hevy-coach` est en TS, et l'Agent SDK, grammY (Telegram) et supabase-js y sont de premier ordre. Le tableau de bord Next.js peut partager les types.
- Contre « tout en TypeScript » : le client Migros dépend de `curl_cffi`, et yfinance et pandas sont en Python.
- D'où le **contrat de plugin indépendant du langage** (§4.3). `pricewatch`, Migros et le trading restent en Python, appelés comme des processus. L'agent pourra écrire un nouveau plugin dans le langage le plus adapté.
- L'alternative valable (tout en Python, en portant la logique Hevy) est à arbitrer par l'architecte. L'essentiel est de **ne pas mélanger les langages dans le cœur**.

### 4.3 Contrat de plugin

C'est la pièce centrale : c'est ce que l'agent apprendra à produire seul.

```
plugins/<nom>/
  plugin.yaml      # nom, description, langage, commande d'entrée,
                   # outils exposés à l'agent (nom, description, schéma JSON d'entrée),
                   # jobs planifiés (cron), webhooks éventuels,
                   # NOMS des secrets requis, persona(s) qui y ont accès
  src/…            # implémentation
  tests/…          # tests hors ligne obligatoires (fixtures, comme pricewatch)
  migrations/…     # tables SQL propres au plugin (préfixées par son nom)
  README.md
```

- **Appel** : le runtime invoque `commande <outil> < JSON` et lit un résultat JSON sur stdout. Les plugins TypeScript peuvent être chargés en mémoire pour la performance.
- **Notifications** : un plugin ne parle **jamais** directement à Telegram. Il renvoie des messages au runtime, qui les envoie. C'est la correction du problème actuel où trois processus partagent le même token.
- **Jobs** : le scheduler du runtime lit les `cron` des manifestes. Il n'y a plus de launchd ni de cron système par plugin.

### 4.4 Boucle d'auto-extension (D4)

1. L'utilisateur demande en langage naturel, par exemple « alerte si les chaussures X passent sous 120 CHF en 44 ».
2. Le runtime reconnaît une demande de **construction** et la transmet à l'**atelier**. C'est un processus séparé, sous un autre utilisateur Unix, avec un worktree git et sans accès aux secrets ni à la base de prod.
3. L'agent (Agent SDK, outils fichiers, bash et git, limité au worktree) crée ou modifie un plugin selon le contrat §4.3 et lance les tests et le linter.
4. Il envoie sur Telegram un **résumé** (ce qui change, les fichiers, les tests, les secrets à ajouter), un lien vers la branche ou la PR GitHub, et des boutons **✅ Déployer / ✏️ Modifier / ❌ Annuler**.
5. Sur ✅ : fusion dans `main`, migrations, redémarrage du runtime, puis un **contrôle de santé**. En cas d'échec, **retour arrière automatique** au commit précédent, et l'utilisateur est prévenu.

**Garde-fous** :
- Zones protégées : `core/`, la boucle d'auto-extension, le déploiement et la gestion des secrets. Leur modification exige une double confirmation explicite.
- L'agent ne lit jamais les valeurs des secrets. Il déclare des **noms**, et l'utilisateur les ajoute hors de Telegram (SSH ou fichier chiffré).
- Budget de tokens journalier et par construction, journal de toutes les actions, aucune action externe irréversible (achat, envoi) sans confirmation.

Les **petites adaptations** ne passent pas par du code. Changer un seuil, ajouter un produit à surveiller ou retenir une préférence relève de la **configuration et des données** (tables et YAML modifiables par un outil). Le code n'est écrit que pour une capacité nouvelle.

### 4.5 Mémoire et état

| Couche | Contenu | Stockage |
|---|---|---|
| Profil | Faits durables (objectifs, tailles, préférences, contraintes alimentaires), importés de `context.md` | Table `facts` (clé, valeur, source, date, confiance) |
| État de la semaine | Budget calories et volume, consommé et restant, séances faites ou prévues, repas prévus | Tables dédiées, calculées à partir des journaux |
| Journaux | Repas, mesures santé, séances (synchro Hevy), événements | Tables temporelles |
| Habitudes | Repas récurrents, horaires, jours types, tirés des journaux | Job périodique d'extraction, stocké en `facts` avec confiance |
| Conversation | Fil récent et résumés | Table `messages` et résumés glissants |

L'agent dispose d'outils `remember`, `recall` et `forget`. Le contexte injecté à chaque appel est le profil, l'état de la semaine et le fil récent, avec du **prompt caching**.

### 4.6 Personas

Il y a **un seul agent**. Une persona est un system prompt, plus un sous-ensemble d'outils (déclaré dans les manifestes), plus un ton. Le routage se fait par commande explicite (`/coach`, `/nutri`, `/trade`) ou par une classification légère du message, et les personas peuvent se passer la main. La mémoire et l'état de la semaine sont communs.

### 4.7 Entrées Telegram à gérer

Texte, **photos** (repas, code-barres), boutons inline et callbacks (validation, corrections rapides), éventuellement vocal. Pour les codes-barres, on décode la photo côté serveur avec zxing ou zbar, puis on se rabat sur la vision de Claude. Une Telegram Mini App de scan en direct reste une option ultérieure.

---

## 5. Serveur cloud (à louer)

**Recommandation** : un VPS Linux (Ubuntu LTS) avec **2 vCPU, 4 Go de RAM et 40 Go de disque**, à quelques euros par mois.
- **Hetzner Cloud** : le moins cher et le plus simple, datacenters dans l'UE.
- **Infomaniak** : si l'utilisateur préfère que ses **données de santé restent en Suisse**.

Mise en place (à détailler par l'architecte) :
- clé SSH uniquement, pare-feu (22, 80, 443), mises à jour automatiques ;
- un domaine ou sous-domaine pointé sur le VPS, avec Caddy pour le HTTPS automatique (webhooks Telegram et santé) ;
- utilisateurs Unix `coach` (runtime) et `builder` (atelier), services systemd ;
- sauvegardes : Supabase gère la base, le code est sur GitHub, plus une sauvegarde des secrets chiffrés ;
- accès admin optionnel via Tailscale (déjà utilisé par l'utilisateur).

**Coûts à prévoir** : le VPS, plus l'API Anthropic à l'usage. L'agent en mode construction consomme nettement plus qu'un chat, d'où les plafonds de §4.4.

---

## 6. Phasage

Chaque phase doit être livrable et utilisable seule.

| Phase | Contenu | Critère de réussite |
|---|---|---|
| **0. Socle** | Repo, VPS, Caddy, webhook Telegram, Agent SDK, tables `messages` et `facts`, import de `context.md`, persona assistant | On discute avec le bot, et il se souvient d'une info après un redémarrage. |
| **1. Plugins et proactivité** | Contrat de plugin, scheduler, notifications centralisées. Portage de `pricewatch` (Kuiu) et de Migros et courses | L'alerte Kuiu quotidienne arrive par le nouveau bot. L'ancien job launchd est coupé. |
| **2. Auto-extension** | Atelier, boucle §4.4, garde-fous, retour arrière | « Ajoute des alertes promo sur le site xyz » mène à un plugin testé, validé d'un clic et actif. **C'est le test décisif de toute l'architecture.** |
| **3. Nutrition** | Journal alimentaire, Open Food Facts et GTIN, recettes, confirmation de midi, estimation sur photo, webhook santé iPhone | Une semaine complète loggée sans Yazio. |
| **4. Sport** | Portage de la logique hevy-coach, synchro Hevy, budget hebdo calories et volume, personas coach et nutri | Bilan du dimanche : semaine réelle contre objectifs, avec un plan de rattrapage. |
| **5. Trading et assistant** | Plugin trading (calendrier éco, `/gold`), agenda, météo, todos | Parité avec l'ancien bot, sans ses bugs. |
| **Fin** | Archivage de `assistant`, décision sur l'UI `hevy-coach`, suppression de Scorecast | Un seul repo actif. |

---

## 7. Questions restantes pour l'utilisateur

1. **Todos et courses** : garder Notion comme source, ou tout migrer dans Supabase ?
2. **Agenda** : iCloud (utilisé aujourd'hui) ou Google Calendar ?
3. **Tableau de bord web `hevy-coach`** : le garder (graphiques de volume, revue) ou passer à Telegram uniquement ?
4. **Token Telegram** : réutiliser le bot existant ou en créer un neuf ? (Les deux ne peuvent pas recevoir les messages en même temps.)
5. **Hébergeur** : Hetzner (le moins cher) ou Infomaniak (données en Suisse) ?
6. **« Actions Migros »** : promos et recherche seulement, ou aussi panier et commande en ligne ? Cela demanderait un compte et passe par une API non officielle, donc fragile.
7. **Budget API mensuel** acceptable, pour calibrer les plafonds de l'agent.
