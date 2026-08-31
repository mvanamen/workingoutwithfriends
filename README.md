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

## Export en import
Via **Instellingen → Exporteren/Importeren** deel je een JSON-bestand met alles wat op dit toestel
staat. Werkt los van Supabase, handig als back-up.

## Op je telefoon zetten
Open de Pages-link in Safari/Chrome → Delen → *Zet op beginscherm*. Werkt daarna ook offline.
