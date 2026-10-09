/* Andrea Hvattum, demo r4: felles for «Book meg» (kunde) og Andreas side.
   En henvendelse har ingen fast tid. Andrea foreslår en tid, og bekrefter når den er avtalt.
   Status: venter -> foreslatt -> bekreftet, eller avslatt (med melding, f.eks. en henvisning).
   «Databasen» er localStorage i denne nettleseren. I ekte drift byttes hent()/lagre() ut med en enkel backend (se README). */
(() => {
  const NOKKEL = "ah-booking-demo-v4"; // v4: henvendelser uten tid (r4). Eldre nøkler (v3 med kalender) brukes ikke.
  // Tjenestenavn og valg: booking-tjenester.js (generert av _bygg/bygg.py). Faller tilbake til innebygd JSON i siden.
  const DATA = window.AH_TJENESTER || JSON.parse(document.getElementById("booking-data").textContent);
  const TJ = Object.fromEntries(DATA.tjenester.map((t) => [t.id, t]));

  // ---------- datoer ----------
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fraIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const leggTil = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const idag = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const fmt = {
    dag: new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }),
    kort: new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" }),
    sendt: new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" }),
  };
  const stor = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const dagTekst = (s) => stor(fmt.dag.format(fraIso(s)));
  const kortTekst = (s) => fmt.kort.format(fraIso(s));
  const tidTekst = (t) => t ? `${dagTekst(t.dato)} kl. ${t.tid}` : "";
  // Hverdag n arbeidsdager frem (eller tilbake med negativ n)
  function hverdag(n) {
    let x = idag(), k = 0;
    const steg = n < 0 ? -1 : 1;
    while (k < Math.abs(n)) { x = leggTil(x, steg); if (x.getDay() % 6) k++; }
    return iso(x);
  }

  // ---------- lager ----------
  function demoData() {
    const for_ = (min) => new Date(Date.now() - min * 60000).toISOString();
    return [
      { id: "demo-1", demo: true, navn: "Ingrid Bøe", epost: "ingrid@eksempel.no", telefon: "", firma: "Eksempel Regnskap AS",
        tekst: "Vi er sju i et regnskapskontor som har vokst fort. Jeg vil finne ut om vi trenger hjelp med roller og ansvar.",
        nar: "formiddag", hvor: "kaffe", status: "venter", opprettet: for_(95) },
      { id: "demo-2", demo: true, gjelder: "vekstpartner", navn: "Henrik Moen", epost: "henrik@eksempel.no", telefon: "480 00 000", firma: "Eksempel Bygg AS",
        tekst: "Oppfølging etter forrige møte. Vil gå gjennom planen for ledergruppa før nyttår.",
        nar: "uansett", hvor: "digitalt", status: "venter", opprettet: for_(40) },
      { id: "demo-3", demo: true, gjelder: "teambygger", navn: "Sara Lindstad", epost: "sara@eksempel.no", telefon: "", firma: "Eksempel Teknikk AS",
        tekst: "Ny ledergruppe etter omorganisering. Vi trenger å bli et team, ikke bare fire avdelingsledere.",
        nar: "ettermiddag", hvor: "uansett", status: "foreslatt", tid: { dato: hverdag(3), tid: "13:00", hvor: "digitalt" },
        melding: "Hei Sara. Passer en digital prat på dette tidspunktet? Da ser vi på hva dere trenger.", opprettet: for_(60 * 26), oppdatert: for_(60 * 3) },
      { id: "demo-4", demo: true, navn: "Ola Haugen", epost: "ola@eksempel.no", telefon: "", firma: "Eksempel Gründer",
        tekst: "Gründer i oppstart. Trenger en sparringspartner på strategi og prioriteringer.",
        nar: "uansett", hvor: "kaffe", status: "bekreftet", tid: { dato: hverdag(4), tid: "10:00", hvor: "kaffe" },
        melding: "Hei Ola. Da sier vi kaffe i Grinakerhagen. Velkommen!", opprettet: for_(60 * 50), oppdatert: for_(60 * 20) },
      { id: "demo-5", demo: true, gjelder: "vekstpartner", navn: "Henrik Moen", epost: "henrik@eksempel.no", telefon: "480 00 000", firma: "Eksempel Bygg AS",
        tekst: "Månedlig økt. Ledergruppa og budsjettet for neste år.",
        nar: "formiddag", hvor: "kaffe", status: "bekreftet", tid: { dato: hverdag(-15), tid: "09:00", hvor: "kaffe" },
        opprettet: for_(60 * 24 * 26), oppdatert: for_(60 * 24 * 25) },
    ];
  }
  function nytt() { return { v: 4, henvendelser: demoData(), mine: [], meg: null }; }
  function hent() {
    try {
      const s = JSON.parse(localStorage.getItem(NOKKEL));
      if (s && s.v === 4) return s;
    } catch (e) { /* tomt eller blokkert lager: start på nytt */ }
    const s = nytt();
    lagre(s);
    return s;
  }
  function lagre(s) {
    try { localStorage.setItem(NOKKEL, JSON.stringify(s)); } catch (e) { /* privat modus: demoen virker til siden lastes på nytt */ }
  }
  function endre(fn) { const s = hent(); fn(s); lagre(s); return s; }
  function nullstill() { const s = nytt(); lagre(s); return s; }

  const STATUS = {
    venter: "Venter på svar",
    foreslatt: "Andrea har foreslått tid",
    bekreftet: "Bekreftet",
    avslatt: "Andrea har svart",
  };
  const hvorTekst = (h) => DATA.hvor[h] || "";
  const narTekst = (n) => DATA.nar[n] || "";
  const tjNavn = (id) => TJ[id]?.navn || "";

  // ---------- fjær (Apple: demping + respons i stedet for masse/stivhet) ----------
  // Starter alltid fra nåverdien og farten, så bevegelsen kan avbrytes og snus uten hopp.
  function fjaer({ fra = 0, til = 1, fart = 0, respons = 0.4, demping = 1, presisjon, ved, ferdig }) {
    const k = Math.pow((2 * Math.PI) / respons, 2);
    const c = (4 * Math.PI * demping) / respons;
    const h = { x: fra, v: fart, til, stoppet: false };
    let sist = performance.now();
    function steg(na) {
      if (h.stoppet) return;
      let dt = Math.min(0.064, (na - sist) / 1000);
      sist = na;
      while (dt > 0) { // små steg for stabilitet
        const s = Math.min(dt, 1 / 240);
        h.v += (-k * (h.x - h.til) - c * h.v) * s;
        h.x += h.v * s;
        dt -= s;
      }
      const tol = presisjon ?? 0.0005 * Math.max(1, Math.abs(h.til));
      if (Math.abs(h.v) < tol * 20 && Math.abs(h.x - h.til) < tol) {
        h.x = h.til; h.v = 0; ved && ved(h.x); h.stoppet = true; ferdig && ferdig(); return;
      }
      ved && ved(h.x);
      requestAnimationFrame(steg);
    }
    requestAnimationFrame(steg);
    h.stopp = () => { h.stoppet = true; };
    return h;
  }
  const rolig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Haptisk-lignende respons: kort «klikk» i bevegelse, og vibrasjon der nettleseren støtter det (Android).
  function klikk(el) {
    if (navigator.vibrate && navigator.userActivation?.isActive) { try { navigator.vibrate(8); } catch (e) { /* ignorer */ } }
    if (!el || rolig()) return;
    el.classList.remove("er-klikket");
    void el.offsetWidth;
    el.classList.add("er-klikket");
  }

  window.AH = { DATA, TJ, STATUS, iso, fraIso, leggTil, idag, fmt, dagTekst, kortTekst, tidTekst, stor, hverdag,
    hent, lagre, endre, nullstill, hvorTekst, narTekst, tjNavn, fjaer, rolig, klikk, NOKKEL };
})();
