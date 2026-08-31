# Working Out With Friends

Kleine web-app voor Maikel, Sjoerd en Rens om samen te trainen volgens push / pull / legs:
schema van de dag, gewichten loggen, progressie en PR's bijhouden.

Geen build stap, geen backend. Open `index.html` of zet de repo op GitHub Pages.

## Gebruik in de gym
1. Open de site, tik **Vandaag**.
2. Kies wie er is, welke dag (**Push**, **Pull** of **Legs**) en hoelang. Core en cardio zet je er
   los bij aan; die sluiten het schema af.
3. **Maak het schema** → oefeningen uit die dag, afgewisseld per spiergroep, minst recent gedaan
   eerst. Na een training stelt de app zelf de volgende dag in de rotatie voor.
4. Per oefening: gewichten en reps per persoon invullen, rusttimer, afvinken.
5. **Training afronden** → alles landt in **Progressie** (records, grafiek, geschiedenis).

## Samen synchroniseren
Alles staat altijd in `localStorage` van het toestel. Vul je bij **Instellingen → Samen** het
groepswachtwoord in, dan gaat het er bovenop gedeeld via Supabase: een lopende training en de
gewichten die iemand invult zie je bij alle drie meteen.

Eenmalig opzetten:

1. Draai `supabase.sql` in Supabase → SQL Editor. Zet daarin eerst je eigen groepswachtwoord.
2. Zet de project-URL en de publishable key in `supabase-config.js` (die twee mogen publiek zijn —
   zie de toelichting bovenin `supabase.sql`).
3. Open de app, ga naar **Instellingen → Samen** en vul het groepswachtwoord in. Eén keer per toestel.

Rechtsboven staat de status: *gesynced*, *bezig*, *offline* of *lokaal*. Zonder verbinding werkt
alles gewoon door; zodra er weer net is gaat het vanzelf mee.

Realtime is het snelle pad, maar een telefoon in je broekzak bevriest de websocket zonder dat te
melden. Daarom polt de app er los doorheen — elke 4 seconden tijdens een training, elke 20 daarbuiten
— en haakt hij opnieuw aan zodra blijkt dat het kanaal niet meer leeft. Een training starten, een
oefening afvinken en afronden gaan bovendien meteen de deur uit in plaats van na de debounce.
Wat de app niet kan: iets laten zien terwijl hij dicht is. Dat zou een pushmelding vragen.

Hoe het samenvoegt: personen op id, oefeningen op naam, trainingen op id, en de lopende training,
`lastSetup` en de instellingen op tijdstempel — de nieuwste wint. Binnen een lopende training gaat
het per ingevuld hokje: wie het laatst typte wint, zodat jullie tegelijk in dezelfde oefening kunnen
invullen. Het veld waar je op dat moment zelf in staat te typen wordt nooit overschreven.
Draai `node merge.test.js` om die regels te controleren.

## De coach

Onder **Coach** stel je vragen over jullie eigen cijfers, op het opzetscherm kan de coach het
schema samenstellen, en tijdens een training zet **Gewichten voorstellen** onder elke oefening
een startgewicht per persoon. Alles op basis van jullie geschiedenis; hij verzint geen getallen.

De Anthropic-key kan niet in deze repo — die is publiek, en anders dan de Supabase-key valt een
API-key niet af te schermen. Daarom draait de aanroep in een Edge Function
(`supabase/functions/coach/index.ts`). Die houdt de key vast, en de sluis is dezelfde als bij de
rest van de app: de browser stuurt het groepswachtwoord mee, de functie haalt daarmee de data op
via `wowf_pull`. Klopt het wachtwoord niet, dan geeft Postgres 28000 en is er nog geen letter naar
Claude gegaan.

Eenmalig opzetten:

1. Haal een API-key bij [console.anthropic.com](https://console.anthropic.com) → API keys.
2. Installeer de CLI en koppel het project:
   ```
   brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref knxiusxskxxklonfzvoz
   ```
3. Zet de key als secret en deploy. De key staat hierna alleen bij Supabase, niet in de repo:
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy coach --no-verify-jwt
   ```

`--no-verify-jwt` staat er omdat de publishable key geen JWT is; het groepswachtwoord doet het
werk, precies zoals bij `wowf_pull` en `wowf_push`. Dat wachtwoord is dus ook wat je Anthropic-
rekening beschermt — deel het niet buiten jullie drieën.

Het draait op `claude-opus-5`. Het schema en de gewichten gaan op effort `medium`, het gesprek op
`high` (staat boven in `index.ts`). Bij jullie gebruik — een paar keer per week — kost dat centen
per maand, geen euro's.

## Export en import
Via **Instellingen → Exporteren/Importeren** deel je een JSON-bestand met alles wat op dit toestel
staat. Werkt los van Supabase, handig als back-up.

## Op je telefoon zetten
Open de Pages-link in Safari/Chrome → Delen → *Zet op beginscherm*. Werkt daarna ook offline.
