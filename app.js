/* Andrea Hvattum, demo: meny, rolig inngang ved rulling, kaffekoppen og kontaktskjema som ikke sender. */
(() => {
  const topp = document.querySelector(".topp");

  // Kant under toppen når siden er rullet (IntersectionObserver, ikke scroll-lytter)
  const vakt = document.createElement("div");
  vakt.style.cssText = "position:absolute;top:0;height:1px;width:1px";
  document.body.prepend(vakt);
  new IntersectionObserver(([x]) => topp.classList.toggle("er-rullet", !x.isIntersecting)).observe(vakt);

  // Mobilmeny
  const knapp = document.querySelector(".topp__meny");
  const meny = document.getElementById("mobilmeny");
  const lukk = () => {
    knapp.setAttribute("aria-expanded", "false");
    knapp.setAttribute("aria-label", "Åpne meny");
    meny.classList.remove("er-apen");
    document.body.style.overflow = "";
    meny.hidden = true;
  };
  knapp.addEventListener("click", () => {
    if (knapp.getAttribute("aria-expanded") === "true") return lukk();
    meny.hidden = false;
    knapp.setAttribute("aria-expanded", "true");
    knapp.setAttribute("aria-label", "Lukk meny");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => meny.classList.add("er-apen"));
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !meny.hidden) { lukk(); knapp.focus(); } });
  matchMedia("(min-width: 961px)").addEventListener("change", (m) => { if (m.matches) lukk(); });

  // Inngang ved rulling
  const vis = document.querySelectorAll(".vis");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((rader) => {
      for (const r of rader) if (r.isIntersecting) { r.target.classList.add("er-synlig"); io.unobserve(r.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    vis.forEach((el) => io.observe(el));
  } else {
    vis.forEach((el) => el.classList.add("er-synlig"));
  }

  // Kaffekoppen fylles når den kommer inn i bildet (én gang). Uten JS eller ved redusert bevegelse står den full.
  const kopper = document.querySelectorAll(".kopp");
  if ("IntersectionObserver" in window) {
    const ko = new IntersectionObserver((rader) => {
      for (const r of rader) if (r.isIntersecting) { r.target.classList.add("er-i-gang"); ko.unobserve(r.target); }
    }, { threshold: 0.6 });
    kopper.forEach((k) => ko.observe(k));
  }

  // Pauseknapp for logoraden som glir
  document.querySelectorAll(".kunder__pause").forEach((b) => b.addEventListener("click", () => {
    const pauset = b.closest(".kunder").classList.toggle("er-pauset");
    b.setAttribute("aria-pressed", String(pauset));
    b.textContent = pauset ? "Spill av" : "Pause";
  }));

  // Kontaktskjema: sjekker feltene og viser en rolig bekreftelse. Ingenting sendes.
  const skjema = document.getElementById("skjema");
  if (skjema) {
    const krav = {
      navn: (v) => v.trim() ? "" : "Skriv navnet ditt.",
      epost: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Skriv en gyldig e-postadresse, for eksempel navn@firma.no.",
      melding: (v) => v.trim() ? "" : "Skriv noen ord om hva du står i.",
    };
    const sjekk = (id) => {
      const felt = document.getElementById(id);
      const feil = krav[id](felt.value);
      felt.setAttribute("aria-invalid", feil ? "true" : "false");
      if (feil) felt.setAttribute("aria-describedby", id + "-feil"); else felt.removeAttribute("aria-describedby");
      document.getElementById(id + "-feil").textContent = feil;
      return !feil;
    };
    Object.keys(krav).forEach((id) => {
      const felt = document.getElementById(id);
      felt.addEventListener("blur", () => { if (felt.value) sjekk(id); });
      // fjern feilen mens man skriver, så knappen ikke flytter seg når man trykker Send
      felt.addEventListener("input", () => { if (felt.getAttribute("aria-invalid") === "true") sjekk(id); });
    });
    skjema.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const ugyldige = Object.keys(krav).filter((id) => !sjekk(id));
      if (ugyldige.length) { document.getElementById(ugyldige[0]).focus(); return; }
      const takk = document.getElementById("takk");
      const fornavn = document.getElementById("navn").value.trim().split(/\s+/)[0];
      takk.querySelector("h2").textContent = `Takk, ${fornavn}. Meldingen er klar.`;
      skjema.hidden = true;
      takk.hidden = false;
      takk.focus();
    });
  }
})();
