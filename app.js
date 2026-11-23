(() => {
  const CFG = window.APP_CONFIG;
  const WIZ = window.WIZARDS;

  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, html = "") => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => (k === "class" ? (n.className = v) : n.setAttribute(k, v)));
    if (html) n.innerHTML = html;
    return n;
  };
  const fmt = (n) => new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 }).format(n) + " €";
  const roundTo = (n, step = 1000) => Math.round(n / step) * step;

  const CONTACT_STEP = { id: "__contact" };
  const state = { type: null, steps: [], index: 0, answers: {} };

  // UTM / zdroj leadu
  const params = new URLSearchParams(location.search);
  const source = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    referrer: document.referrer || null,
  };

  // ---------- Výber typu ----------
  const typesEl = $("#types");
  Object.entries(WIZ).forEach(([key, w]) => {
    const b = el("button", { class: "type-card", type: "button" },
      `<span class="type-card__icon">${ICON(w.icon, 32)}</span>
       <span class="type-card__label">${w.label}</span>
       <span class="type-card__btn">Oceniť ${w.label.toLowerCase()} ${ICON("arrowRight", 18)}</span>`);
    b.onclick = () => startWizard(key);
    typesEl.appendChild(b);
  });

  function startWizard(type) {
    state.type = type;
    state.steps = [...WIZ[type].steps, CONTACT_STEP];
    state.index = 0;
    state.answers = {};
    $("#wizType").innerHTML = `${ICON(WIZ[type].icon, 18)} Ocenenie: ${WIZ[type].label}`;
    $("#wizard").classList.remove("hidden");
    render();
    $("#wizard").scrollIntoView({ behavior: "smooth", block: "start" });
    track("wizard_start", { type });
  }

  $("#backBtn").onclick = () => {
    if (state.index === 0) {
      $("#wizard").classList.add("hidden");
      $("#start").scrollIntoView({ behavior: "smooth" });
    } else {
      state.index--;
      render();
    }
  };

  // ---------- Render ----------
  function render() {
    const form = $("#stepForm");
    form.innerHTML = "";
    const step = state.steps[state.index];
    $("#progressBar").style.width = `${((state.index + 1) / (state.steps.length + 1)) * 100}%`;
    $("#backBtn").classList.remove("hidden");

    const wrap = el("div", { class: "step" });
    if (step === CONTACT_STEP) renderContact(wrap);
    else renderStep(step, wrap);
    form.appendChild(wrap);

    const firstInput = form.querySelector("input[type=text], input[type=number], select");
    if (firstInput && window.innerWidth > 680) firstInput.focus();
  }

  function renderStep(step, wrap) {
    wrap.appendChild(el("h2", {}, step.title));
    if (step.subtitle) wrap.appendChild(el("p", { class: "sub" }, step.subtitle));
    const body = el("div", { class: "step__body" });
    let hasNextButton = false;

    step.fields.forEach((f) => {
      const field = el("div", { class: "field", "data-name": f.name });
      const val = state.answers[f.name];

      if (f.type === "choice" || f.type === "multi") {
        if (f.label) field.appendChild(el("label", {}, f.label));
        const box = el("div", { class: `choices ${f.type === "choice" ? "choices--single" : ""}` });
        f.options.forEach((o) => {
          const selected = f.type === "multi" ? (val || []).includes(o.value) : val === o.value;
          const c = el("button", { type: "button", class: `choice ${selected ? "selected" : ""}` },
            `${o.icon ? `<span class="choice__icon">${ICON(o.icon, 20)}</span>` : ""}<span>${o.label}</span><span class="choice__check">${ICON("check", 14)}</span>`);
          c.onclick = () => {
            if (f.type === "multi") {
              const arr = new Set(state.answers[f.name] || []);
              arr.has(o.value) ? arr.delete(o.value) : arr.add(o.value);
              state.answers[f.name] = [...arr];
              c.classList.toggle("selected");
            } else {
              state.answers[f.name] = o.value;
              box.querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
              c.classList.add("selected");
              field.classList.remove("invalid");
              if (f.autoNext && step.fields.length === 1) setTimeout(next, 220);
            }
          };
          box.appendChild(c);
        });
        field.appendChild(box);
        if (!(f.autoNext && step.fields.length === 1)) hasNextButton = true;
      } else if (f.type === "select") {
        field.appendChild(el("label", { for: f.name }, f.label));
        const s = el("select", { id: f.name, name: f.name });
        const ph = el("option", { value: "", disabled: "", selected: "" }, "Vyberte…");
        s.appendChild(ph);
        f.options.forEach((o) => {
          const opt = el("option", { value: o.value }, o.label);
          if (val === o.value) opt.selected = true;
          s.appendChild(opt);
        });
        s.classList.toggle("empty", !s.value);
        s.onchange = () => { state.answers[f.name] = s.value; s.classList.toggle("empty", !s.value); field.classList.remove("invalid"); };
        field.appendChild(s);
        hasNextButton = true;
      } else if (f.type === "toggle") {
        const l = el("label", { class: "toggle" }, `<input type="checkbox" ${val ? "checked" : ""}/> ${f.label}`);
        l.querySelector("input").onchange = (e) => (state.answers[f.name] = e.target.checked);
        field.appendChild(l);
        hasNextButton = true;
      } else {
        field.appendChild(el("label", { for: f.name }, f.label));
        const i = el("input", { id: f.name, name: f.name, type: f.type, placeholder: f.placeholder || "" });
        if (f.type === "number") { i.inputMode = "numeric"; if (f.min != null) i.min = f.min; if (f.max != null) i.max = f.max; }
        if (val != null) i.value = val;
        i.oninput = () => { state.answers[f.name] = f.type === "number" ? (i.value === "" ? null : Number(i.value)) : i.value.trim(); field.classList.remove("invalid"); };
        field.appendChild(i);
        hasNextButton = true;
      }
      field.appendChild(el("div", { class: "err" }, "Prosím, vyplňte toto pole"));
      body.appendChild(field);
    });

    wrap.appendChild(body);
    if (hasNextButton) wrap.appendChild(el("button", { type: "submit", class: "btn btn--primary" }, `Pokračovať ${ICON("arrowRight", 18)}`));
  }

  function renderContact(wrap) {
    wrap.innerHTML = `
      <h2>Odhad je pripravený</h2>
      <p class="sub">Kam vám ho máme poslať? K odhadu vám zdarma odporučíme aj overeného makléra z vašej lokality.</p>
      <div class="teaser"><span>Odhadovaná cena:</span><span class="teaser__blur">${fmt(187500) /* fiktívne číslo – skutočný odhad nie je v DOM pred odoslaním */}</span></div>
      <div class="step__body">
        <div class="field" data-name="meno"><label for="meno">Meno a priezvisko</label><input id="meno" type="text" autocomplete="name" /><div class="err">Zadajte meno</div></div>
        <div class="field" data-name="email"><label for="email">E-mail</label><input id="email" type="email" autocomplete="email" /><div class="err">Zadajte platný e-mail</div></div>
        <div class="field" data-name="telefon"><label for="telefon">Telefón</label><input id="telefon" type="tel" autocomplete="tel" placeholder="+421 9xx xxx xxx" /><div class="err">Zadajte platné telefónne číslo</div></div>
        <label class="consent" data-name="gdpr"><input type="checkbox" id="gdpr" /> <span>Súhlasím so <a href="#" target="_blank">spracovaním osobných údajov</a> za účelom zaslania odhadu a odporučenia realitného makléra.</span></label>
      </div>
      <button type="submit" class="btn btn--primary" id="submitBtn">Zobraziť odhad ceny</button>`;
    ["meno", "email", "telefon"].forEach((k) => {
      const i = wrap.querySelector(`#${k}`);
      if (state.answers[k]) i.value = state.answers[k];
      i.oninput = () => { state.answers[k] = i.value.trim(); i.closest(".field").classList.remove("invalid"); };
    });
    track("contact_step_view", { type: state.type });
  }

  // ---------- Validácia & navigácia ----------
  function validateStep(step) {
    let ok = true;
    step.fields.forEach((f) => {
      const v = state.answers[f.name];
      let bad = f.required && (v == null || v === "" || (Array.isArray(v) && !v.length));
      if (!bad && f.type === "number" && v != null) bad = (f.min != null && v < f.min) || (f.max != null && v > f.max);
      document.querySelector(`.field[data-name="${f.name}"]`)?.classList.toggle("invalid", !!bad);
      if (bad) ok = false;
    });
    return ok;
  }

  function validateContact() {
    const a = state.answers;
    const checks = {
      meno: (a.meno || "").length >= 3,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email || ""),
      telefon: (a.telefon || "").replace(/[^\d]/g, "").length >= 9,
    };
    let ok = true;
    Object.entries(checks).forEach(([k, pass]) => {
      document.querySelector(`.field[data-name="${k}"]`).classList.toggle("invalid", !pass);
      if (!pass) ok = false;
    });
    const gdpr = $("#gdpr").checked;
    document.querySelector(".consent").classList.toggle("invalid", !gdpr);
    return ok && gdpr;
  }

  function next() {
    const step = state.steps[state.index];
    if (step === CONTACT_STEP) return submitLead();
    if (!validateStep(step)) return;
    track("step_complete", { type: state.type, step: step.id });
    state.index++;
    render();
  }

  $("#stepForm").addEventListener("submit", (e) => { e.preventDefault(); next(); });

  // ---------- Výpočet odhadu ----------
  function estimate() {
    const a = state.answers;
    const prices = CFG.pricePerM2[state.type];
    const ppm = prices[a.kraj] || Object.values(prices)[0];
    let mult = 1;
    let area = 0, landArea = 0;

    WIZ[state.type].steps.forEach((s) =>
      s.fields.forEach((f) => {
        const v = a[f.name];
        if (f.area) area = Number(v) || 0;
        if (f.landArea) landArea = Number(v) || 0;
        if (f.type === "toggle" && v && f.multiplier) mult *= f.multiplier;
        if (f.options) {
          const vals = Array.isArray(v) ? v : [v];
          f.options.forEach((o) => { if (vals.includes(o.value) && o.multiplier) mult *= o.multiplier; });
        }
      })
    );

    let mid = ppm * area * mult;
    // Dom: pripočítaj hodnotu pozemku nad zastavanú plochu (polovičná cena stavebného pozemku)
    if (state.type === "dom" && landArea) {
      const landPpm = CFG.pricePerM2.pozemok[a.kraj] || 50;
      mid += Math.max(0, landArea - area) * landPpm * 0.5;
    }
    const s = CFG.rangeSpread;
    return { mid: roundTo(mid), low: roundTo(mid * (1 - s)), high: roundTo(mid * (1 + s)), ppm: Math.round(mid / (area || 1)) };
  }

  // ---------- Odoslanie leadu ----------
  async function submitLead() {
    if (!validateContact()) return;
    const btn = $("#submitBtn");
    btn.disabled = true;
    btn.textContent = "Počítam odhad…";

    const est = estimate();
    const { meno, email, telefon, ...answers } = state.answers;
    const zamerOpt = ZAMER_OPTIONS().find((o) => o.value === answers.zamer);
    const lead = {
      createdAt: new Date().toISOString(),
      type: state.type,
      contact: { meno, email, telefon },
      answers,
      estimate: est,
      hot: !!zamerOpt?.hot,
      source,
      page: location.href,
    };

    try {
      if (CFG.leadEndpoint) {
        await fetch(CFG.leadEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
      }
    } catch (err) {
      console.error("Lead sa nepodarilo odoslať", err);
    }
    const stored = JSON.parse(localStorage.getItem("leads") || "[]");
    stored.push(lead);
    localStorage.setItem("leads", JSON.stringify(stored));
    console.log("LEAD", lead);
    track("lead_submit", { type: state.type, hot: lead.hot });

    await new Promise((r) => setTimeout(r, 900)); // krátka "výpočtová" pauza pre pocit
    renderResult(est, lead);
  }

  const ZAMER_OPTIONS = () =>
    WIZ[state.type].steps.flatMap((s) => s.fields).find((f) => f.name === "zamer")?.options || [];

  function renderResult(est, lead) {
    $("#progressBar").style.width = "100%";
    $("#backBtn").classList.add("hidden");
    const sell = lead.answers.zamer?.startsWith("predaj");
    $("#stepForm").innerHTML = `
      <div class="step result">
        <div class="result__ok">${ICON("check", 28)}</div>
        <div class="result__label">Odhadovaná trhová cena</div>
        <div class="result__price">${fmt(est.mid)}</div>
        <div class="result__range">Rozpätie ${fmt(est.low)} – ${fmt(est.high)}, cca ${fmt(est.ppm)}/m²</div>
        <div class="result__box">
          <h3>${sell ? ICON("phone", 18) + " Do 24 hodín vám odporučíme makléra" : ICON("mail", 18) + " Odhad sme poslali na váš e-mail"}</h3>
          <p>${sell
            ? "Vyberieme overeného makléra z vašej lokality, ktorý vám zdarma určí presnú cenu po obhliadke a pomôže predať za najvýhodnejšiu cenu na trhu. Rozhodnutie je len na vás."
            : `Na <strong>${lead.contact.email}</strong> sme poslali odhad. Keď sa rozhodnete predávať, odporučíme vám overeného makléra, ktorý predá rýchlo a za najlepšiu cenu.`}</p>
        </div>
        <p class="sub" style="font-size:.85rem">Online odhad je orientačný a vychádza z priemerných cien v regióne.</p>
      </div>`;
  }

  // ---------- Analytics hook (GA4 / Meta Pixel ak sú na stránke) ----------
  function track(event, data = {}) {
    window.dataLayer?.push({ event, ...data });
    window.fbq?.("trackCustom", event, data);
    if (event === "lead_submit") window.fbq?.("track", "Lead");
  }

  // FAQ akordeón
  document.querySelectorAll(".faq__q").forEach((q) =>
    q.addEventListener("click", () => {
      const item = q.closest(".faq__item");
      const open = item.classList.toggle("open");
      q.setAttribute("aria-expanded", open);
    })
  );

  // Mobilná CTA lišta: zobraziť po odscrollovaní z hero, skryť počas wizardu
  const sticky = $("#stickyCta");
  const updateSticky = () => {
    const heroBottom = $("#start").getBoundingClientRect().bottom;
    const wizardOpen = !$("#wizard").classList.contains("hidden");
    sticky.classList.toggle("show", heroBottom < 0 && !wizardOpen);
  };
  addEventListener("scroll", updateSticky, { passive: true });

  // Priamy odkaz na wizard, napr. ?typ=byt (pre reklamy)
  const typParam = params.get("typ");
  if (typParam && WIZ[typParam]) startWizard(typParam);

  hydrateIcons();
  $("#year").textContent = new Date().getFullYear();
})();
