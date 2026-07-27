Plan: Dokumentmodul

Nuværende tilstand: `/dokumenter` er en placeholder. Tabellen `documents` findes i databasen med felterne navn, kategori, fil-URL, relateret kontakt, upload-dato og noter. Der er ingen storage-bucket, serverfunktioner eller UI endnu.

Fase 1 — Kerne: upload og metadata
1. Storage-bucket
   - Opret privat bucket `documents` i Supabase Storage.
   - Tilføj RLS-politikker på `storage.objects`, så brugere kun kan se/rette/slette egne filer.

2. Databaseskema
   - Sikr at `documents` har RLS aktiveret med politikker for authenticated brugere.
   - Tilføj evt. `updated_at` og trigger, hvis det mangler.
   - Overvej at normalisere kategori til en `document_categories`-tabel eller fast enum.

3. Serverfunktioner (`src/lib/documents.functions.ts`)
   - `listDocuments()` — list med valgfrit filter på kategori, kontakt og fritekst.
   - `createDocument(data)` — gem metadata og returnér signeret upload-URL eller upload filen direkte via service role.
   - `updateDocument(id, data)` — ret metadata.
   - `deleteDocument(id)` — slet række og tilhørende storage-fil.
   - `getDocumentUploadUrl(filename, contentType)` — returnér en signeret upload-URL til browseren.

4. UI (`src/routes/_authenticated/dokumenter.tsx` + ny komponent)
   - Tabel med kolonner: navn, kategori, kontakt, upload-dato, filtype/størrelse, handlinger.
   - Filtrering og sortering via eksisterende `useTableFilters`/`TableToolbar`.
   - "Upload dokument"-knap med drag-and-drop eller filvælger.
   - Dialog til redigering af metadata.
   - Slet med bekræftelse.
   - Klik på filnavn åbner/download via signeret URL.

Fase 2 — Forslag til udvidelser (vælg hvilke du vil have)
A. Knyt dokumenter til flere entiteter
   - Udover kontakt: bygning, lejemål, maskine, mark, matrikel, jagtleje, opgave.
   - Løsningsforslag: enten nye link-tabeller (`document_buildings`, `document_machines` …) eller en generel `document_links`-tabel med `(document_id, entity_type, entity_id)`.
   - Gør det muligt at uploade direkte fra f.eks. bygningsinfo-panelet.

B. Tags / labels
   - Tilføj `document_tags`-tabel og mange-til-mange-link.
   - Hurtig filtrering på tags i tabellen.

C. Kontrakt- og udløbsdato
   - Tilføj `valid_from`, `valid_until` og `renewal_reminder`.
   - Vis badge for "udløber snart" og send påmindelse (notifikation/email) når dato nærmer sig.

D. Forhåndsvisning og dokumenttype
   - Vis thumbnail/ikon for PDF, billeder, regneark.
   - Integrer en PDF-forhåndsviser eller vis i modal.

E. Bulk upload
   - Upload flere filer på én gang med fælles kategori og kontakt.

F. Versionering
   - `document_versions`-tabel med upload-dato, fil-URL og bruger.
   - Mulighed for at erstatte filen og bevare historik.

G. OCR / søgning i indhold
   - Ekstraher tekst fra PDF-bilag og gør søgbar.
   - Kræver integration (f.eks. Mistral/OCR, OpenAI, eller Lovable AI Gateway).

Anbefaling
Start med Fase 1 + forslag A (knytning til bygninger og maskiner), fordi I allerede har links fra bygningskortet til dokumenter. Derefter kan B, C og D tilføjes efter behov.

Tekniske detaljer
- Brug Supabase Storage browser-upload via `supabase.storage.from('documents').upload(...)` fra komponenten.
- Gem den returnerede `path` som `file_url` med bucket-præfiks.
- Brug `createServerFn` til metadata-CRUD og sletning af storage-fil server-side.
- Følg den eksisterende table-filter og dialog-pattern fra kontakter/bygninger.