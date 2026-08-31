// Haalt de echte merge-functies uit app.js en test ze los.
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');
const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0) throw new Error('blok niet gevonden: ' + from);
  return src.slice(a, b);
};
const DEFAULT_SETTINGS = { restSeconds: 90, minutesPerExercise: 8, warmupMinutes: 5 };
const code = cut('  const DAYS = [', '  const dayById')            // push/pull/legs
  + cut('  function migrateSetup(ls) {', '  function saveLocal() {')
  + cut('  const stamp = o =>', '  const docOf =')
  + '\nmodule.exports = { mergeDocs, mergeSession, mergeLogs, mergeList, newest, docJson, migrateSetup };';
const m = { exports: {} };
new Function('module', 'DEFAULT_SETTINGS', code)(m, DEFAULT_SETTINGS);
const { mergeDocs, mergeSession, mergeLogs, docJson, migrateSetup } = m.exports;

let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.log('FAIL ' + name + '\n  got  ' + g + '\n  want ' + w); }
  else console.log('ok   ' + name);
};

const base = () => ({
  people: [{ id: 'maikel', name: 'Maikel' }, { id: 'rens', name: 'Rens' }],
  exercises: [{ id: 'l1', name: 'Bench press', sets: 4 }],
  history: [], settings: { restSeconds: 90 }, lastSetup: { duration: 60 }, session: null, tomb: {}, updatedAt: 0,
});

// 1. people op id, nieuwste wint
{
  const loc = base(), rem = base();
  loc.people[0] = { id: 'maikel', name: 'Maikel', goal: 'lokaal', updatedAt: 200 };
  rem.people[0] = { id: 'maikel', name: 'Maikel', goal: 'remote', updatedAt: 100 };
  rem.people.push({ id: 'sjoerd', name: 'Sjoerd' });
  const r = mergeDocs(loc, rem);
  eq('people: nieuwste wint', r.people.find(p => p.id === 'maikel').goal, 'lokaal');
  eq('people: union op id', r.people.map(p => p.id).sort(), ['maikel', 'rens', 'sjoerd']);
}

// 2. exercises op naam, ids van de groep winnen bij gelijkspel
{
  const loc = base(), rem = base();
  rem.exercises = [{ id: 'groep1', name: 'bench press', sets: 4 }, { id: 'groep2', name: 'Squat' }];
  const r = mergeDocs(loc, rem);
  eq('exercises: op naam ontdubbeld', r.exercises.length, 2);
  eq('exercises: id van de groep wint bij gelijkspel', r.exercises.find(e => /bench/i.test(e.name)).id, 'groep1');
}
{
  const loc = base(), rem = base();
  loc.exercises = [{ id: 'l1', name: 'Bench press', sets: 5, updatedAt: 300 }];
  rem.exercises = [{ id: 'g1', name: 'Bench press', sets: 4, updatedAt: 100 }];
  eq('exercises: lokale bewerking wint', mergeDocs(loc, rem).exercises[0].sets, 5);
}

// 3. history op id, nieuwste updated_at per sessie
{
  const loc = base(), rem = base();
  loc.history = [{ id: 'h1', date: '2026-08-01', notes: 'lokaal', updatedAt: 500 }];
  rem.history = [{ id: 'h1', date: '2026-08-01', notes: 'remote', updatedAt: 400 },
                 { id: 'h2', date: '2026-08-20', notes: 'van Rens' }];
  const r = mergeDocs(loc, rem);
  eq('history: union op id', r.history.map(h => h.id), ['h1', 'h2']);
  eq('history: nieuwste per sessie wint', r.history[0].notes, 'lokaal');
}

// 4. grafstenen: verwijderd blijft verwijderd
{
  const loc = base(), rem = base();
  loc.history = []; loc.tomb = { 'h:h1': 900 };
  rem.history = [{ id: 'h1', date: '2026-08-01', updatedAt: 500 }];
  eq('grafsteen: verwijderde training komt niet terug', mergeDocs(loc, rem).history.length, 0);
  const loc2 = base(); loc2.tomb = { 'h:h1': 400 };
  loc2.history = [];
  const rem2 = base(); rem2.history = [{ id: 'h1', date: '2026-08-01', updatedAt: 900 }];
  eq('grafsteen: latere bewerking wint van oudere verwijdering', mergeDocs(loc2, rem2).history.length, 1);
}

// 5. settings en lastSetup op updatedAt
{
  const loc = base(), rem = base();
  loc.lastSetup = { duration: 45, updatedAt: 10 };
  rem.lastSetup = { duration: 90, updatedAt: 20 };
  eq('lastSetup: nieuwste wint', mergeDocs(loc, rem).lastSetup.duration, 90);
  loc.settings = { restSeconds: 120, updatedAt: 99 };
  rem.settings = { restSeconds: 60, updatedAt: 1 };
  eq('settings: nieuwste wint', mergeDocs(loc, rem).settings.restSeconds, 120);
  eq('settings: defaults blijven aangevuld', mergeDocs(loc, rem).settings.warmupMinutes, 5);
}

// 6. sessie: per cel wint de laatste toetsaanslag
{
  const item = (logs, extra) => ({ id: 'i1', exId: 'l1', name: 'Bench press', sets: 3, done: false, logs, ...extra });
  const loc = base(), rem = base();
  loc.session = { id: 's1', items: [item({ maikel: [{ w: 60, r: 8, t: 1000 }], rens: [] })], updatedAt: 1000 };
  rem.session = { id: 's1', items: [item({ maikel: [{ w: 55, r: 8, t: 900 }], rens: [{ w: 40, r: 10, t: 1200 }] })], updatedAt: 1200 };
  const r = mergeDocs(loc, rem).session;
  eq('sessie: mijn nieuwere cel blijft staan', r.items[0].logs.maikel[0].w, 60);
  eq('sessie: de ander zijn gewicht komt binnen', r.items[0].logs.rens[0].w, 40);
}
// 6b. open/dicht blijft van dit toestel
{
  const loc = base(), rem = base();
  loc.session = { id: 's1', items: [{ id: 'i1', logs: {}, open: true }], updatedAt: 100 };
  rem.session = { id: 's1', items: [{ id: 'i1', logs: {}, open: false }], updatedAt: 999 };
  eq('sessie: open paneel klapt niet dicht door een ander', mergeDocs(loc, rem).session.items[0].open, true);
}
// 6c. andere sessie-id: nieuwste wint in zijn geheel
{
  const loc = base(), rem = base();
  loc.session = { id: 's1', items: [], updatedAt: 100 };
  rem.session = { id: 's2', items: [], updatedAt: 200 };
  eq('sessie: nieuwe training van een ander wint', mergeDocs(loc, rem).session.id, 's2');
  eq('sessie: remote leeg laat lopende training staan', mergeDocs(loc, base()).session.id, 's1');
  const loc3 = base();
  eq('sessie: training van een ander start hier ook', mergeDocs(loc3, rem).session.id, 's2');
}
// 6d. structuur van de nieuwste kant
{
  const loc = base(), rem = base();
  loc.session = { id: 's1', items: [{ id: 'i1', logs: {} }], updatedAt: 100 };
  rem.session = { id: 's1', items: [{ id: 'i1', logs: {} }, { id: 'i2', logs: {} }], updatedAt: 200 };
  eq('sessie: toegevoegde oefening komt mee', mergeDocs(loc, rem).session.items.map(i => i.id), ['i1', 'i2']);
  const loc2 = base(), rem2 = base();
  loc2.session = { id: 's1', items: [{ id: 'i1', logs: {} }], updatedAt: 300 };
  rem2.session = { id: 's1', items: [{ id: 'i1', logs: {} }, { id: 'i2', logs: {} }], updatedAt: 200 };
  eq('sessie: hier verwijderde oefening blijft weg', mergeDocs(loc2, rem2).session.items.map(i => i.id), ['i1']);
}

// 7. gaten in de setlijst geven geen null (anders klapt bestSet om)
{
  const merged = mergeLogs([undefined, { w: 50, r: 5, t: 2 }], [{ w: 40, r: 6, t: 1 }]);
  eq('logs: geen null in de gaten', merged.every(x => x && typeof x === 'object'), true);
}

// 8. onbruikbaar remote doc laat lokaal met rust
{
  const loc = base();
  eq('leeg remote doc: lokaal blijft', mergeDocs(loc, null), loc);
  eq('rommel remote doc: lokaal blijft', mergeDocs(loc, { foo: 1 }), loc);
}

// 9. docJson laat open en _client weg
{
  const d = { session: { items: [{ id: 'i1', open: true, logs: {} }] }, _client: 'abc', people: [] };
  eq('doc: open en _client gaan niet mee', docJson(d), '{"session":{"items":[{"id":"i1","logs":{}}]},"people":[]}');
}

// 10. push/pull/legs: opzet van een toestel dat de oude app nog draait
{
  const loc = base(), rem = base();
  loc.lastSetup = { duration: 45, day: 'legs', extras: [], updatedAt: 10 };
  rem.lastSetup = { duration: 90, groups: ['Rug', 'Biceps', 'Cardio'], updatedAt: 20 };  // oude app
  const out = mergeDocs(loc, rem).lastSetup;
  eq('lastSetup: oude spiergroepen worden een dag', out.day, 'pull');
  eq('lastSetup: cardio wordt een extra', out.extras, ['cardio']);
  eq('lastSetup: groups verdwijnt', 'groups' in out, false);
}

// 11. de migratie los
{
  eq('migratie: borst + schouders wordt push', migrateSetup({ groups: ['Borst', 'Schouders'] }).day, 'push');
  eq('migratie: benen wordt legs', migrateSetup({ groups: ['Benen'] }).day, 'legs');
  eq('migratie: cardio wordt een extra', migrateSetup({ groups: ['Benen', 'Cardio'] }).extras, ['cardio']);
  eq('migratie: niets gekozen wordt push', migrateSetup({}).day, 'push');
  eq('migratie: zonder lastSetup', migrateSetup(null).extras, []);
  eq('migratie: bestaande dag blijft staan', migrateSetup({ day: 'pull', extras: ['core'] }).day, 'pull');
}

console.log(fails ? '\n' + fails + ' test(s) MISLUKT' : '\nalle tests geslaagd');
process.exit(fails ? 1 : 0);
