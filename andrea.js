/* Andrea Hvattum, demo r4: Andreas side. Henvendelser fra «Book meg» kommer uten tid.
   Andrea foreslår en tid (dato og klokkeslett hun velger), bekrefter når tiden er avtalt, eller avslår/henviser med en melding.
   PIN i demoen: 0000 (bare en skjerm, ingen ekte sikkerhet).
   All data går gjennom booking-lager.js (window.AH), så kunden ser endringene i samme nettleser. */
(() => {
  const A = window.AH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PIN = "0000";
  const fornavn = (h) => h.navn.split(" ")[0];
  const smaa = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const STATUS = { venter: "Venter på deg", foreslatt: "Tid foreslått", bekreftet: "Bekreftet", avslatt: "Avslått" };
  const PLUSS = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const mob = () => matchMedia("(max-width: 767px)").matches;
  const finn = (id) => A.hent().henvendelser.find((x) => x.id === id);

  // ---------- PIN ----------
  const pin = $("#pin"), admin = $("#admin");
  function lasOpp() {
    pin.hidden = true; admin.hidden = false;
    try { sessionStorage.setItem("ah-andrea", "1"); } catch (e) { /* ignorer */ }
    tegn();
    $("#admin-t").focus();
  }
  let apen = false;
  try { apen = sessionStorage.getItem("ah-andrea") === "1"; } catch (e) { /* ignorer */ }
  const pinFelt = $("#pin-kode");
  function provPin() {
    if (pinFelt.value === PIN) return lasOpp();
    pinFelt.setAttribute("aria-invalid", "true");
    pinFelt.setAttribute("aria-describedby", "pin-feil");
    $("#pin-feil").textContent = "Feil kode. Prøv igjen.";
    pinFelt.select();
    A.klikk();
    if (!A.rolig()) { pin.classList.remove("er-ristet"); void pin.offsetWidth; pin.classList.add("er-ristet"); }
  }
  $("#pin-skjema").addEventListener("submit", (ev) => { ev.preventDefault(); provPin(); });
  // Fire siffer er nok: lås opp uten å måtte trykke på knappen
  pinFelt.addEventListener("input", () => {
    pinFelt.value = pinFelt.value.replace(/\D/g, "").slice(0, 4);
    if (pinFelt.value.length === 4) provPin();
  });
  $("#las").addEventListener("click", () => {
    try { sessionStorage.removeItem("ah-andrea"); } catch (e) { /* ignorer */ }
    admin.hidden = true; pin.hidden = false;
    pinFelt.value = ""; pinFelt.removeAttribute("aria-invalid"); $("#pin-feil").textContent = "";
    pinFelt.focus();
  });

  // ---------- faner ----------
  const faner = $$('[role="tab"]');
  function velgFane(f, fokus) {
    faner.forEach((x) => {
      const valgt = x === f;
      x.setAttribute("aria-selected", String(valgt));
      x.tabIndex = valgt ? 0 : -1;
      $("#" + x.getAttribute("aria-controls")).hidden = !valgt;
    });
    if (fokus) f.focus();
    try { sessionStorage.setItem("ah-andrea-fane-v4", f.id); } catch (e) { /* ignorer */ }
  }
  faner.forEach((f, i) => {
    f.addEventListener("click", () => velgFane(f));
    f.addEventListener("keydown", (ev) => {
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: faner.length - 1 }[ev.key];
      if (j === undefined) return;
      ev.preventDefault();
      velgFane(faner[(j + faner.length) % faner.length], true);
    });
  });
  try { const f = sessionStorage.getItem("ah-andrea-fane-v4"); if (f && $("#" + f)) velgFane($("#" + f)); } catch (e) { /* ignorer */ }

  // ---------- kortene ----------
  const siden = (iso) => {
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 2) return "nå nettopp";
    if (min < 60) return `for ${min} min siden`;
    if (min < 60 * 24) return `for ${Math.round(min / 60)} t siden`;
    const d = Math.round(min / 1440);
    return `for ${d} ${d === 1 ? "dag" : "dager"} siden`;
  };
  // Kundens ønske, i én rolig linje. «Uansett» sies bare når begge er uansett.
  function onske(h) {
    const d = [];
    if (h.nar && h.nar !== "uansett") d.push(smaa(A.narTekst(h.nar)));
    if (h.hvor && h.hvor !== "uansett") d.push(smaa(A.hvorTekst(h.hvor)));
    return d.length ? `Ønsker ${d.join(", ")}.` : "Ingen ønsker om tid eller sted.";
  }
  const tidLinje = (t) => `${A.tidTekst(t)}, ${smaa(A.hvorTekst(t.hvor))}`;
  // Tidligere kunde: samme e-post har en bekreftet samtale fra før.
  function kundeinfo(s, h) {
    const ep = (h.epost || "").toLowerCase();
    const for_ = s.henvendelser.filter((x) => x.id !== h.id && x.status === "bekreftet" && (x.epost || "").toLowerCase() === ep && x.opprettet < h.opprettet);
    const sist = for_.at(-1);
    const linje = for_.length
      ? `${for_.length} ${for_.length === 1 ? "samtale" : "samtaler"} før. Sist ${esc(A.kortTekst(sist.tid.dato).replace(/\.$/, ""))}${sist.gjelder ? `, ${esc(A.tjNavn(sist.gjelder))}` : ""}.`
      : "Første henvendelse.";
    return { kjent: for_.length > 0, linje };
  }
  const utkast = {}; // meldinger Andrea har begynt på, så de overlever ny tegning

  function knapper(h) {
    const avsla = `<button type="button" class="knapp knapp--stille knapp--liten" data-gjor="avsla"><span>Avslå eller henvis</span></button>`;
    if (h.status === "venter") return `<button type="button" class="knapp knapp--primar knapp--liten" data-gjor="foresla"><span>Foreslå tid</span></button>
      <button type="button" class="knapp knapp--sekundar knapp--liten" data-gjor="bekreft-ny"><span>Tid er avtalt</span></button>${avsla}`;
    return `<button type="button" class="knapp knapp--primar knapp--liten" data-gjor="bekreft"><span>Bekreft</span></button>
      <button type="button" class="knapp knapp--sekundar knapp--liten" data-gjor="foresla"><span>Foreslå ny tid</span></button>${avsla}`;
  }
  function sakHtml(s, h, full = true) {
    const k = kundeinfo(s, h);
    const tid = h.tid && (h.status === "foreslatt" || h.status === "bekreftet")
      ? `<p class="sak__tid sak__tid--${h.status}"><small>${h.status === "foreslatt" ? "Du har foreslått" : "Avtalt"}</small>${esc(tidLinje(h.tid))}</p>` : "";
    return `<article class="sak ${k.kjent ? "sak--kjent" : "sak--ny"}" data-id="${h.id}" aria-labelledby="sak-${h.id}">
      <div class="sak__hode">
        <p class="sak__tj"><b>${esc(h.gjelder ? A.tjNavn(h.gjelder) : "Ny prat")}</b>${full ? `<span class="sak__mottatt">Mottatt ${siden(h.opprettet)}</span>` : ""}${h.demo ? '<span class="merke merke--demo">Demo-data</span>' : ""}</p>
        <h3 class="sak__nar" id="sak-${h.id}" tabindex="-1">${esc(h.navn)}${h.firma ? `<span>${esc(h.firma)}</span>` : ""}</h3>
        <p class="sak__hvor">${esc(onske(h))}</p>
        ${tid}
      </div>
      <div class="sak__kunde">
        <span class="kundemerke ${k.kjent ? "kundemerke--kjent" : "kundemerke--ny"}">${k.kjent ? "Tidligere kunde" : "Ny kunde"}</span>
        <a href="mailto:${esc(h.epost)}">${esc(h.epost)}</a>
        ${h.telefon ? `<a href="tel:${esc(h.telefon.replace(/\s/g, ""))}">${esc(h.telefon)}</a>` : ""}
        <p class="sak__historikk">${k.linje}</p>
      </div>
      ${!full ? `<span class="sak__status status status--${h.status}">${esc(STATUS[h.status])}</span>` : ""}
      ${h.tekst ? `<blockquote class="sak__sitat"><cite>Hva vil du snakke om?</cite><p>«${esc(h.tekst)}»</p></blockquote>` : ""}
      ${h.melding && h.status !== "venter" ? `<p class="sak__svar"><b>Ditt svar</b>«${esc(h.melding)}»</p>` : ""}
      ${full ? `<div class="sak__bunn">
        ${h.status === "foreslatt" ? `<details class="sak__melding"${utkast[h.id] ? " open" : ""}><summary>${PLUSS}Skriv en melding til ${esc(fornavn(h))}</summary>
          <div class="felt"><label class="sr" for="m-${h.id}">Melding til ${esc(h.navn)} (valgfritt, sendes med bekreftelsen)</label>
          <textarea id="m-${h.id}" data-melding="${h.id}" rows="3" placeholder="Valgfritt. Sendes sammen med bekreftelsen.">${esc(utkast[h.id] || "")}</textarea></div></details>` : ""}
        <div class="sak__knapper" role="group" aria-label="Svar til ${esc(h.navn)}">${knapper(h)}</div>
      </div>` : ""}
    </article>`;
  }

  // ---------- tegning ----------
  function tegn() {
    const s = A.hent();
    const venter = s.henvendelser.filter((h) => h.status === "venter").sort((a, b) => a.opprettet.localeCompare(b.opprettet));
    const foreslatt = s.henvendelser.filter((h) => h.status === "foreslatt").sort((a, b) => (a.tid.dato + a.tid.tid).localeCompare(b.tid.dato + b.tid.tid));
    const ant = $("#ant-svar");
    ant.textContent = venter.length + foreslatt.length;
    ant.toggleAttribute("data-null", !(venter.length + foreslatt.length));
    const deler = [];
    if (venter.length) deler.push(`${venter.length} ${venter.length === 1 ? "ny henvendelse venter" : "nye henvendelser venter"} på svar`);
    if (foreslatt.length) deler.push(`${foreslatt.length} med foreslått tid som du bekrefter når den er avtalt`);
    $("#admin-ingress").textContent = deler.length ? A.stor(deler.join(", og ")) + ". Kundene er lovet svar innen én arbeidsdag." : "Ingenting venter. Alt er besvart.";
    const del = (t, liste) => liste.length ? `<h2 class="saker__t">${t}</h2>${liste.map((h) => sakHtml(s, h)).join("")}` : "";
    $("#svar-liste").innerHTML = venter.length + foreslatt.length
      ? del("Nye", venter) + del("Tid foreslått", foreslatt)
      : `<div class="tomt"><p class="h3" id="tomt-t" tabindex="-1">Alt er besvart.</p><p>Nye henvendelser fra «Book meg» dukker opp her.</p><a class="lenkeknapp" href="../book/">Åpne «Book meg»</a></div>`;
    tegnAvtalt(s);
    tegnAlle(s);
  }
  function tegnAvtalt(s) {
    const i = A.iso(A.idag());
    const liste = s.henvendelser.filter((h) => h.status === "bekreftet" && h.tid && h.tid.dato >= i).sort((a, b) => (a.tid.dato + a.tid.tid).localeCompare(b.tid.dato + b.tid.tid));
    $("#avtalt-liste").innerHTML = liste.length ? liste.map((h) => sakHtml(s, h, false)).join("")
      : `<div class="tomt tomt--liten"><p>Ingen avtalte samtaler fremover ennå.</p></div>`;
  }

  // ---------- alle ----------
  let filter = "alle";
  const FILTER = ["alle", "venter", "foreslatt", "bekreftet", "avslatt"];
  function tegnAlle(s) {
    const ant = (st) => st === "alle" ? s.henvendelser.length : s.henvendelser.filter((h) => h.status === st).length;
    $("#filter").innerHTML = FILTER.map((st) => `<button type="button" data-filter="${st}" aria-pressed="${st === filter}">${st === "alle" ? "Alle" : esc(STATUS[st])}<span>${ant(st)}</span></button>`).join("");
    const liste = s.henvendelser.filter((h) => filter === "alle" || h.status === filter).sort((a, b) => (b.oppdatert || b.opprettet).localeCompare(a.oppdatert || a.opprettet));
    $("#alle-liste").innerHTML = liste.length ? liste.map((h) => sakHtml(s, h, false)).join("")
      : `<div class="tomt tomt--liten"><p>Ingen henvendelser med statusen «${esc(STATUS[filter])}».</p></div>`;
  }
  $("#filter").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    A.klikk(b);
    filter = b.dataset.filter;
    tegnAlle(A.hent());
    $(`#filter [data-filter="${filter}"]`).focus();
  });

  // ---------- handlinger ----------
  $("#svar-liste").addEventListener("input", (ev) => {
    const m = ev.target.closest("[data-melding]");
    if (m) utkast[m.dataset.melding] = m.value;
  });
  let angre = null;
  // Kortet glir ut med fjær, lista tegnes på nytt, og kortene under glir opp fra der de sto (FLIP).
  function endreSak(id, fn, melding) {
    let for_;
    A.endre((s) => { const h = s.henvendelser.find((x) => x.id === id); for_ = structuredClone(h); fn(h); h.oppdatert = new Date().toISOString(); });
    delete utkast[id];
    angre = () => A.endre((s) => { const i = s.henvendelser.findIndex((x) => x.id === id); s.henvendelser[i] = for_; });
    const liste = $("#svar-liste");
    const kort = $(`.sak[data-id="${id}"]`, liste);
    const rekkef = $$(".sak", liste).map((x) => x.dataset.id);
    const nesteId = rekkef[rekkef.indexOf(id) + 1] || rekkef[rekkef.indexOf(id) - 1];
    const ferdig = () => {
      const for_pos = new Map($$(".sak", liste).map((x) => [x.dataset.id, x.getBoundingClientRect().top]));
      tegn();
      if (!A.rolig()) $$(".sak", liste).forEach((x) => {
        const dy = (for_pos.get(x.dataset.id) ?? 0) - x.getBoundingClientRect().top;
        if (!dy || !for_pos.has(x.dataset.id) || x.dataset.id === id) return;
        A.fjaer({ fra: dy, til: 0, respons: 0.42, ved: (v) => { x.style.transform = v ? `translate3d(0,${v.toFixed(1)}px,0)` : ""; } });
      });
      const neste = nesteId && $(`#sak-${nesteId}`, liste);
      (neste || $(`#sak-${id}`, liste) || $("#tomt-t") || $("#admin-t")).focus({ preventScroll: true });
      toast(melding, true);
    };
    if (kort && !A.rolig()) {
      kort.style.pointerEvents = "none";
      const hoyde = kort.offsetHeight;
      A.fjaer({ fra: 0, til: 1, respons: 0.3, ved: (p) => {
        kort.style.opacity = Math.max(0, 1 - p * 1.3).toFixed(3);
        kort.style.transform = `translate3d(${(p * 32).toFixed(1)}px,0,0)`;
        kort.style.marginBottom = `${(-(hoyde + 16) * Math.max(0, p - 0.35) / 0.65).toFixed(1)}px`;
      }, ferdig });
    } else ferdig();
  }
  $("#svar-liste").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-gjor]");
    if (!b) return;
    A.klikk(b);
    const id = b.closest(".sak").dataset.id;
    const h = finn(id);
    const melding = (utkast[id] || "").trim();
    if (b.dataset.gjor === "bekreft") {
      endreSak(id, (x) => { x.status = "bekreftet"; if (melding) x.melding = melding; },
        `${fornavn(h)} er bekreftet: ${A.kortTekst(h.tid.dato)} kl. ${h.tid.tid}.`);
    } else apneDialog(b.dataset.gjor, h, b, melding);
  });

  // ---------- dialog: foreslå tid / tid er avtalt / avslå eller henvis (bunnark på mobil) ----------
  const dlg = $("#dialog"), flate = $(".dlg__flate", dlg);
  let dlgSak = null, dlgKilde = null, dlgFjaer = null, dlgPos = 0;
  function settDlg(p) {
    dlgPos = p;
    flate.style.transform = mob() ? `translate3d(0,${((1 - p) * 100).toFixed(2)}%,0)` : `translate3d(0,${((1 - p) * 16).toFixed(2)}px,0) scale(${(0.97 + p * 0.03).toFixed(4)})`;
    flate.style.opacity = Math.min(1, p * 1.4).toFixed(3);
  }
  // Starter alltid fra der flaten er nå, så åpning og lukking kan avbryte hverandre
  function animerDlg(til, ferdig) {
    dlgFjaer?.stopp();
    if (A.rolig()) { flate.style.transform = ""; flate.style.opacity = ""; dlgPos = til; ferdig && ferdig(); return; }
    dlgFjaer = A.fjaer({ fra: dlgPos, til, respons: til ? 0.36 : 0.28, ved: settDlg, ferdig });
  }
  function apneDialog(type, h, kilde, melding = "") {
    dlgSak = h; dlgKilde = kilde;
    dlg.dataset.type = type;
    const avsla = type === "avsla";
    $("#dlg-t").textContent = avsla ? `Avslå eller henvis ${h.navn}` : type === "bekreft-ny" ? `Bekreft tiden dere har avtalt med ${h.navn}` : `Foreslå en tid til ${h.navn}`;
    $("#dlg-hva").textContent = `${h.gjelder ? A.tjNavn(h.gjelder) + ". " : ""}${onske(h)}${h.status === "foreslatt" ? ` Du har foreslått ${smaa(tidLinje(h.tid))}.` : ""}`;
    $("#dlg-tid").hidden = avsla;
    $("#dlg-feil").textContent = "";
    $("#dlg-valgfritt").hidden = avsla;
    $("#dlg-melding").value = melding;
    $("#dlg-melding").removeAttribute("aria-invalid");
    $("#dlg-melding").placeholder = avsla ? "For eksempel: Dette passer bedre for en kollega av meg, Kari i Eksempel Rådgivning. Hun har sagt ja til at du tar kontakt."
      : type === "bekreft-ny" ? "For eksempel: Hyggelig å snakke med deg. Da ses vi på torsdag." : "For eksempel: Passer torsdag kl. 10? Da kan vi ta en kaffe.";
    $("#dlg-ok span").textContent = avsla ? "Send svar" : type === "bekreft-ny" ? "Bekreft" : "Send forslag";
    $("#dlg-ok").className = "knapp knapp--" + (avsla ? "fare" : "primar");
    if (!avsla) {
      const min = A.hverdag(1);
      $("#dlg-dato").min = min;
      $("#dlg-dato").value = h.tid?.dato && h.tid.dato >= min ? h.tid.dato : A.hverdag(2);
      $("#dlg-klokke").value = h.tid?.tid || (h.nar === "ettermiddag" ? "13:00" : "10:00");
      $("#dlg-hvor").value = h.tid?.hvor || (h.hvor === "kaffe" ? "kaffe" : "digitalt");
    }
    if (!dlg.open) { dlg.showModal(); if (!A.rolig() && (!dlgFjaer || dlgFjaer.stoppet)) settDlg(0); }
    animerDlg(1);
    (avsla ? $("#dlg-melding") : $("#dlg-dato")).focus();
  }
  function lukkDialog() {
    if (!dlg.open) return;
    animerDlg(0, () => { dlg.close(); });
  }
  $("#dlg-avbryt").addEventListener("click", lukkDialog);
  dlg.addEventListener("cancel", (ev) => { ev.preventDefault(); lukkDialog(); });
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) lukkDialog(); });
  dlg.addEventListener("close", () => { if (dlgKilde && document.contains(dlgKilde)) dlgKilde.focus(); });
  $("#dlg-skjema").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const melding = $("#dlg-melding").value.trim();
    const h = dlgSak, type = dlg.dataset.type;
    const sett = (x) => { if (melding) x.melding = melding; else delete x.melding; };
    let gjor;
    if (type === "avsla") {
      if (!melding) {
        $("#dlg-feil").textContent = "Skriv en kort melding, for eksempel hvem du henviser til.";
        $("#dlg-melding").setAttribute("aria-invalid", "true");
        A.klikk(); $("#dlg-melding").focus();
        return;
      }
      gjor = () => endreSak(h.id, (x) => { x.status = "avslatt"; sett(x); }, `Svaret til ${fornavn(h)} er sendt.`);
    } else {
      const dato = $("#dlg-dato").value, tid = $("#dlg-klokke").value, hvor = $("#dlg-hvor").value;
      if (!dato || !tid || dato < $("#dlg-dato").min) {
        $("#dlg-feil").textContent = `Velg en dato fra ${A.kortTekst($("#dlg-dato").min)} og et klokkeslett.`;
        A.klikk(); $("#dlg-dato").focus();
        return;
      }
      const ny = type === "bekreft-ny";
      gjor = () => endreSak(h.id, (x) => { x.status = ny ? "bekreftet" : "foreslatt"; x.tid = { dato, tid, hvor }; sett(x); },
        ny ? `${fornavn(h)} er bekreftet: ${A.kortTekst(dato)} kl. ${tid}.` : `Tid er foreslått til ${fornavn(h)}: ${A.kortTekst(dato)} kl. ${tid}.`);
    }
    dlgKilde = null;
    animerDlg(0, () => { dlg.close(); gjor(); });
  });

  // ---------- melding nederst, med Angre ----------
  let toastTid;
  function toast(tekst, kanAngre) {
    const t = $("#toast");
    $("#toast-tekst").textContent = tekst;
    $("#toast-angre").hidden = !kanAngre;
    t.hidden = false;
    t.classList.remove("er-synlig"); void t.offsetWidth; t.classList.add("er-synlig");
    clearTimeout(toastTid);
    toastTid = setTimeout(() => { t.classList.remove("er-synlig"); setTimeout(() => { t.hidden = true; }, 300); }, kanAngre ? 8000 : 4000);
  }
  $("#toast-angre").addEventListener("click", () => {
    if (!angre) return;
    angre(); angre = null; tegn(); toast("Angret.");
    $("#svar-liste .sak__nar")?.focus();
  });

  $("#nullstill").addEventListener("click", () => {
    if (!confirm("Tilbakestille demoen? Alle henvendelser settes tilbake til eksemplene.")) return;
    A.nullstill(); for (const k in utkast) delete utkast[k]; tegn(); toast("Demoen er tilbakestilt.");
  });

  // Ny henvendelse fra «Book meg» i en annen fane: oppdater uten å miste fokus i et skrivefelt
  const oppdater = () => { if (!admin.hidden && !dlg.open && !document.activeElement?.matches("textarea")) tegn(); };
  addEventListener("storage", (ev) => { if (ev.key === A.NOKKEL) oppdater(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) oppdater(); });

  if (apen) lasOpp(); else pinFelt.focus();
})();
