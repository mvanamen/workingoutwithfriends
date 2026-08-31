// Working Out With Friends — de coach.
//
// Waarom deze functie bestaat: de app is een statische site in een publieke repo.
// Een Anthropic-key kun je daar niet in zetten; anders dan de Supabase-key valt die
// niet af te schermen en kan iedereen die 'm vindt op onze rekening stoken. Dus houdt
// deze functie de key vast en komt er niets van in de browser terecht.
//
// De sluis is dezelfde als bij de rest van de app: je stuurt het groepswachtwoord mee,
// wij halen daarmee de data op via wowf_pull. Klopt het wachtwoord niet, dan geeft
// Postgres 28000 en is er nog geen letter naar Claude gegaan.
//
// Deployen (zie README):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy coach --no-verify-jwt

import Anthropic from 'npm:@anthropic-ai/sdk@0.122.0';

const MODEL = 'claude-opus-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('WOWF_SUPABASE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const DOC_ID = Deno.env.get('WOWF_DOC_ID') ?? 'wowf';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

// ---------------------------------------------------------------- CORS
// Beschermt niets (curl trekt zich er niets van aan) — het wachtwoord doet dat.
// Dit houdt alleen andere websites uit de browser van onze mensen.
const ORIGINS = ['https://mvanamen.github.io'];
function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin! : ORIGINS[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ---------------------------------------------------------------- data
type Log = { w?: number | null; r?: number | null; t?: number };
type Item = { exId: string; name: string; group?: string; cardio?: boolean; sets?: number; reps?: string; logs: Record<string, Log[]> };
type Session = { id: string; date: string; day?: string; extras?: string[]; groups?: string[]; duration?: number; people: string[]; items: Item[]; notes?: string };
type Doc = { people: any[]; exercises: any[]; history: Session[]; session: any; settings: any; lastSetup: any };

async function pull(pass: string): Promise<Doc> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wowf_pull`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: DOC_ID, p_pass: pass }),
  });
  if (!r.ok) {
    const body = await r.text();
    // 28000 komt uit wowf_pull zelf: het groepswachtwoord klopt niet.
    throw new HttpError(body.includes('28000') || r.status === 403 ? 403 : 502,
      body.includes('28000') ? 'Het groepswachtwoord klopt niet.' : 'Kon de gegevens niet ophalen.');
  }
  const rows = await r.json();
  const doc = Array.isArray(rows) && rows[0] ? rows[0].doc : null;
  if (!doc || !doc.people) throw new HttpError(409, 'Er staat nog niets gedeeld — train eerst een keer.');
  return doc as Doc;
}

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

// ---------------------------------------------------------- geschiedenis
const naam = (doc: Doc, id: string) => (doc.people.find((p: any) => p.id === id) || {}).name || id;
const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
const datum = (iso: string) => String(iso).slice(0, 10);

function setsVan(it: Item, pid: string): Log[] {
  return (it.logs?.[pid] || []).filter(s => s && (s.w || s.r));
}
function beste(doc: Doc, pid: string, exId: string): { w: number; r: number; date: string } | null {
  let best: { w: number; r: number; date: string } | null = null;
  for (const h of doc.history || []) {
    for (const it of h.items || []) {
      if (it.exId !== exId) continue;
      for (const s of setsVan(it, pid)) {
        const w = s.w || 0, r = s.r || 0;
        if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r, date: h.date };
      }
    }
  }
  return best;
}
// De laatste `n` keren dat deze persoon deze oefening écht gedaan heeft.
function recent(doc: Doc, pid: string, exId: string, n: number): { date: string; sets: Log[] }[] {
  const out: { date: string; sets: Log[] }[] = [];
  for (let i = (doc.history || []).length - 1; i >= 0 && out.length < n; i--) {
    const h = doc.history[i];
    for (const it of h.items || []) {
      if (it.exId !== exId) continue;
      const sets = setsVan(it, pid);
      if (sets.length) out.push({ date: h.date, sets });
    }
  }
  return out;
}
function laatstGedaan(doc: Doc, exId: string): string | null {
  for (let i = (doc.history || []).length - 1; i >= 0; i--) {
    if ((doc.history[i].items || []).some(it => it.exId === exId)) return doc.history[i].date;
  }
  return null;
}
function setsTekst(sets: Log[], cardio?: boolean): string {
  return sets.map(s => cardio ? `${s.r || 0} min${s.w ? ' / ' + kg(s.w) + ' km' : ''}` : `${kg(s.w || 0)}×${s.r || 0}`).join(', ');
}

// Per oefening per persoon: PR plus de laatste paar keren. Dit is wat de coach
// nodig heeft en verder niets — geen hele geschiedenis het venster in duwen.
function oefeningContext(doc: Doc, items: { exId: string; name: string; cardio?: boolean }[], people: string[]): string {
  const uit: string[] = [];
  for (const it of items) {
    uit.push(`${it.name}${it.cardio ? ' (cardio)' : ''}`);
    for (const pid of people) {
      const b = beste(doc, pid, it.exId);
      const r = recent(doc, pid, it.exId, 3);
      if (!b && !r.length) { uit.push(`  ${naam(doc, pid)} — nog nooit gelogd`); continue; }
      const regels = r.map(x => `${datum(x.date)}: ${setsTekst(x.sets, it.cardio)}`);
      uit.push(`  ${naam(doc, pid)} — PR ${b ? `${kg(b.w)}×${b.r} (${datum(b.date)})` : 'geen'}; ${regels.join(' | ') || 'niets recents'}`);
    }
  }
  return uit.join('\n');
}

// Lichaamsgewicht, lengte, bouw en werk. Alleen wat ingevuld is.
function bouw(p: any): string {
  return [
    p.weight ? `${p.weight} kg` : '',
    p.height ? `${p.height} cm` : '',
    p.build || '',
    p.work ? `werk: ${p.work}` : '',
  ].filter(Boolean).join(', ');
}
function persoonContext(doc: Doc): string {
  return (doc.people || []).map((p: any) => {
    const n = (doc.history || []).filter(h => (h.people || []).includes(p.id)).length;
    const b = bouw(p);
    return `${p.name} (id ${p.id}) — ${n} trainingen${b ? `; ${b}` : ''}${p.goal ? `; doel: ${p.goal}` : ''}`;
  }).join('\n');
}
// Alleen de aanwezigen, voor de gewichtsvoorstellen.
function bouwContext(doc: Doc, people: string[]): string {
  return people.map(pid => {
    const p = (doc.people || []).find((x: any) => x.id === pid);
    if (!p) return `${pid} — onbekend`;
    const b = bouw(p);
    return `${p.name} (id ${p.id}) — ${b || 'bouw niet ingevuld'}`;
  }).join('\n');
}

function historieContext(doc: Doc, n: number): string {
  return (doc.history || []).slice(-n).reverse().map(h => {
    const wie = (h.people || []).map(id => naam(doc, id)).join(', ');
    const dag = h.day ? h.day : (h.groups || []).join('+');
    const oef = (h.items || []).map(it => {
      const per = (h.people || []).map(pid => {
        const s = setsVan(it, pid);
        return s.length ? `${naam(doc, pid)} ${setsTekst(s, it.cardio)}` : null;
      }).filter(Boolean).join('; ');
      return per ? `    ${it.name}: ${per}` : null;
    }).filter(Boolean).join('\n');
    return `${datum(h.date)} — ${dag}, ${h.duration} min, met ${wie}${h.notes ? `\n    notitie: ${h.notes}` : ''}${oef ? '\n' + oef : ''}`;
  }).join('\n');
}

// ---------------------------------------------------------------- prompts
const HUISREGELS = `Je bent de coach van Working Out With Friends, een trainingsapp van drie vrienden
(Maikel, Sjoerd en Rens) die volgens push/pull/legs trainen.

Zo doe je het:
- Nederlands, kort en concreet. Geen inleidingen, geen aanmoedigingsteksten, geen emoji.
- Je baseert je uitsluitend op de cijfers die je krijgt. Verzin nooit een gewicht, een datum
  of een PR die er niet staat. Weet je iets niet, zeg dat dan.
- Gewichten in kilo's, in stappen van 2,5 kg voor barbells en 2 kg voor dumbbells, tenzij de
  geschiedenis laat zien dat ze het anders doen.
- Progressive overload met verstand: pas omhoog als de vorige keer alle reps gehaald zijn,
  en dan klein. Stagneert iemand twee keer op dezelfde oefening, houd het gewicht gelijk of
  stel voor om terug te zakken en opnieuw op te bouwen.
- Heeft iemand een oefening nog nooit gedaan, dan schat je een startgewicht uit zijn
  lichaamsgewicht, lengte, bouw en werk. Schat bewust aan de lichte kant: de eerste set moet
  eindigen met twee of drie reps over. Zeg er in why bij dat het een schatting is om uit te
  proberen. Staat de bouw niet ingevuld, zet weight dan op 0 en schrijf dat hij moet uitproberen.
  Een schatting is het enige wat je mag verzinnen, en je noemt het altijd zo — een PR of een
  eerdere set die er niet staat, verzin je nooit.
- Je bent geen arts. Gaat het over pijn, een blessure, medicijnen of voeding als behandeling,
  dan zeg je in één zin dat ze daarvoor bij een fysio of huisarts moeten zijn. Daarna mag je
  wel gewoon een oefening voorstellen die het pijnlijke gewricht ontziet.`;

// ---------------------------------------------------------------- modes
// Beide modes vullen dezelfde hokjes: per oefening, per persoon, per set een
// gewicht en een aantal reps. De opwarmsets staan vooraan.
const LOG_ITEMS = (sleutel: string) => ({
  type: 'array',
  items: {
    type: 'object',
    properties: {
      [sleutel]: { type: 'string', description: sleutel === 'item' ? 'de id van de oefening in het schema' : 'de id van de oefening uit de bibliotheek' },
      person: { type: 'string', description: 'de id van de persoon' },
      set: { type: 'number', description: 'welke set, 0 is de eerste (dus de opwarmset als die er is)' },
      weight: { type: 'number', description: 'kg; bij cardio de afstand in km, 0 als je die niet kunt inschatten' },
      reps: { type: 'number', description: 'aantal reps; bij cardio het aantal minuten' },
    },
    required: [sleutel, 'person', 'set', 'weight', 'reps'],
    additionalProperties: false,
  },
});
const WAAROM = (sleutel: string) => ({
  type: 'array',
  description: 'per oefening één korte toelichting, maximaal 90 tekens',
  items: {
    type: 'object',
    properties: { [sleutel]: { type: 'string' }, text: { type: 'string' } },
    required: [sleutel, 'text'],
    additionalProperties: false,
  },
});
const SETREGELS = `Vul elke set vooraf in, voor iedereen die meedoet.

Standaard vier sets waarvan de eerste een opwarmset — die is duidelijk lichter, ongeveer de helft
tot zestig procent van de werksets, met wat meer reps. Wijk af waar dat logischer is: bij isolatie
mag het er drie zijn zonder opwarming, bij een zware compound soms twee opwarmsets, en cardio is
altijd één set. Zet het aantal opwarmsets in warmup (0 als er geen is); die staan altijd vooraan.

De werksets mogen hetzelfde gewicht hebben, of oplopen als dat bij hun geschiedenis past. Reps mogen
per set aflopen. Bij cardio zet je de minuten in reps en de kilometers in weight (0 als je die niet
kunt inschatten).`;
async function modeSuggest(doc: Doc, body: any) {
  const items = (body.items || []).slice(0, 20);
  const people = (body.people || []).slice(0, 8);
  if (!items.length || !people.length) throw new HttpError(400, 'Geen oefeningen of personen meegestuurd.');

  const schema = {
    type: 'object',
    properties: { logs: LOG_ITEMS('item'), why: WAAROM('item') },
    required: ['logs', 'why'],
    additionalProperties: false,
  };

  const vraag = `Schema van vandaag:
${items.map((i: any) => `- id ${i.id} — ${i.name}${i.cardio ? ' (cardio)' : ''}, ${i.sets} sets${i.warmup ? ` waarvan ${i.warmup} opwarm` : ''}, richtlijn ${i.reps} reps`).join('\n')}

Aanwezig:
${bouwContext(doc, people)}

Geschiedenis per oefening:
${oefeningContext(doc, items, people)}

${SETREGELS}

Het aantal sets per oefening ligt hierboven vast: vul ze allemaal in, genummerd vanaf set 0.`;

  const res = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system: HUISREGELS,
    messages: [{ role: 'user', content: vraag }],
  });
  const out = parseJson(res);
  return { logs: out.logs || [], why: out.why || [] };
}

async function modePlan(doc: Doc, body: any) {
  const groups: string[] = (body.groups || []).slice(0, 8);
  const aantal = Math.max(2, Math.min(12, Number(body.count) || 6));
  const people = (body.people || []).slice(0, 8);
  const lib = (doc.exercises || []).filter((e: any) => groups.includes(e.group));
  if (!lib.length) throw new HttpError(409, 'Geen oefeningen in de bibliotheek voor deze dag.');
  if (!people.length) throw new HttpError(400, 'Geen personen meegestuurd.');

  const schema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            exId: { type: 'string', description: 'de id van een oefening uit de bibliotheek hieronder' },
            sets: { type: 'number', description: 'totaal aantal sets, opwarmsets meegeteld' },
            warmup: { type: 'number', description: 'hoeveel van die sets opwarmsets zijn; die staan vooraan' },
            reps: { type: 'string', description: 'richtlijn voor de werksets, bijv. "8-12"' },
          },
          required: ['exId', 'sets', 'warmup', 'reps'],
          additionalProperties: false,
        },
      },
      logs: LOG_ITEMS('exId'),
      why: WAAROM('exId'),
      note: { type: 'string', description: 'één zin over de opzet van dit schema, maximaal 140 tekens' },
    },
    required: ['items', 'logs', 'why', 'note'],
    additionalProperties: false,
  };

  const vraag = `Stel een ${body.day || ''}-schema samen van ongeveer ${aantal} oefeningen en vul het
meteen helemaal in.

Aanwezig:
${bouwContext(doc, people) || 'onbekend'}

Bibliotheek (alleen hieruit kiezen, gebruik de id):
${lib.map((e: any) => `- id ${e.id} — ${e.name} [${e.group}]${e.compound ? ', compound' : ''}${e.cardio ? ', cardio' : ''}, standaard ${e.sets}×${e.reps}, laatst gedaan ${laatstGedaan(doc, e.id) ? datum(laatstGedaan(doc, e.id)!) : 'nooit'}`).join('\n')}

Geschiedenis van de aanwezigen op de oefeningen die je overweegt:
${oefeningContext(doc, lib.map((e: any) => ({ exId: e.id, name: e.name, cardio: e.cardio })), people)}

Zet zware compound lifts vooraan, wissel af tussen de spiergroepen, geef voorrang aan wat het
langst niet gedaan is, en zet cardio achteraan. Kies elke oefening hooguit één keer. Zijn ze nog
beginnend — weinig of geen trainingen in de geschiedenis — kies dan oefeningen waarbij de techniek
te overzien is, dus eerder machines en dumbbells dan zware barbells.

${SETREGELS}`;

  const res = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system: HUISREGELS,
    messages: [{ role: 'user', content: vraag }],
  });
  const out = parseJson(res);

  // Alleen ids die echt bestaan, en niets dubbel.
  const geldig = new Set(lib.map((e: any) => e.id));
  const gezien = new Set<string>();
  const items = (out.items || []).filter((i: any) => geldig.has(i.exId) && !gezien.has(i.exId) && gezien.add(i.exId));
  if (!items.length) throw new HttpError(502, 'De coach gaf geen bruikbaar schema terug.');
  const inSchema = new Set(items.map((i: any) => i.exId));
  return {
    items,
    logs: (out.logs || []).filter((l: any) => inSchema.has(l.exId)),
    why: (out.why || []).filter((w: any) => inSchema.has(w.exId)),
    note: String(out.note || '').slice(0, 200),
  };
}

function askContext(doc: Doc): string {
  const s = doc.session;
  return `Wie er meedoen:
${persoonContext(doc)}

Oefeningen in de bibliotheek: ${(doc.exercises || []).length}.

Trainingsgeschiedenis (nieuwste eerst):
${historieContext(doc, 25) || 'nog geen trainingen'}

${s ? `Er loopt op dit moment een training (${s.day || ''}, gestart ${datum(s.startedAt)}):
${(s.items || []).map((it: any) => `  ${it.name}${it.done ? ' [afgevinkt]' : ''}: ${(s.people || []).map((pid: string) => { const x = setsVan(it, pid); return x.length ? `${naam(doc, pid)} ${setsTekst(x, it.cardio)}` : null; }).filter(Boolean).join('; ') || 'nog niets ingevuld'}`).join('\n')}` : 'Er loopt nu geen training.'}`;
}

function parseJson(res: any): any {
  const blok = (res.content || []).find((b: any) => b.type === 'text');
  if (!blok) throw new HttpError(502, 'De coach gaf een leeg antwoord.');
  try { return JSON.parse(blok.text); }
  catch { throw new HttpError(502, 'De coach gaf geen geldig antwoord terug.'); }
}

// ---------------------------------------------------------------- afhandeling
Deno.serve(async (req) => {
  const head = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
  if (req.method !== 'POST') return json({ error: 'Alleen POST.' }, 405, head);

  try {
    if (!Deno.env.get('ANTHROPIC_API_KEY')) throw new HttpError(500, 'ANTHROPIC_API_KEY staat niet ingesteld.');
    const raw = await req.text();
    if (raw.length > 100_000) throw new HttpError(413, 'Verzoek te groot.');
    const body = JSON.parse(raw || '{}');
    const pass = String(body.pass || '');
    if (!pass) throw new HttpError(400, 'Groepswachtwoord ontbreekt.');

    const doc = await pull(pass);

    if (body.mode === 'suggest') return json(await modeSuggest(doc, body), 200, head);
    if (body.mode === 'plan')    return json(await modePlan(doc, body), 200, head);
    if (body.mode === 'ask')     return await modeAsk(doc, body, head);
    throw new HttpError(400, 'Onbekende mode.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, head);
    console.error(e);
    return json({ error: 'Er ging iets mis bij de coach.' }, 500, head);
  }
});

// Het gesprek streamt, anders staar je een halve minuut naar niets.
async function modeAsk(doc: Doc, body: any, head: Record<string, string>): Promise<Response> {
  const inkomend = (body.messages || []).slice(-20);
  const messages = inkomend
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    throw new HttpError(400, 'Geen vraag meegestuurd.');
  }

  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'high' },
    system: [
      { type: 'text', text: HUISREGELS },
      { type: 'text', text: `Dit zijn hun gegevens. Antwoord alleen op basis hiervan.\n\n${askContext(doc)}` },
    ],
    messages,
  });

  const body_ = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      try {
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ text: ev.delta.text })}\n\n`));
          }
        }
        const eind = await stream.finalMessage();
        if (eind.stop_reason === 'refusal') {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'Hier ga ik niet over.' })}\n\n`));
        }
      } catch (e) {
        console.error(e);
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'Er ging iets mis onderweg.' })}\n\n`));
      }
      ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
      ctrl.close();
    },
  });

  return new Response(body_, {
    headers: { ...head, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

function json(data: unknown, status: number, head: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...head, 'Content-Type': 'application/json' } });
}
