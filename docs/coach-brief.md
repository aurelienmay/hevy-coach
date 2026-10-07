# Brief : agent personnel unifié (« coach »)

> **Pour qui** : l'agent qui conçoit l'architecture cible. Il n'a pas accès au Mac de l'utilisateur.
> **Entrées** : [`assistant-audit.md`](assistant-audit.md) (l'ancien bot Telegram) et le code de ce repo (`hevy-coach`).
> **Statut** : les décisions de la §1 sont **prises par l'utilisateur** (version 2, après ses réponses du 2026-10-07). Les « recommandations » des autres sections sont des propositions argumentées que l'architecte peut challenger.

---

## 0. Le problème à résoudre

L'utilisateur s'est dispersé entre plusieurs repos et idées : un bot `assistant` en Python, `hevy-coach` en Next.js et Supabase, `pricewatch`, Scorecast et le trading. Il veut **un seul agent personnel**, joignable sur Telegram, qui :

- couvre sport, nutrition, courses, assistant perso et trading, avec une mémoire partagée ;
- **s'étend lui-même**. Exemple : « ajoute des alertes sur les promos du site xyz quand la taille L est à −30 % » doit aboutir à une fonctionnalité implémentée, testée et déployée après validation, comme le fait Claude Code dans une session distante ;
- devient le **seul endroit** où atterrit toute nouvelle idée, pour arrêter de créer un repo par idée.

---

## 1. Décisions prises

| # | Décision |
|---|---|
| D1 | **Un nouveau repo**, un seul bot Telegram. `assistant` et `hevy-coach` seront archivés une fois le portage fini. |
| D2 | **Hébergement cloud** sur un **VPS Infomaniak** (Suisse), à louer. Le Mac n'héberge plus rien. |
| D3 | **Le cerveau est Claude Code lui-même**, le binaire officiel non modifié, connecté avec **l'abonnement Claude de l'utilisateur**. Il tourne en permanence sur le VPS et reçoit les messages Telegram via le **plugin officiel « channels » Telegram**. C'est le seul moyen de tenir le budget (D9) tout en ayant les pleines capacités d'un agent de code. Voir §3 pour la justification et §8 pour le plan B. |
| D4 | **Auto-extension avec validation humaine** : l'agent code sur une branche, lance les tests, puis demande la validation sur Telegram. Rien n'est fusionné ni déployé sans un « oui » explicite. |
| D5 | **Tout est stocké dans Supabase**. Les todos et la liste de courses quittent Notion. L'agent a un **contrôle complet** sur Supabase : CRUD, migrations (`supabase db push`), fonctions. |
| D6 | **Agenda : iCloud** (CalDAV, déjà implémenté dans `assistant`). |
| D7 | **Pas de tableau de bord web.** Tout passe par Telegram : les graphiques sont envoyés en images. L'UI Next.js de `hevy-coach` est abandonnée ; seule sa logique métier est portée. |
| D8 | **Le token Telegram actuel est réutilisé.** L'ancien bot doit être coupé au moment de la bascule (un seul consommateur des mises à jour par token). |
| D9 | **Budget : 10 CHF/mois maximum** de coûts LLM en plus de l'abonnement Claude existant. |
| D10 | **Migros = « actions » au sens suisse, c'est-à-dire les promotions.** Il faut des promos et de la recherche produit (pour les GTIN et les prix), **pas de panier ni de commande**. |
| D11 | **Scorecast est abandonné.** **Le trading est conservé** (calendrier économique et analyse Gold SMC/ICT). Les **alertes de promos** (Kuiu aujourd'hui) sont conservées et **généralisées** à n'importe quel site. |

---

## 2. Vision fonctionnelle

- **Un bot, plusieurs personas** (coach sport, nutritionniste, assistant perso, trading). Elles partagent un profil, une mémoire et un **état de la semaine**.
- **Remplacer Yazio** avec un journal alimentaire dans Telegram :
  - photo d'un code-barres, puis recherche dans Open Food Facts (et Migros via GTIN) ;
  - recettes préenregistrées ;
  - **confirmation automatique à midi** du repas prévu (« J'ai noté ton bowl poulet ✅ — corriger ? ») ;
  - **estimation sur photo** au resto.
- **Budgets hebdomadaires** de calories et de volume d'entraînement : l'utilisateur saute des jours, rattrape, mange au resto le week-end. C'est la semaine qui compte, pas la journée.
- **Données santé iPhone** (pas, calories actives, poids) envoyées par une automatisation Raccourcis vers un webhook HTTPS.
- **Hevy** : séances et routines, avec la logique de `hevy-coach` (volume en séries de travail par muscle, objectifs, revue hebdo, écriture des routines).
- **Promos Migros** (filtre protéines), recherche produit, **liste de courses** alimentée par les recettes et le plan de la semaine.
- **Alertes promo sur n'importe quel site** avec conditions (taille, couleur, seuil).
- **Assistant perso** : agenda iCloud, todos, météo à la demande.
- **Trading** : calendrier économique (quotidien et hebdo) et briefing Gold le matin en semaine.
- **Proactivité** : rappels, bilans, alertes. L'agent peut créer ses propres rappels.
- **Apprentissage** : il retient les habitudes (repas récurrents, jours d'entraînement, préférences) et les propose par défaut.

---

## 3. Pourquoi Claude Code comme cerveau (et pas l'API)

Faits vérifiés dans la doc officielle (octobre 2026) :

- **Channels Telegram** ([doc](https://code.claude.com/docs/en/channels)) : c'est un plugin officiel (`telegram@claude-plugins-official`, exécuté sous Bun) qui fait du long polling sur le bot et injecte chaque message dans une **session Claude Code en cours**. Claude répond avec les outils `reply`, `react` et `edit_message`. **Les photos et documents reçus sont téléchargés** et lisibles par Claude, et **l'envoi d'images** est possible (graphiques). L'accès est verrouillé par une liste blanche d'expéditeurs (appairage par code). Les abonnés Pro et Max sans organisation y ont accès directement.
- **Limites** : la fonctionnalité est en **research preview** (les flags et le protocole peuvent changer). Les messages n'arrivent **que si la session tourne**. Le plugin ne gère **ni boutons inline**, ni historique des messages, ni approbation des permissions depuis Telegram. Sans personne au terminal, il faut le mode `--dangerously-skip-permissions` (acceptable ici car le VPS est isolé et dédié ; garde-fous en §4.6).
- **Conditions d'utilisation** ([doc](https://code.claude.com/docs/en/legal-and-compliance)) : se connecter au **binaire Claude Code non modifié** avec son propre abonnement est explicitement permis, y compris sur une machine hébergée. En revanche, l'Agent SDK ou un outil tiers avec les identifiants d'abonnement relève de l'**API facturée**. **Le cerveau doit donc être le CLI `claude` lui-même**, en session interactive persistante ou en `claude -p`, et non une application maison sur l'Agent SDK.
- **Conséquence pour le budget** : la conversation, la vision et la programmation consomment le **quota de l'abonnement** (fenêtres de 5 h, partagées avec l'usage perso de Claude Code par l'utilisateur), pas l'API. Les 10 CHF/mois (D9) restent une réserve pour d'éventuels appels API directs dans des jobs, idéalement zéro.

---

## 4. Architecture recommandée

### 4.1 Vue d'ensemble

```
     Telegram (token actuel)                           iPhone Raccourcis
            │ long polling                                    │ HTTPS POST
┌───────────┼──────────── VPS Infomaniak (Ubuntu LTS) ────────┼──────────────────────┐
│           ▼                                                 ▼                      │
│  ┌─ cerveau : `claude --channels plugin:telegram@…` ──┐  ┌─ services (systemd) ──┐ │
│  │  session Claude Code persistante (tmux + systemd)  │  │ Caddy (HTTPS)         │ │
│  │  cwd = repo `coach`                                │  │ webhook /health       │ │
│  │  CLAUDE.md (règles, personas, mémoire)             │  │ scheduler des jobs    │ │
│  │  Skills (personas, workflows : log repas, bilan,   │  │  (promos, rappel midi,│ │
│  │    « construire un plugin »)                       │  │   calendrier éco…)    │ │
│  │  Serveur MCP `coach` (outils métier → plugins)     │  │ envoi Telegram direct │ │
│  │  Hooks (garde-fous)                                │  │  (sendMessage)        │ │
│  └───────────────────────┬────────────────────────────┘  └───────────┬───────────┘ │
│                          │       jobs de raisonnement : `claude -p`  │             │
│                          └──────────────────┬────────────────────────┘             │
└─────────────────────────────────────────────┼──────────────────────────────────────┘
                                              ▼
                     Supabase (Postgres : mémoire, journaux, état des plugins, outbox)
                     GitHub (repo `coach` privé : branches proposées par l'agent)
```

Il y a deux familles de processus :

1. **Le cerveau conversationnel** : une seule session `claude` persistante avec le channel Telegram. Elle discute, logge, raisonne, **et modifie le repo** quand on lui demande une nouvelle capacité.
2. **Les services déterministes** : jobs planifiés, webhooks et notifications, sans LLM. Ce sont le scheduler (`pricewatch` généralisé, le rappel de midi, le calendrier éco) et le récepteur santé. Quand un job a besoin de raisonnement (briefing Gold, bilan hebdo), il lance **`claude -p`** (headless, même abonnement) et envoie le résultat.

### 4.2 Langage

**Recommandation : tout en Python.** Sans tableau de bord web (D7), plus rien ne justifie TypeScript. Les briques existantes à porter sont en Python : `pricewatch`, le client Migros (qui exige `curl_cffi` pour passer Cloudflare, sans équivalent simple en Node), CalDAV et yfinance. La logique de `hevy-coach/lib/*.ts` (stats, carte des muscles, objectifs de volume, revue) représente quelques centaines de lignes à porter. Le serveur MCP `coach` se fait en Python (SDK `mcp` ou FastMCP).

Exception : le plugin channel Telegram est fourni par Anthropic et tourne sous Bun. On ne le modifie pas.

### 4.3 Contrat de plugin

C'est ce que l'agent apprendra à produire seul.

```
plugins/<nom>/
  plugin.yaml      # nom, description ; outils exposés via le serveur MCP (nom, description, schéma) ;
                   # jobs planifiés (cron) ; webhooks ; NOMS des secrets requis ; persona(s) concernée(s)
  <nom>/…          # code Python
  tests/…          # tests hors ligne obligatoires (fixtures, comme pricewatch)
  migrations/…     # SQL Supabase, tables préfixées par le nom du plugin
  README.md
```

- Le **serveur MCP `coach`** découvre les plugins et expose leurs outils au cerveau.
- Le **scheduler** lit les `cron` des manifestes. Il n'y a plus de launchd ni de cron système par plugin.
- **Outbox** : tout message envoyé par un job est aussi écrit dans une table `outbox` (avec un contexte : type, références). Quand l'utilisateur répond (par exemple « non, j'ai mangé une pizza » au rappel de midi), le cerveau **consulte les derniers messages de l'outbox** pour comprendre à quoi il répond. C'est une règle du CLAUDE.md, qui compense l'absence d'historique dans le plugin Telegram.
- **Données externes** : les plugins renvoient des **données structurées** (prix, tailles, GTIN) et jamais du HTML brut, pour limiter l'injection de prompt depuis les sites scrappés.

### 4.4 Boucle d'auto-extension (D4)

Elle est décrite dans un skill `build-plugin` :

1. L'utilisateur demande une capacité nouvelle sur Telegram.
2. Le cerveau crée une **branche** et implémente le plugin selon §4.3 (code, tests, migration).
3. Il lance les tests. S'ils échouent, il corrige jusqu'à 3 essais, sinon il rend compte.
4. Il envoie sur Telegram un résumé : ce qui change, les fichiers, le résultat des tests, les **secrets à ajouter (noms seulement)** et le lien vers la branche sur GitHub. Il termine par « Réponds **oui** pour déployer ». Le plugin ne permet pas de boutons inline.
5. Sur « oui » : fusion dans `main`, `supabase db push`, redémarrage des services, puis **contrôle de santé**. En cas d'échec, **retour automatique** au commit précédent, et l'utilisateur est prévenu.
6. Si le plugin ajoute des outils MCP, le cerveau doit être relancé : un script `restart-brain` relance la session, et la mémoire persiste dans Supabase et le CLAUDE.md.

Les **petites adaptations** (changer un seuil, ajouter un produit à surveiller, retenir une préférence) passent par des **données** (tables Supabase, YAML), pas par du code.

### 4.5 Mémoire et état (Supabase)

| Couche | Contenu | Stockage |
|---|---|---|
| Profil | Faits durables (objectifs, tailles, préférences alimentaires, routine), importés de `context.md` | `facts` (clé, valeur, source, date, confiance) |
| État de la semaine | Budget calories et volume, consommé et restant, séances faites ou prévues, repas prévus | Vues ou tables calculées depuis les journaux |
| Journaux | Repas, mesures santé, séances (synchro Hevy) | Tables temporelles |
| Habitudes | Repas récurrents, horaires, jours types, tirés des journaux | Job périodique d'extraction, stocké en `facts` avec confiance |
| Conversation | Messages reçus et envoyés, plus `outbox` | `messages`, `outbox` ; résumés quotidiens |
| Courses et todos | Migrés depuis Notion (D5) | `shopping_items`, `todos` |

Côté Claude Code : le **CLAUDE.md** contient les règles, les personas et l'instruction de charger le profil et l'état de la semaine en début de session (outil MCP `context_snapshot`). Les **skills** portent les workflows. La session étant longue, Claude Code **compacte** son contexte : rien d'important ne doit vivre uniquement dans la conversation, tout est écrit en base.

### 4.6 Garde-fous (session en `--dangerously-skip-permissions`)

- **VPS dédié** : il ne contient que les accès de l'agent, sans aucune donnée perso hors de Supabase.
- **Hooks Claude Code** (`PreToolUse`) qui bloquent :
  - les modifications de `core/`, des hooks eux-mêmes, du CLAUDE.md « règles », de la config systemd et du fichier de secrets, sauf validation explicite ;
  - toute lecture du fichier de secrets ;
  - `git push --force` et les commandes destructrices hors du repo.
- **Secrets** dans un fichier hors du repo, lisible par les services mais pas par la session Claude (utilisateur Unix séparé, ou injection uniquement dans les processus des services). L'agent déclare des **noms**, l'utilisateur ajoute les valeurs par SSH.
- **Supabase en contrôle complet (D5)** : **sauvegarde automatique quotidienne** (`pg_dump`) vers un stockage hors Supabase, rotation sur 30 jours. Toute suppression en masse ou `DROP` doit être confirmée sur Telegram (règle du CLAUDE.md, plus un hook sur les migrations).
- **Accès révocables** : mot de passe d'application iCloud, clé Hevy, token Telegram, clés Supabase.
- **Journal** de toutes les actions (hooks `PostToolUse` vers une table `audit_log`).

### 4.7 Entrées Telegram

- Texte, **photos** (repas, codes-barres) et documents sont gérés par le plugin.
- Pour les codes-barres, décodage côté serveur (outil MCP avec `zxing-cpp` ou `pyzbar`), puis repli sur la vision de Claude.
- **Pas de vocal** (non géré par le plugin) ni de boutons inline. Les validations se font par réponse texte (« oui », « non », « corrige : … »).

---

## 5. Serveur Infomaniak (à louer)

- Un **VPS Lite** ou VPS Cloud Infomaniak sous **Ubuntu LTS**, avec **2 vCPU et 4 Go de RAM** au minimum. Claude Code, Bun, Python, les jobs et la décompression d'images y tiennent largement.
- Mise en place à détailler par l'architecte :
  - clé SSH uniquement, pare-feu (22, 80, 443), mises à jour automatiques ;
  - un **sous-domaine** pointé sur le VPS, avec Caddy pour le HTTPS automatique (webhook santé ; Telegram reste en polling via le plugin) ;
  - installation de Claude Code, Bun et du plugin Telegram, connexion avec l'abonnement de l'utilisateur ;
  - session cerveau dans **tmux sous systemd** (redémarrage automatique), services Python en systemd ;
  - accès admin via Tailscale (déjà utilisé par l'utilisateur), en option ;
  - sauvegardes : code sur GitHub, base via `pg_dump` quotidien, secrets chiffrés à part.

---

## 6. Inventaire : quoi porter

> ⚠️ Le repo `assistant` est **local, sans remote GitHub**. Il faut le pousser dans un repo privé, ou copier les modules ci-dessous dans le nouveau repo, avant le portage.

| Source | Élément | Décision |
|---|---|---|
| `assistant/pricewatch/` (≈ 1 000 lignes, 30 tests) | Alertes de soldes Shopify (watchlist et scan du catalogue, filtres YAML, anti-doublon) | **Porter, c'est le modèle de plugin.** Passer de SQLite à Supabase et généraliser au-delà de Shopify. |
| `assistant/mcps/migros_client.py` | API interne Migros (token invité, promos, recherche, GTIN) | **Porter.** Promos et recherche uniquement (D10). |
| `assistant/mcps/caldav_client.py` | iCloud CalDAV | **Porter.** |
| `assistant/mcps/notion_client.py` | Todos et courses | **Migrer les données** une fois vers Supabase, puis jeter. |
| `assistant/mcps/economic_calendar_client.py`, `gold_session_client.py` | ForexFactory, yfinance, prompt SMC/ICT | **Porter** (plugin trading). Supprimer le repli sur des données de démo factices. |
| `assistant/mcps/meteo_client.py` | Open-Meteo | Porter (simple). |
| `assistant/context.md` | Profil | **Amorce de `facts`**. |
| `assistant/bot.py`, `migros_mcp.py`, routage regex, docs, scripts, Scorecast | — | **Jeter.** |
| `hevy-coach/lib/*.ts` (`hevy.ts`, `workoutStats.ts`, `muscleMap.ts`, `volumeTargets.ts`, `planVolume.ts`, `coach.ts`, `trainingReference.ts`, `trainingProfile.ts`, `schedule.ts`, `exerciseTemplates.ts`) | Logique sport | **Porter en Python.** |
| `hevy-coach/schema.sql` | Schéma multi-utilisateurs avec RLS | Reprendre le **projet Supabase** et simplifier en mono-utilisateur. |
| `hevy-coach/app/`, `components/`, auth | UI web | **Jeter** (D7). |

---

## 7. Phasage

| Phase | Contenu | Critère de réussite |
|---|---|---|
| **0. Socle** (rapide) | VPS, Claude Code, plugin Telegram avec le **token actuel** (couper l'ancien bot), repo `coach`, CLAUDE.md, Supabase (`facts`, `messages`), import de `context.md`, garde-fous §4.6 | On discute avec l'agent sur Telegram, il se souvient d'une info après un redémarrage, et il peut modifier son repo. |
| **1. Services et plugins** | Contrat de plugin, serveur MCP `coach`, scheduler, outbox. Portage de `pricewatch` (Kuiu), des promos Migros, de la liste de courses (migration depuis Notion) et de l'agenda iCloud | L'alerte Kuiu arrive par le nouveau système. Plus aucun job launchd sur le Mac. |
| **2. Auto-extension** | Skill `build-plugin`, boucle §4.4, retour arrière | « Ajoute des alertes promo sur le site xyz » mène à un plugin testé, validé par « oui » et actif. **C'est le test décisif.** |
| **3. Nutrition** | Journal alimentaire, Open Food Facts et GTIN, recettes, rappel de midi, estimation sur photo, webhook santé | Une semaine loggée sans Yazio. |
| **4. Sport** | Portage de la logique hevy-coach, synchro Hevy, budget hebdo calories et volume, personas coach et nutri, graphiques en image | Bilan du dimanche : semaine réelle contre objectifs, avec un plan de rattrapage. |
| **5. Trading** | Calendrier éco et briefing Gold via `claude -p` | Messages du matin et du soir reçus, corrects, sans fausses données. |
| **Fin** | Archivage de `assistant` et `hevy-coach`, suppression de Scorecast et des jobs du Mac | Un seul repo actif. |

---

## 8. Risques et plan B

| Risque | Mitigation |
|---|---|
| Channels est en **research preview** : l'interface peut changer, voire disparaître | Le cerveau reste un simple `claude` dans le repo. Plan B : remplacer le plugin channel par un petit pont Telegram maison qui appelle `claude -p --resume` à chaque message (même binaire, même abonnement). |
| **Quota d'abonnement** partagé avec l'usage perso de Claude Code | Discussion courante avec un modèle léger et les grosses tâches de code avec un modèle plus fort. Les jobs sans LLM restent sans LLM. Surveiller les limites. |
| Session longue : **compaction** du contexte, crash | Mémoire en base, CLAUDE.md, redémarrage systemd, `context_snapshot` au démarrage. |
| **Injection de prompt** via des sites scrappés, combinée au mode sans permissions | Plugins à sortie structurée, secrets illisibles par la session, hooks, sauvegardes. |
| L'API Migros non officielle casse | Plugin isolé, alerte après N échecs (patron pricewatch). |

---

## 9. Questions restantes

1. **Plan d'abonnement Claude** (Pro, Max 5× ou Max 20×) : cela détermine le quota disponible pour un agent actif 24/7, en plus de l'usage perso.
2. **Nom de domaine** pour le webhook santé (un sous-domaine d'un domaine existant, ou Infomaniak).
3. Faut-il réutiliser le **projet Supabase de hevy-coach** ou en créer un neuf ? (Reco : le réutiliser.)
