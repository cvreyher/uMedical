
# 🧱 TECHNISCHE ARCHITEKTUR (Ranking nach Wichtigkeit)

## 🥇 1. Datenbank & Core-Storage (absolut zentral)

**Neon Postgres**

* Relationale Tabellen für:

    * Arzneimittel, Wirkstoffe, Firmen
    * Dokumente (EMA)
    * Timeline-Events
    * Fakten + Quellen
* **pgvector** für Embeddings (Chunks)
* Vorteile:

    * Ein System für Struktur + Suche + RAG
    * Sehr günstig
    * Sehr gut auditierbar (wichtig für Medizin)

👉 **Kein Graph-DB nötig** (Graph-Feeling über Relationen/Edges)

---

## 🥈 2. Vektorsuche (RAG + semantische Suche)

**pgvector (HNSW)**

* Chunking: section-aware (SmPC/EPAR)
* Index: HNSW (cosine)
* Filter:

    * Sprache
    * Dokumenttyp
    * Arzneimittel / Wirkstoff
* **Hybrid Search**:

    * Vektor + Volltext (tsvector)
    * Ranking via RRF

👉 Ergebnis:

* Gute Treffer für Produktnamen
* Gute Treffer für “Was ist das?”-Fragen

---

## 🥉 3. Ingestion / Worker (Crawl → Parse → Struktur → Embeddings)

**Cloudflare Worker (Cron)** *oder* **kleiner VPS**

* Aufgaben:

    1. EMA-Seiten crawlen
    2. PDFs/HTML extrahieren
    3. Dokumente normalisieren
    4. Chunks + Embeddings
    5. Strukturierte Fakten extrahieren
    6. Timeline-Events erzeugen

👉 Wichtig:

* Inkrementell (Hash / Last-Modified)
* Alles mit Quellen + Confidence

---

## 🧩 4. Monorepo (sauber & wartbar)

**Turborepo**

```
apps/
  web        → Next.js Frontend + API
  worker     → Crawl / Extract / Embed
packages/
  db         → Drizzle Schema + Neon
  search     → Hybrid Search + Ranking
  extract    → Struktur-Extraktion (LLM)
```

---

## 🖥️ 5. Hosting (sehr günstig)

**Empfohlen:**

* Frontend: Cloudflare Pages oder VPS
* API: Cloudflare Worker oder Node auf VPS
* DB: Neon

💰 Kosten: **nahe 0 – <10 €/Monat** im MVP

---

# ⚙️ FUNKTIONEN (nach Nutzerwert gerankt)

## 🥇 1. Arzneimittel-Profilseite (Northdata-ähnlich)

**Zentrale Entität**

* Name
* Wirkstoff(e)
* MAH / Firma
* Zulassungsstatus + Datum
* Dokumente (SmPC, EPAR, PL)

👉 **Der wichtigste Mehrwert**

---

## 🥈 2. Timeline (Zulassung · Updates · Dokumente)

**Regulatorische Timeline**

* Erstzulassung
* EPAR-Veröffentlichungen
* SmPC/PL-Updates
* Sicherheitsrelevante Änderungen

Jeder Punkt:

* Datum
* Kurzbeschreibung
* Quelle (EMA-Link + Snippet)

👉 Sehr starkes Differenzierungsmerkmal

---

## 🥉 3. Suche (Hybrid + Filter)

* Freitext (Vektor + Volltext)
* Filter:

    * Wirkstoff
    * Dokumenttyp
    * Sprache
    * Datum
* Ergebnis:

    * Dokumente
    * Arzneimittel
    * Direkt-Zitate

---

## 🧠 4. “Ask EMA” / RAG-Antworten

* Nutzer stellt Frage
* System:

    * holt relevante Chunks
    * generiert Antwort
    * zeigt Quellen

⚠️ Immer mit Hinweis:

> “Keine medizinische Beratung”

---

## 🧬 5. Strukturierte Fakten (extrahiert)

* Indikationen
* Gegenanzeigen (kurz)
* Nebenwirkungen (aggregiert)
* Darreichungsform / Stärke

Mit:

* Confidence
* Quellenverweis

---

## 🧩 6. Beziehungsnetz (Graph-UI light)

* Arzneimittel ↔ Wirkstoffe
* Arzneimittel ↔ Firmen
* Wirkstoff ↔ mehrere Produkte

Technisch:

* Join-Tabellen oder `edges`
* UI rendert Graph aus SQL

---

## 🧪 7. Forschung / Studien (optional, später)

* Klinische Studien (extern)
* Publikationen
* Als eigene Timeline-Spur

👉 **Nicht MVP-kritisch**

---

# 🏁 MVP-EMPFEHLUNG (klar priorisiert)

### Phase 1 (Pflicht)

1. EMA-Dokumente (EPAR + SmPC EN)
2. Chunking + Vektorsuche
3. Arzneimittel-Profilseite
4. Dokumenten-Timeline

### Phase 2 (stark)

5. Strukturierte Fakten
6. Hybrid Search
7. RAG-Antworten

### Phase 3 (nice to have)

8. Graph-UI
9. Forschungs-Timeline
10. Diff-Ansichten

---

## 🧠 TL;DR

* **Ja, das geht alles**
* **Postgres + pgvector reicht völlig**
* **Northdata-Feeling entsteht durch:**

    * Entitäten
    * Fakten
    * Timeline
    * Quellen

Wenn du willst, kann ich dir als nächsten Schritt:

* ein **konkretes Drizzle-Schema**
* oder ein **exaktes MVP-Backlog (Tickets)**
* oder eine **UI-Wireframe-Beschreibung**

bauen — sag mir einfach, womit du starten willst.
