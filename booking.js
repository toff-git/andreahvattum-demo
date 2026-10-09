/* Andrea Hvattum, demo r4: «Book meg». Ett rolig skjema i ett steg, ingen kalender og ingen tider.
   Andrea tar kontakt og foreslår en tid (andrea/). Tidligere kunder får detaljene fylt inn fra denne enheten.
   Bevegelse (Apple): knappen svarer på trykk med en gang, skjemaet glir over i kvitteringen med fjær fra nåverdien,
   og ved redusert bevegelse er det bare en kort overtoning. Ingenting sendes; alt lagres i nettleseren (booking-lager.js). */
(() => {
  const A = window.AH;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const EPOST = document.querySelector('.bok__annet a[href^="mailto:"]').getAttribute("href");
  const fornavn = (n) => String(n || "").trim().split(/\s+/)[0];

  const skjema = $("#bokskjema"), kvitt = $("#kvitt"), tittel = $("#bok-t");
  const START_TITTEL = tittel.textContent;
  const felt = { navn: $("#b-navn"), epost: $("#b-epost"), telefon: $("#b-tlf"), firma: $("#b-firma"), tekst: $("#b-tekst") };

  // ---------- «Gjelder: TeamBygger», når man kommer fra en tjenesteside ----------
  let gjelder = new URLSearchParams(location.search).get("gjelder");
  if (!A.TJ[gjelder]) gjelder = null;
  function visGjelder() {
    $("#gjelder").hidden = !gjelder;
    if (gjelder) $("#gjelder-navn").textContent = A.tjNavn(gjelder);
  }
  $("#gjelder-fjern").addEventListener("click", () => {
    gjelder = null;
    const g = $("#gjelder");
    const ferdig = () => { visGjelder(); g.style.opacity = g.style.transform = ""; felt.navn.value ? felt.tekst.focus() : felt.navn.focus(); };
    if (A.rolig()) return ferdig();
    A.fjaer({ fra: 0, til: 1, respons: 0.28, ved: (p) => { g.style.opacity = (1 - p).toFixed(3); g.style.transform = `scale(${(1 - p * 0.06).toFixed(4)})`; }, ferdig });
  });

  // ---------- tidligere kunde: fyll inn fra denne enheten ----------
  function settValg(navn, verdi) {
    const r = verdi && $(`input[name="${navn}"][value="${verdi}"]`, skjema);
    if (r) r.checked = true;
  }
  function fyllInn() {
    const meg = A.hent().meg;
    $("#kjent").hidden = !meg;
    if (!meg) { tittel.textContent = START_TITTEL; return; }
    for (const k of ["navn", "epost", "telefon", "firma"]) felt[k].value = meg[k] || "";
    settValg("nar", meg.nar); settValg("hvor", meg.hvor);
    tittel.textContent = `Velkommen tilbake, ${fornavn(meg.navn)}.`;
    $("#glem").textContent = `Ikke ${fornavn(meg.navn)}? Glem meg på denne enheten`;
  }
  $("#glem").addEventListener("click", () => {
    A.endre((s) => { s.meg = null; s.mine = []; });
    for (const k of ["navn", "epost", "telefon", "firma"]) felt[k].value = "";
    settValg("nar", "uansett"); settValg("hvor", "uansett");
    fyllInn(); tegnMine();
    felt.navn.focus();
  });

  // ---------- sjekk av feltene (inline, ikke først ved sending) ----------
  const krav = {
    navn: (v) => v.trim() ? "" : "Skriv navnet ditt.",
    epost: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Skriv en gyldig e-postadresse, for eksempel navn@firma.no.",
  };
  function sjekk(k) {
    const f = felt[k], feil = krav[k](f.value), fid = f.id + "-feil";
    f.setAttribute("aria-invalid", feil ? "true" : "false");
    if (feil) f.setAttribute("aria-describedby", fid); else f.removeAttribute("aria-describedby");
    $("#" + fid).textContent = feil;
    return !feil;
  }
  for (const k of Object.keys(krav)) {
    felt[k].addEventListener("blur", () => { if (felt[k].value) sjekk(k); });
    felt[k].addEventListener("input", () => { if (felt[k].getAttribute("aria-invalid") === "true") sjekk(k); });
  }
  skjema.addEventListener("change", (ev) => { if (ev.target.matches('input[type="radio"]')) A.klikk(ev.target.nextElementSibling); });

  // ---------- sende ----------
  skjema.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const ugyldige = Object.keys(krav).filter((k) => !sjekk(k));
    if (ugyldige.length) { A.klikk(); felt[ugyldige[0]].focus(); return; }
    const v = Object.fromEntries(Object.entries(felt).map(([k, f]) => [k, f.value.trim()]));
    const nar = $('input[name="nar"]:checked', skjema)?.value || "uansett";
    const hvor = $('input[name="hvor"]:checked', skjema)?.value || "uansett";
    const h = { id: "h-" + Date.now().toString(36), ...v, nar, hvor, status: "venter", opprettet: new Date().toISOString() };
    if (gjelder) h.gjelder = gjelder;
    A.endre((s) => {
      s.henvendelser.push(h);
      s.mine.push(h.id);
      s.meg = $("#b-husk").checked ? { navn: v.navn, epost: v.epost, telefon: v.telefon, firma: v.firma, nar, hvor } : null;
    });
    $("#kvitt-tekst").textContent = `Svaret kommer til ${v.epost}${gjelder ? `. Gjelder ${A.tjNavn(gjelder)}` : ""}.`;
    bytt(skjema, kvitt, () => $("#kvitt-t").focus({ preventScroll: true }));
    $("#kjent").hidden = true;
    tegnMine();
  });
  $("#ny").addEventListener("click", () => {
    felt.tekst.value = "";
    fyllInn();
    bytt(kvitt, skjema, () => (felt.navn.value ? felt.tekst : felt.navn).focus({ preventScroll: true }));
  });

  // Skjema og kvittering bytter plass: det gamle glir litt opp og toner ut, det nye kommer opp fra under.
  // Fjær fra nåverdien (kan avbrytes); ved redusert bevegelse bare en kort overtoning.
  let pagar = null;
  function bytt(ut, inn, ferdig) {
    pagar?.stopp();
    const scene = $("#scene");
    const topp = scene.getBoundingClientRect().top;
    const visInn = () => {
      ut.hidden = true; ut.style.opacity = ut.style.transform = "";
      inn.hidden = false;
      if (topp < 80) scene.scrollIntoView({ block: "start", behavior: A.rolig() ? "auto" : "smooth" });
      if (A.rolig()) { inn.classList.remove("er-tonet"); void inn.offsetWidth; inn.classList.add("er-tonet"); ferdig(); return; }
      pagar = A.fjaer({ fra: 0, til: 1, respons: 0.5, ved: (p) => {
        inn.style.opacity = Math.min(1, p * 1.25).toFixed(3);
        inn.style.transform = p < 1 ? `translate3d(0,${((1 - p) * 24).toFixed(2)}px,0)` : "";
      } });
      ferdig();
    };
    if (A.rolig()) return visInn();
    pagar = A.fjaer({ fra: 0, til: 1, respons: 0.26, ved: (p) => {
      ut.style.opacity = (1 - p).toFixed(3);
      ut.style.transform = `translate3d(0,${(-p * 12).toFixed(2)}px,0)`;
    }, ferdig: visInn });
  }

  // ---------- dine henvendelser (diskret status) ----------
  function statusLinje(h) {
    if (h.status === "foreslatt") return `Andrea foreslår ${esc(A.tidTekst(h.tid).replace(/^./, (c) => c.toLowerCase()))}, ${esc(A.hvorTekst(h.tid.hvor).replace(/^./, (c) => c.toLowerCase()))}.`;
    if (h.status === "bekreftet") return `${esc(A.tidTekst(h.tid))}, ${esc(A.hvorTekst(h.tid.hvor).replace(/^./, (c) => c.toLowerCase()))}.`;
    if (h.status === "avslatt") return "";
    return "Andrea tar kontakt innen én arbeidsdag.";
  }
  function tegnMine() {
    const s = A.hent();
    const mine = s.mine.map((id) => s.henvendelser.find((h) => h.id === id)).filter(Boolean).reverse();
    $("#mine").hidden = !mine.length;
    $("#mine-liste").innerHTML = mine.map((h) => `<li class="mine__rad">
      <p class="mine__hva"><strong>${esc(h.gjelder ? A.tjNavn(h.gjelder) : "Henvendelse")}</strong> <span>Sendt ${esc(A.fmt.sendt.format(new Date(h.opprettet)))}</span></p>
      <p class="mine__status"><span class="status status--${h.status}">${esc(A.STATUS[h.status])}</span></p>
      ${statusLinje(h) ? `<p class="mine__linje">${statusLinje(h)}</p>` : ""}
      ${h.melding && h.status !== "venter" ? `<p class="mine__melding">«${esc(h.melding)}»</p>` : ""}
      ${h.status === "foreslatt" ? `<p class="mine__svar">Passer det ikke? <a href="${esc(EPOST)}?subject=${encodeURIComponent("Ny tid")}">Svar Andrea på e-post</a>.</p>` : ""}
    </li>`).join("");
  }

  // Andrea svarer i en annen fane: oppdater statusen
  addEventListener("storage", (ev) => { if (ev.key === A.NOKKEL) tegnMine(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tegnMine(); });

  visGjelder();
  fyllInn();
  tegnMine();
})();
