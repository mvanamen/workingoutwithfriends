/* Verbinding met Supabase. Apart bestand zodat je dit kunt aanpassen zonder aan app.js te komen.

   Beide waarden zijn publiek: ze staan in een statische site, iedereen kan ze lezen.
   Dat mag hier, want de key alleen geeft geen toegang tot de data. De tabel staat op slot
   achter RLS en de RPC-functies vragen eerst het groepswachtwoord (zie supabase.sql).
   Dat wachtwoord vul je één keer in de app in bij Instellingen; het blijft in localStorage. */
window.WOWF_SUPABASE = {
  url: 'https://knxiusxskxxklonfzvoz.supabase.co',
  key: 'sb_publishable_RVxoSW3HsahN3LPIOppd0A_UZLsehF1',
  // Rij-id in wowf_state. Alleen aanpassen als je meerdere groepen in één project wilt.
  docId: 'wowf',
};
