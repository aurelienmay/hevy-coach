# Audit du repo `assistant` (bot Telegram perso)

> Audit en lecture seule, réalisé le 2026-10-07 sur le commit `eb8bf25` (branche `main` du repo local `~/assistant`, sans remote GitHub).
> Il sert d'entrée à la conception d'un « coach personnel » unifié (sport, nutrition et assistant) qui fusionnera ce bot et `hevy-coach`.
> Aucun secret ni identifiant n'est reproduit ici : seuls les **noms** de variables d'environnement sont cités.

---

## 1. Résumé

1. C'est un bot Telegram **mono-utilisateur**, filtré par user ID. Il sert d'assistant généraliste : todos et liste de courses dans Notion, agenda iCloud, météo, promos Migros, calendrier économique et analyse du Gold (trading), alertes de soldes Kuiu, plus deux commandes pour un projet tiers (« Scorecast »).
2. Il est écrit en **Python 3.12** avec `python-telegram-bot` 22 en **long polling** et l'API **Claude** en **tool use** natif (boucle maison de 5 itérations maximum). Le modèle est choisi par mots-clés : Haiku 4.5 par défaut, Sonnet 4 si la requête est jugée complexe.
3. Il n'y a **pas de base de données** pour le bot lui-même. Le profil utilisateur est un fichier statique `context.md` et l'historique de conversation vit en RAM. Seul le sous-module `pricewatch` (alertes Kuiu) a une base, en SQLite.
4. Tout tourne sur un **Mac mini M4 allumé 24/7**. Le bot est un service **launchd** `com.assistant.bot` (`RunAtLoad`, `KeepAlive`) lancé via `bin/run_bot.sh`, qui fait `source ~/.zshenv` puis exécute `venv/bin/python bot.py`. Un second job launchd, `com.assistant.pricewatch`, tourne chaque jour à 9h30 et envoie ses messages directement par l'API HTTP de Telegram.
5. Le bot est **très peu utilisé** : 52 appels Claude enregistrés entre mars et octobre 2026 (≈ 0,12 USD estimés), dont 30 en mars. **Les messages planifiés (météo, calendrier éco, briefing Gold) ne partent jamais**, à cause d'un bug de câblage du scheduler (détail en §4).

---

## 2. Stack

| Domaine | Détail |
|---|---|
| Langage | Python 3.12 (Homebrew), venv local `venv/` (non versionné). **Pas de `requirements.txt` ni de `pyproject.toml`**. |
| Telegram | `python-telegram-bot` 22.7 (`Application`, `CommandHandler`, `MessageHandler`), `run_polling()`. Seul le **texte** est traité (`filters.TEXT`) : pas de photo, de vocal, de document, de clavier inline ni de callback query. Sortie en `ParseMode.HTML`. |
| LLM | SDK `anthropic` 0.86, client **synchrone** appelé via `asyncio.to_thread`. Modèles en dur dans `constants.py` : `claude-haiku-4-5-20251001` (FAST) et `claude-sonnet-4-20250514` (SMART). |
| Usage du LLM | **Tool use natif** : 18 outils déclarés en JSON (Notion 9, CalDAV 5, météo 2, Migros 2), avec un dispatch par nom d'outil. Une **pré-classification par regex** s'y ajoute dans `handle_message` : selon les mots-clés, on déclenche Migros ou le calendrier économique *avant* Claude, et parfois *à la place* de Claude. Pas de prompt caching, pas de streaming. `max_tokens=2048`, 5 itérations d'outils au maximum. |
| Choix du modèle | Sonnet si le message contient un des mots `analyse`, `explique`, `stratégie`, `debug`, `compare`, `rapport`, `pourquoi`, `code`, `comment`, `optimise` ou `refactor`. Sinon Haiku. |
| Planification | `APScheduler` 3.11 (`AsyncIOScheduler` et `CronTrigger`, fuseau Europe/Zurich), **mais jamais démarré** (voir §6). Les vrais jobs passent par launchd. |
| Stockage | Notion (todos, courses), SQLite `data/pricewatch.db` (pricewatch), JSONL `logs/metrics.jsonl`, YAML `data/watchlist.yaml` et `pricewatch/scan.yaml`, Markdown `context.md`. |
| HTTP / scraping | `httpx` (Notion, Open-Meteo), `curl_cffi` avec `impersonate="chrome"` (Migros, contournement Cloudflare ; aussi pour ForexFactory), `requests` (pricewatch), `caldav` + `icalendar` (iCloud), `yfinance` + `pandas` (Gold). |
| Autres dépendances installées | `fastmcp` 3.1, `mcp` 1.26 (pour un serveur MCP Migros cassé et non utilisé), `beautifulsoup4`, `PyYAML`. |

---

## 3. Arborescence commentée

```
assistant/                               (~10 200 lignes versionnées, dont ~2 000 de docs)
├── bot.py                    1583  Monolithe : init des clients, schémas des 18 outils, dispatch,
│                                   boucle Claude, routage regex, handlers Telegram, jobs APScheduler,
│                                   commandes /gold /standing /digest
├── config.py                  113  BotConfig (dataclass, env), validation, logging rotatif + masquage du token
├── constants.py                90  Coordonnées GPS, modèles Claude, triggers SMART, statuts Notion,
│                                   table des MCP « disponibles / à venir », icônes météo
├── context.md                  71  Profil utilisateur statique, injecté tel quel dans le system prompt
├── handlers/
│   └── kuiu.py                167  Commande /kuiu (watchlist pricewatch), seul handler sorti de bot.py
├── mcps/                           « Clients » d'API (pas des serveurs MCP, sauf migros_mcp.py)
│   ├── notion_client.py       434  Todos et liste de courses Notion (httpx, API 2022-06-28)
│   ├── caldav_client.py       386  iCloud CalDAV : list/search/create/delete, cache 15 min, tolérant aux pannes par calendrier
│   ├── meteo_client.py        319  Open-Meteo, résolution approximative « texte de lieu → coordonnées »
│   ├── migros_client.py       448  API interne migros.ch (token invité) : promos, filtre protéines, recherche produits (avec GTIN)
│   ├── migros_mcp.py          390  Serveur MCP Migros asynchrone, doublon du précédent. CASSÉ (import fastmcp) et jamais lancé
│   ├── economic_calendar_client.py 348  JSON ForexFactory (semaine courante), filtré sur les impacts « or »
│   ├── economic_calendar_tools.py   61  Schémas d'outils pour le calendrier éco (désactivés dans bot.py)
│   └── gold_session_client.py 297  yfinance XAU M15→H1/H4 et prompt d'analyse SMC/ICT
├── tools/
│   ├── base.py                 88  ToolError, format_tool_error, escape_html, RateLimiter (10/min)
│   ├── cache.py               253  CacheManager TTL thread-safe
│   └── metrics.py             369  MetricsCollector → logs/metrics.jsonl, commande /metrics
├── pricewatch/                     Sous-projet propre et testé (alertes de soldes Kuiu / Shopify)
│   ├── watcher.py             237  Point d'entrée du job launchd (--report, --dry-run)
│   ├── scan.py / scan.yaml    160/47  Scan du catalogue complet et filtres (tailles, types, couleurs)
│   ├── store.py               217  Schéma SQLite et requêtes
│   ├── notify.py              141  Envoi Telegram par HTTP direct et formatage
│   ├── fetchers/shopify.py    134  Fetcher Shopify générique (/products/<handle>.js)
│   └── config.py, models.py, watchlist.py
├── tests/                          9 modules : pricewatch = 30 vrais tests unitaires hors ligne (OK) ;
│                                   les autres sont des scripts à print() qui appellent les vraies API,
│                                   dont 4 ne s'importent plus (sys.path cassé après déplacement)
├── bin/run_bot.sh, run_pricewatch.sh   Wrappers launchd (source ~/.zshenv puis exec venv python)
├── launchd/com.assistant.pricewatch.plist   (le plist du bot, com.assistant.bot, n'est PAS versionné)
├── docs/                           ARCHITECTURE (231), PERFORMANCE_ANALYSIS (1401), PRICEWATCH (97),
│                                   ASYNC_TO_SYNC_FIX (91), MIGRATION_SUMMARY (78, en fait un script Python)
├── .github/instructions/copilot-instructions.md.instructions.md  (273) Prompt de génération initiale du projet
└── debug_economic.py, verify_migros_fix.py, test_gold_session.py, deploy_migros.sh   Scripts jetables à la racine
```

Hors git sur la machine : `venv/`, `logs/` (bot.log, bot-error.log, metrics.jsonl, pricewatch*.log), `data/pricewatch.db`, `__pycache__/`.

---

## 4. Fonctionnalités

Légende du statut : ✅ marche · 🟡 à moitié · ❌ cassé · 💤 abandonné ou mort.
Preuves d'usage : `metrics.jsonl` (52 appels Claude du 2026-03-23 au 2026-10-07 : mars 30, avril 4, mai 11, juin 1, juillet 2, septembre 1, octobre 3), `bot.log` (rotation le 2026-10-04, donc pas d'historique avant) et un git log réduit à 6 commits (tout le code de mars à juillet a été versionné d'un bloc le 2026-08-04).

| # | Fonctionnalité | Statut | Fichiers | Utilisée ? |
|---|---|---|---|---|
| 1 | **Chat libre avec Claude** et boucle de tool use, historique de 10 messages en RAM | ✅ | `bot.py` (`call_claude`, `handle_message`) | Faiblement (≈ 52 appels en 7 mois, 51 Haiku et 1 Sonnet). |
| 2 | **Todos Notion** : lister, ajouter, compléter, archiver, résumer | ✅ (code) | `mcps/notion_client.py`, outils dans `bot.py` | Inconnu : aucun `Tool call` dans le log courant, et les logs plus anciens sont perdus. |
| 3 | **Liste de courses Notion** : lister, ajouter, cocher, résumer | 🟡 | idem | Inconnu. Les ajouts tombent toujours dans la catégorie `📦 Autre` avec une quantité vide. `delete_shopping_item` existe mais n'est pas exposé à Claude. Bug de routage : le mot « courses » déclenche aussi le dump des promos Migros (n° 7). |
| 4 | **Agenda iCloud (CalDAV)** : lister, chercher, créer, supprimer, résumer | ✅ | `mcps/caldav_client.py`, `bot.py` | Connexion OK à chaque démarrage. Usage inconnu. |
| 5 | **Météo à la demande** (`get_weather`, `weather_today`), lieu = premier événement du jour avec un lieu, sinon Lausanne | 🟡 | `mcps/meteo_client.py`, `bot.py` | Inconnu. **Bug** : `get_calendar_context_for_weather()` appelle `calendar_client.list_events(days=1)` sur le client du *calendrier économique*, qui n'a pas cette méthode. L'exception est avalée, donc l'enrichissement par l'agenda ne fonctionne jamais. La géolocalisation à partir du texte est grossière. |
| 6 | **Messages planifiés** : météo en semaine à 6h20 et le week-end à 9h00, calendrier éco quotidien à 18h et hebdomadaire le dimanche à 18h, briefing Gold en semaine à 6h30 | ❌ | `bot.py` (`post_init` dans `main()`) | **Jamais exécutés.** `post_init` est défini mais jamais passé à `Application.builder().post_init(...)`, donc ni le scheduler ni le message « Bot démarré » ne partent. Confirmé : aucune ligne « APScheduler started » ni « Startup message sent » dans les logs. |
| 7 | **Promos Migros « protéines »** : appel automatique sur les mots `promo`, `réduction`, `solde`, `offre`, `rabais`, `migros`, `courses` et `shopping`, plus l'outil `get_promos` | 🟡 | `mcps/migros_client.py`, `bot.py` | Inconnu. Le code envoie jusqu'à 200 promos filtrées par mots-clés de protéines **avant** la réponse de Claude, et de façon synchrone dans la boucle d'événements. Les faux positifs sont fréquents (« liste de courses »). Dépend d'une API interne non officielle. |
| 8 | **Recherche produit Migros** (`search_migros`) | ✅ (probable) | `mcps/migros_client.py` | Inconnu. Renvoie nom, marque, prix, promo et **GTIN** : directement utile pour un scan de code-barres. |
| 9 | **Serveur MCP Migros** | 💤❌ | `mcps/migros_mcp.py`, `get_mcp_servers()` dans `bot.py` | Jamais lancé (`get_mcp_servers()` n'est appelé nulle part) et `from fastmcp import Server` échoue avec fastmcp 3.x. |
| 10 | **Calendrier économique** (ForexFactory), déclenché par regex (`gold`, `cpi`, `nfp`, `fed`, `taux`, `inflation`, `or `…) : affichage direct, ou envoi à Claude avec les données si la question demande une analyse | 🟡 | `mcps/economic_calendar_*.py`, `bot.py` | Inconnu. La regex `or\s` attrape le mot français « or » (conjonction). **En cas d'échec de l'API, des événements de démo factices sont renvoyés comme s'ils étaient réels.** Les outils Claude correspondants sont commentés. |
| 11 | **/gold** : analyse SMC/ICT du XAU/USD sur les 8 dernières heures (yfinance vers Sonnet) | ✅ (probable) | `mcps/gold_session_client.py`, `bot.py` | Inconnu. Ces appels ne passent pas par `global_metrics` et ne sont donc pas comptés. Appel Anthropic **bloquant** dans la boucle async. |
| 12 | **/standing**, **/digest** : pilotage du projet `~/wc26` (Scorecast, pool de pronostics Coupe du monde 2026). Écrit `standing.json` et lance `run_digest.sh` | 🟡 hors sujet | `bot.py` | Le plist `com.aurelienmay.scorecast` (15h) est toujours chargé. Le tournoi étant terminé, c'est probablement mort (question ouverte). |
| 13 | **Pricewatch Kuiu** : watchlist par produit et scan quotidien du catalogue (~1 700 produits) avec récap des nouvelles soldes dans les tailles de l'utilisateur, plus `/kuiu list/add/remove/check/soldes` | ✅ | `pricewatch/`, `handlers/kuiu.py`, `launchd/…pricewatch.plist` | **Oui, c'est la partie la plus récente** (4 au 6 octobre, 5 runs OK). La watchlist est vide (`data/watchlist.yaml` absent) : seul le scan du catalogue sert. |
| 14 | **/metrics [h]**, **/status**, **/clear** | ✅ / 🟡 | `tools/metrics.py`, `bot.py` | `/status` affiche Notion en ❌ parce que `notion_mcp.py` n'existe pas, ce qui est trompeur. Les coûts sont calculés avec des tarifs de 2024 codés en dur. |
| 15 | **/start** | 💤 | `bot.py` | La fonction existe mais **n'est pas enregistrée** comme handler. |
| 16 | Garde-fous : liste blanche d'un seul user ID, limite de 10 messages par minute, timeouts (outil 10 s, global 30 s), masquage du token dans les logs | ✅ | `config.py`, `tools/base.py` | — |
| 17 | Nettoyage HTML pour Telegram (markdown résiduel vers HTML, balises non supportées) et découpage des messages à 4 096 caractères | ✅ | `bot.py` | — |

---

## 5. Intégrations externes

| Service | Usage | Authentification (noms seulement) |
|---|---|---|
| Telegram Bot API | Polling (bot) et `sendMessage` HTTP direct (pricewatch) | `TELEGRAM_BOT_TOKEN`, destinataire unique `TELEGRAM_USER_ID` |
| Anthropic | Messages API et tool use | `ANTHROPIC_API_KEY` (lue par `BotConfig`, et implicitement par `Anthropic()` dans `/gold`) |
| Notion | REST API `2022-06-28`, deux bases | `NOTION_API_KEY`, `NOTION_TODO_DB_ID`, `NOTION_GROCERY_DB_ID` |
| iCloud Calendar | CalDAV `caldav.icloud.com` | `ICLOUD_USERNAME`, `ICLOUD_APP_PASSWORD` (mot de passe d'application) |
| Open-Meteo | Prévisions | Aucune |
| Migros (migros.ch, API interne non documentée) | Promos, fiches produits, recherche | Token **invité** anonyme récupéré dans l'en-tête de réponse `leshopch`, renouvelé toutes les heures. Empreinte navigateur Chrome via `curl_cffi`. Pas de compte utilisateur. |
| ForexFactory (`nfs.faireconomy.media`, JSON hebdomadaire) | Calendrier économique | Aucune |
| Yahoo Finance (`yfinance`) | Bougies XAU en M15 | Aucune |
| Kuiu / Shopify (`/products/<handle>.js`, catalogue) | Pricewatch | Aucune. User-Agent configurable (`PRICEWATCH_USER_AGENT`). |
| Projet local `~/wc26` (Scorecast) | Fichier et script | Accès disque direct |

Gestion des secrets : tout passe par des variables d'environnement exportées dans **`~/.zshenv`**, que les scripts `bin/*.sh` chargent avec `source`. Un fichier `~/assistant/.env` est lu en complément s'il existe (aujourd'hui il n'existe pas), et `.env.example` liste les noms. Il n'y a ni gestionnaire de secrets ni Keychain. Sous-variables pricewatch : `PRICEWATCH_COUNTRY`, `PRICEWATCH_CURRENCY`, `PRICEWATCH_DELAY_S`, `PRICEWATCH_FAIL_THRESHOLD`, `PRICEWATCH_USER_AGENT`, `PRICEWATCH_WATCHLIST`, `PRICEWATCH_DB`, `PRICEWATCH_SCAN`.

Contrainte pour la cible : **trois processus partagent aujourd'hui le même token de bot** (le bot en polling et pricewatch en envoi seul ; Scorecast semble faire de même, à vérifier). Un seul processus peut faire du polling ou recevoir un webhook pour un token donné.

---

## 6. Mémoire, apprentissage, proactivité, auto-modification

**Mémoire**
- **Long terme** : `context.md`, un profil rédigé à la main (identité, travail, setup tech, trading, profil fitness et nutrition, routine, applis utilisées, préférences de style). Il est lu à chaque message et injecté tel quel en tête du system prompt. **Le bot ne l'écrit jamais.**
- **Court terme** : `conversation_history`, un dict en RAM limité aux 10 derniers messages par utilisateur, **perdu à chaque redémarrage**. Seuls les textes finaux de l'utilisateur et de l'assistant sont gardés, pas les échanges d'outils. `/clear` le vide.
- Aucune base vectorielle, aucun résumé, aucune extraction de faits, aucune préférence apprise.

**Apprentissage** : aucun. Le choix du modèle et le routage reposent sur des listes de mots-clés codées en dur.

**Proactivité**
- Prévue dans le bot : 5 jobs APScheduler (météo matinale, calendrier éco, briefing Gold). **Ils ne fonctionnent pas**, puisque `post_init` n'est jamais branché (§4, n° 6).
- Ce qui marche réellement : des **jobs launchd séparés** qui écrivent directement dans Telegram, à savoir pricewatch tous les jours à 9h30 et Scorecast à 15h (projet externe).
- Il n'existe aucun mécanisme du type « le bot me relance si je n'ai pas répondu », ni d'état ou de suivi d'objectifs.

**Auto-modification** : aucune. Le bot n'a ni outil d'écriture de fichiers, ni git, ni redémarrage, et Claude ne peut toucher ni à `context.md` ni au code. Le cycle de dev est manuel : éditer, `py_compile`, `restart-bot` (un alias shell absent du repo), puis tester sur Telegram. Le fichier `.github/instructions/…` montre que le projet a été généré par un assistant de code (Copilot ou Claude) à partir d'un prompt.

---

## 7. Modèle de données

**Notion, base « Todos »** (`NOTION_TODO_DB_ID`)
- `Tâche` (title), `Statut` (select : `À faire` / `En cours` / `Fait`), `Priorité` (select : `🔴 Haute` / `🟡 Moyenne` / `🟢 Basse`), `Échéance` (date), `Tags` (multi-select), `Notes` (rich text). Suppression par archivage.

**Notion, base « Courses »** (`NOTION_GROCERY_DB_ID`)
- `Article` (title), `Quantité` (rich text), `Catégorie` (select, `📦 Autre` par défaut), `Date` (date d'ajout), `Acheté` (checkbox).
- Le README mentionne une base « Meal Plan » : **elle n'existe pas dans le code**.

**SQLite `data/pricewatch.db`** (pricewatch uniquement)
- `observations` (ts, item_id, key, title, variant, price_cents, compare_at_cents, currency, discount_pct, available)
- `sale_state` (key PK, alerted_pct, max_pct, last_available, sale_started)
- `sale_cycles` (key, title, variant, started, ended, max_pct)
- `item_errors` (item_id PK, count, last_error)
- `catalog_deals` (key PK, alerted_pct, model, color, product_type, url, price_cents, compare_at_cents, pct, sizes, currency, first_seen, updated)
- `catalog_observations` (ts, key, title, product_type, max_pct)
- `runs` (ts, ok, error)

**Fichiers**
- `context.md` : profil libre en Markdown, en sections.
- `data/watchlist.yaml` : `next_id`, puis `items[]` avec `id`, `url`, `size`, `color?`, `note?`.
- `pricewatch/scan.yaml` : filtres (sites, genres, tailles, types et motifs exclus, rabais minimum).
- `logs/metrics.jsonl` : `timestamp`, `event_type`, `duration_ms`, `tokens_input`, `tokens_output`, `cost_usd`, `model`, `user_id`.
- `~/wc26/var/standing.json` : `my_rank`, `leader_gap`, `players`.

**En mémoire** : `conversation_history: dict[user_id, list[{role, content}]]`, plus des caches TTL (CalDAV 15 min, lieu 30 min, promos et calendrier éco 1 h, Gold 1 h).

---

## 8. Points forts et dette technique

### Points forts à réutiliser
- **`pricewatch/`** est le modèle à suivre. C'est un module isolé, configurable en YAML et en variables d'environnement, avec un stockage SQLite idempotent (pas de double alerte, cycles archivés), un seuil d'échecs avant d'alerter, un mode `--dry-run`, 30 tests hors ligne sur fixtures et une doc à jour. Ce patron « job planifié, store, notifier » se transpose directement aux rappels de repas, au bilan hebdomadaire ou aux promos.
- **`migros_client.py`** contient un accès fonctionnel à l'API interne Migros (token invité et contournement Cloudflare), avec promos, recherche et **GTIN par produit**. C'est la brique pour les « actions Migros » et pour relier code-barres, produit Migros et Open Food Facts.
- **`caldav_client.py`** est robuste : il tolère la panne d'un calendrier individuel et met en cache.
- La **boucle de tool use** est simple et lisible, ce qui en fait une bonne base pour des personas, chacune avec son jeu d'outils.
- Les utilitaires Telegram `sanitize_html_for_telegram`, `split_message` et `RedactTokenFormatter`, ainsi que `RateLimiter` et `MetricsCollector` (JSONL), sont petits et réutilisables tels quels.
- `context.md` est un bon **noyau de profil utilisateur** à migrer vers une mémoire structurée.
- L'infra en place fonctionne : Mac mini allumé 24/7, launchd et accès distant (d'après `context.md`).

### Dette technique et ce qui rend le projet bordélique
1. **`bot.py` est un monolithe de 1 583 lignes** qui mélange l'initialisation globale des clients à l'import, les schémas JSON des outils écrits à la main, un dispatch par listes de noms, le routage regex, les handlers, les jobs et les commandes d'un autre projet (Scorecast).
2. **Le routage est hybride et conflictuel.** Des regex pré-déclenchent des outils en plus du tool use de Claude, ce qui donne des réponses en double, des faux positifs (« courses » renvoie les promos Migros, « or » renvoie le calendrier éco) et des cas où Claude est court-circuité.
3. **Des bugs silencieux** : le scheduler ne démarre jamais, `/start` n'est pas enregistré, l'enrichissement météo par l'agenda appelle le mauvais client, et le calendrier éco renvoie de **fausses données de démo** quand l'API échoue.
4. **La boucle async est bloquée** à plusieurs endroits : Migros et le calendrier éco sont appelés directement dans `handle_message`, et l'appel Anthropic de `/gold` est synchrone. Ailleurs, ce sont des clients synchrones dans `to_thread`, un mélange sync/async pénible.
5. **Du code dupliqué ou mort** : deux clients Migros (sync et MCP async), deux `_resolve_event_location`, l'analyse Gold copiée entre la commande et le job, des chemins dupliqués entre `config.py` et `bot.py`, `get_mcp_servers()`, `split_into_conversational_chunks()`, les outils éco commentés et la table `MCPS_AVAILABLE` qui pointe vers des fichiers inexistants.
6. **Des bidouilles d'import** : `sys.path.insert` vers `mcps/` et `tools/`, et des imports plats (`from cache import …`).
7. **Aucune mémoire persistante** : l'historique vit en RAM sans résultats d'outils, et le profil est statique.
8. **Aucun gestionnaire de dépendances** (`requirements.txt` ou `pyproject.toml` absents), donc un venv non reproductible. Des dépendances inutiles traînent (`fastmcp`, `mcp`, `beautifulsoup4`).
9. **Des tests trompeurs** : hors pricewatch, ce sont des scripts à `print()` qui appellent les vraies API. 4 modules sur 9 ne s'importent plus, `pytest` n'est pas installé, et `deploy_migros.sh` référence un `test_bot_compile.py` qui a été déplacé.
10. **Une doc périmée ou fausse** : README (base « Meal Plan » inexistante, noms d'outils faux, alias `bot-status` et `restart-bot` absents du repo), `ARCHITECTURE.md` (parle d'un « refactoring de janvier 2025 »), `MIGRATION_SUMMARY.md` (un script Python dans un `.md`), `PERFORMANCE_ANALYSIS.md` (1 401 lignes d'une analyse de mars).
11. **Des scripts jetables à la racine** : `debug_economic.py`, `verify_migros_fix.py`, `test_gold_session.py`, `deploy_migros.sh`.
12. **Un historique git inexploitable** : 8 203 lignes ont été versionnées en un seul commit le 2026-08-04, et le repo n'a pas de remote. Le plist launchd du bot n'est pas versionné.
13. **Des valeurs codées en dur** : chemins `~/assistant` et `~/wc26`, Lausanne par défaut, modèles (Sonnet 4 date de mai 2025), tarifs de 2024 dans le calcul des coûts.
14. **Un coût par message mal optimisé** : environ 8 000 tokens d'entrée par appel (context.md et 18 schémas d'outils), sans prompt caching. C'est négligeable à l'usage actuel, mais à prévoir pour un bot multi-personas.
15. **La gestion d'erreurs repose sur la recherche de sous-chaînes** dans les messages d'exception (`"401" in str(e)`).
16. **Les logs contiennent des identifiants personnels** (adresse du compte iCloud, user ID Telegram) et, avant le 2026-10-04, ils contenaient le token. Ils ne doivent jamais être exportés tels quels.

---

## 9. Recoupements avec la vision « coach personnel »

| Sujet de la vision | Ce qui existe dans `assistant` | Réutilisable ? |
|---|---|---|
| Bot Telegram unique et multi-personas | Un seul bot, un seul system prompt, un seul jeu d'outils, aucune notion de persona | La boucle de tool use, le filtrage par user ID et les utilitaires HTML. Les personas sont à construire. |
| Mémoire partagée et état de la semaine | `context.md` statique et historique en RAM | Le contenu de `context.md` (préférences de style, profil fitness et nutrition, routine) sert de seed. Le mécanisme est à refaire. |
| Journal alimentaire, OFF, recettes, photo | **Rien** (seulement des préférences « haute protéine » dans `context.md`) | — Les GTIN Migros peuvent servir à relier un code-barres à un produit Migros (prix, promo) en plus d'Open Food Facts. |
| Budget hebdomadaire de calories et de volume | **Rien** | — |
| Données santé iPhone (Raccourcis vers webhook) | **Rien**. Le bot est en polling, sans serveur HTTP entrant. | Il faudra un endpoint HTTP public (le Mac mini n'expose rien aujourd'hui). |
| Hevy | Rien. Seulement listé « à venir » dans `constants.py`, et cité dans `context.md` | Tout est dans `hevy-coach`. |
| Actions Migros et liste de courses | **Oui** : client Migros (promos, recherche, GTIN), liste de courses Notion avec ajout, liste et cochage | C'est le principal apport de ce repo pour la cible. |
| Proactivité (confirmation à midi, bilans) | Scheduler présent mais cassé. Le patron launchd et pricewatch fonctionne. | Le patron pricewatch (job, store, notifier). |
| Apprentissage des habitudes | Rien | — |
| Auto-modification avec garde-fous | Rien | — |

**Hors sujet mais potentiellement utilisé** (usage réel non mesurable, voir §10) :
- Todos Notion et agenda iCloud : des fonctions d'« assistant perso » qui ont leur place dans la persona assistant.
- Météo à la demande, éventuellement utile pour le coach (running dehors).
- Trading Gold : calendrier économique et analyse SMC. C'est un domaine sans lien avec le coach, mais très présent dans `context.md`.
- Pricewatch Kuiu : récent et actif. C'est un job autonome qui peut rester un plug-in séparé.
- Scorecast (`/standing`, `/digest`) : un projet externe, probablement terminé.
- `context.md` cite Gmail et Google Calendar via les connecteurs natifs de Claude (hors de ce bot), Apple Reminders (non intégré) et un setup EA MT5 (hors de ce bot).

---

## 10. Questions ouvertes

1. **Messages planifiés** : ils ne sont jamais partis, du moins depuis la rotation des logs, et probablement depuis toujours. Les briefings du matin (météo, Gold) et le calendrier éco de 18h sont-ils voulus dans le nouveau bot ?
2. **Usage réel** : 52 appels Claude en 7 mois, et les appels d'outils antérieurs au 2026-10-04 ne sont pas journalisés. Quelles fonctions sont vraiment utilisées : todos, courses, agenda, météo, promos ?
3. **Source de vérité** pour les courses et les todos : faut-il garder Notion, ou tout migrer dans Supabase (comme `hevy-coach`) ?
4. **Hébergement cible** : le Mac mini (launchd, polling) ou une infra cloud (Vercel, Supabase, webhook Telegram) ? Les webhooks Raccourcis iPhone et Telegram demandent une URL publique (Tailscale Funnel, tunnel ou cloud).
5. **Token Telegram** : faut-il réutiliser ce bot (et migrer les jobs pricewatch et Scorecast qui envoient avec le même token), ou en créer un nouveau ?
6. **Trading Gold et calendrier économique** : faut-il les inclure dans le nouveau bot (une quatrième persona ?), les laisser dans un bot séparé ou les abandonner ?
7. **Scorecast/wc26** : le projet est-il terminé ? Le job launchd de 15h est toujours chargé.
8. **« Actions Migros »** : s'agit-il de promos et de recherche (déjà en place), ou d'un panier et d'une commande en ligne, ce qui demanderait l'auth d'un compte Migros, non gérée ici et fragile vu qu'il s'agit d'une API non officielle ?
9. **Agenda** : iCloud (utilisé par ce bot) ou Google Calendar (cité dans `context.md`) ? Faut-il intégrer Apple Reminders ?
10. **Pricewatch** : faut-il le garder en module autonome à côté du coach, ou en sortir ?
11. **Données personnelles** : où stocker le profil de santé (poids, objectifs) et les journaux alimentaires, sachant que `context.md` et les logs vivent aujourd'hui en clair sur le Mac mini ?
