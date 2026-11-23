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

    const firstInput = form.querySelector("input[type=text], input[type=number]");
    if (firstInput && window.innerWidth > 680) firstInput.focus();
  }

  function renderStep(step, wrap) {
    wrap.appendChild(el("h2", {}, step.title));
    if (step.subtitle) wrap.appendChild(el("p", { class: "sub" }, step.subtitle));
    const body = el("div", { class: "step__body" });
    let hasNextButton = false;

    step.fields.forEach((f) => {
      const field = el("div", { class: `field ${f.half ? "field--half" : ""}`, "data-name": f.name });
      const val = state.answers[f.name];

      if (f.type === "choice" || f.type === "multi") {
        if (f.label) field.appendChild(el("label", {}, f.label));
        const box = el("div", { class: `choices ${f.type === "choice" ? "choices--single" : ""} ${f.options.some((o) => o.detail) ? "choices--list" : ""}` });
        f.options.forEach((o) => {
          const selected = f.type === "multi" ? (val || []).includes(o.value) : val === o.value;
          const c = el("button", { type: "button", class: `choice ${selected ? "selected" : ""}` },
            `${o.icon ? `<span class="choice__icon">${ICON(o.icon, 20)}</span>` : ""}<span>${o.label}</span><span class="choice__check">${ICON("check", 14)}</span>`);
          // Doplňujúce pole (napr. výmera balkóna) – rozbalí sa pod možnosťou
          let detailEl = null;
          if (o.detail) {
            const d = o.detail;
            detailEl = el("div", { class: `field choice-detail ${selected ? "open" : ""}`, "data-name": d.name },
              `<div><label for="${d.name}">${d.label}</label>
               <div class="input-unit"><input id="${d.name}" type="number" inputmode="decimal" min="${d.min ?? ""}" max="${d.max ?? ""}" placeholder="${d.placeholder || ""}" /><span>m²</span></div>
               <div class="err">Zadajte výmeru</div></div>`);
            const inp = detailEl.querySelector("input");
            if (state.answers[d.name] != null) inp.value = state.answers[d.name];
            inp.oninput = () => { state.answers[d.name] = inp.value === "" ? null : Number(inp.value); detailEl.classList.remove("invalid"); };
          }
          c.onclick = () => {
            if (f.type === "multi") {
              const arr = new Set(state.answers[f.name] || []);
              arr.has(o.value) ? arr.delete(o.value) : arr.add(o.value);
              state.answers[f.name] = [...arr];
              c.classList.toggle("selected");
              if (detailEl) {
                const open = arr.has(o.value);
                detailEl.classList.toggle("open", open);
                if (open) setTimeout(() => detailEl.querySelector("input").focus(), 250);
                else { delete state.answers[o.detail.name]; detailEl.querySelector("input").value = ""; detailEl.classList.remove("invalid"); }
              }
            } else {
              state.answers[f.name] = o.value;
              box.querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
              c.classList.add("selected");
              field.classList.remove("invalid");
              if (f.autoNext && step.fields.length === 1) setTimeout(next, 220);
            }
          };
          box.appendChild(c);
          if (detailEl) box.appendChild(detailEl);
        });
        field.appendChild(box);
        if (!(f.autoNext && step.fields.length === 1)) hasNextButton = true;
      } else if (f.type === "select") {
        field.appendChild(el("label", { id: `${f.name}-label` }, f.label));
        field.appendChild(customSelect(f, val, (v, o) => {
          state.answers[f.name] = v;
          field.classList.remove("invalid");
          // príklad v závislom poli (napr. mesto podľa kraja)
          if (o.city) document.querySelectorAll(`[data-ph-from="${f.name}"]`).forEach((i) => (i.placeholder = `napr. ${o.city}`));
        }));
        hasNextButton = true;
      } else if (f.type === "toggle") {
        const l = el("label", { class: "switch-row" },
          `<span class="switch-row__text"><strong>${f.label}</strong>${f.sub ? `<small>${f.sub}</small>` : ""}</span>
           <span class="switch"><input type="checkbox" role="switch" ${val ? "checked" : ""}/><span class="switch__track"><span class="switch__thumb"></span></span></span>`);
        l.querySelector("input").onchange = (e) => (state.answers[f.name] = e.target.checked);
        field.appendChild(l);
        hasNextButton = true;
      } else {
        field.appendChild(el("label", { for: f.name }, f.label));
        let ph = f.placeholder || "";
        if (f.placeholderFrom) {
          const src = step.fields.find((x) => x.name === f.placeholderFrom);
          const chosen = src?.options.find((o) => o.value === state.answers[f.placeholderFrom]);
          if (chosen?.city) ph = `napr. ${chosen.city}`;
        }
        const i = el("input", { id: f.name, name: f.name, type: f.type, placeholder: ph });
        if (f.placeholderFrom) i.dataset.phFrom = f.placeholderFrom;
        if (f.type === "number") { i.inputMode = "numeric"; if (f.min != null) i.min = f.min; if (f.max != null) i.max = f.max; }
        if (val != null) i.value = val;
        i.oninput = () => { state.answers[f.name] = f.type === "number" ? (i.value === "" ? null : Number(i.value)) : i.value.trim(); field.classList.remove("invalid"); };
        field.appendChild(i);
        hasNextButton = true;
      }
      if (f.hint) field.appendChild(el("div", { class: "hint" }, f.hint));
      field.appendChild(el("div", { class: "err" }, "Prosím, vyplňte toto pole"));
      body.appendChild(field);
    });

    wrap.appendChild(body);
    if (hasNextButton) wrap.appendChild(el("button", { type: "submit", class: "btn btn--primary" }, `Pokračovať ${ICON("arrowRight", 18)}`));
  }

  // ---------- Vlastný selectbox v grafike wizarda ----------
  function customSelect(f, val, onPick) {
    const wrap = el("div", { class: "cselect" });
    const current = f.options.find((o) => o.value === val);
    const trigger = el("button", { type: "button", class: `cselect__trigger ${current ? "" : "empty"}`, id: f.name,
      "aria-haspopup": "listbox", "aria-expanded": "false", "aria-labelledby": `${f.name}-label ${f.name}` },
      `<span class="cselect__value">${current ? current.label : "Vyberte…"}</span><span class="cselect__chev">${ICON("chevron", 18)}</span>`);
    const list = el("ul", { class: "cselect__list", role: "listbox", tabindex: "-1" });
    let active = Math.max(0, f.options.indexOf(current));

    f.options.forEach((o, i) => {
      const li = el("li", { role: "option", class: `cselect__opt ${o === current ? "selected" : ""}`, "aria-selected": o === current ? "true" : "false" },
        `<span>${o.label}</span><span class="cselect__check">${ICON("check", 16)}</span>`);
      li.onmouseenter = () => setActive(i);
      li.onclick = () => pick(i);
      list.appendChild(li);
    });

    const items = () => [...list.children];
    function setActive(i) {
      active = (i + f.options.length) % f.options.length;
      items().forEach((li, j) => li.classList.toggle("active", j === active));
      items()[active].scrollIntoView({ block: "nearest" });
    }
    function open() {
      document.querySelectorAll(".cselect.open").forEach((x) => x !== wrap && x.classList.remove("open"));
      wrap.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      setActive(active);
    }
    function close(focus = true) {
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      if (focus) trigger.focus();
    }
    function pick(i) {
      const o = f.options[i];
      items().forEach((li, j) => { li.classList.toggle("selected", j === i); li.setAttribute("aria-selected", j === i); });
      trigger.querySelector(".cselect__value").textContent = o.label;
      trigger.classList.remove("empty");
      active = i;
      onPick(o.value, o);
      close();
    }

    trigger.onclick = () => (wrap.classList.contains("open") ? close() : open());
    trigger.onkeydown = (e) => {
      const isOpen = wrap.classList.contains("open");
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        if (!isOpen) return open();
        setActive(active + (e.key === "ArrowDown" ? 1 : -1));
      } else if ((e.key === "Enter" || e.key === " ") && isOpen) {
        e.preventDefault(); pick(active);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault(); close();
      } else if (e.key === "Tab" && isOpen) {
        close(false);
      }
    };
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(false); });

    wrap.append(trigger, list);
    return wrap;
  }

  function renderContact(wrap) {
    wrap.innerHTML = `
      <h2>Odhad je pripravený</h2>
      <p class="sub">Kam vám ho máme poslať? K odhadu vám zdarma odporučíme aj overeného makléra z vašej lokality.</p>
      <div class="step__body">
        <div class="field" data-name="meno"><label for="meno">Meno a priezvisko</label><input id="meno" type="text" autocomplete="name" /><div class="err">Zadajte meno</div></div>
        <div class="field" data-name="email"><label for="email">E-mail</label><input id="email" type="email" autocomplete="email" /><div class="err">Zadajte platný e-mail</div></div>
        <div class="field" data-name="telefon"><label for="telefon">Telefón</label><input id="telefon" type="tel" autocomplete="tel" placeholder="+421 9xx xxx xxx" /><div class="err">Zadajte platné telefónne číslo</div></div>
        <label class="consent" data-name="gdpr"><input type="checkbox" id="gdpr" /> <span>Súhlasím so <a href="#" target="_blank">spracovaním osobných údajov</a> za účelom zaslania odhadu a odporučenia realitného makléra.</span></label>
      </div>
      <div class="teaser">
        <div class="teaser__label">Vaša odhadovaná cena</div>
        <div class="teaser__blur" aria-hidden="true">${fmt(187500) /* fiktívne číslo – skutočný odhad nie je v DOM pred odoslaním */}</div>
        <div class="teaser__lock">${ICON("lock", 14)} Zobrazí sa hneď po odoslaní</div>
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
      let msg = "Prosím, vyplňte toto pole";
      if (!bad && f.type === "number" && v != null) {
        bad = (f.min != null && v < f.min) || (f.max != null && v > f.max);
        if (bad) msg = `Zadajte hodnotu od ${f.min} do ${f.max}`;
      }
      if (!bad && f.maxFrom && v != null && state.answers[f.maxFrom] != null && v > state.answers[f.maxFrom]) {
        bad = true; msg = f.maxFromError || "Neplatná hodnota";
      }
      const fieldEl = document.querySelector(`.field[data-name="${f.name}"]`);
      if (fieldEl) { fieldEl.classList.toggle("invalid", !!bad); const er = fieldEl.querySelector(":scope > .err"); if (er) er.textContent = msg; }
      if (bad) ok = false;
      // doplňujúce polia pri označených možnostiach
      (f.options || []).forEach((o) => {
        const d = o.detail;
        if (!d) return;
        const chosen = Array.isArray(v) ? v.includes(o.value) : v === o.value;
        const dv = state.answers[d.name];
        const dBad = chosen && ((d.required && (dv == null || dv === "")) || (dv != null && ((d.min != null && dv < d.min) || (d.max != null && dv > d.max))));
        document.querySelector(`.field[data-name="${d.name}"]`)?.classList.toggle("invalid", !!dBad);
        if (dBad) ok = false;
      });
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
    let area = 0, landArea = 0, extraArea = 0;

    WIZ[state.type].steps.forEach((s) =>
      s.fields.forEach((f) => {
        const v = a[f.name];
        if (f.area) area = Number(v) || 0;
        (f.options || []).forEach((o) => {
          const chosen = Array.isArray(v) ? v.includes(o.value) : v === o.value;
          if (chosen && o.detail?.areaWeight) extraArea += (Number(a[o.detail.name]) || 0) * o.detail.areaWeight;
        });
        if (f.landArea) landArea = Number(v) || 0;
        if (f.type === "toggle" && v && f.multiplier) mult *= f.multiplier;
        if (f.options) {
          const vals = Array.isArray(v) ? v : [v];
          f.options.forEach((o) => { if (vals.includes(o.value) && o.multiplier) mult *= o.multiplier; });
        }
      })
    );

    let mid = ppm * (area + extraArea) * mult;
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
    const meno = (lead.contact.meno || "").split(" ")[0];
    $("#stepForm").innerHTML = `
      <div class="step result">
        <div class="result__ok">${ICON("check", 28)}</div>
        <div class="result__label">Odhadovaná trhová cena</div>
        <div class="result__price">${fmt(est.mid)}</div>
        <span class="result__ppm">cca ${fmt(est.ppm)} / m²</span>

        <div class="range">
          <div class="range__bar"><span class="range__marker"></span></div>
          <div class="range__labels">
            <div><small>Spodná hranica</small><strong>${fmt(est.low)}</strong></div>
            <div class="range__mid"><small>Najpravdepodobnejšia</small><strong>${fmt(est.mid)}</strong></div>
            <div class="range__high"><small>Horná hranica</small><strong>${fmt(est.high)}</strong></div>
          </div>
        </div>

        <div class="result__box">
          <div class="result__box-icon">${ICON(sell ? "userCheck" : "mail", 22)}</div>
          <div>
            <h3>${sell ? `${meno ? meno + ", o" : "O"}zve sa vám náš realitný špecialista` : "Odhad sme poslali na váš e-mail"}</h3>
            <p>${sell
              ? "Online odhad je dobrý začiatok. Presnú cenu však najlepšie určí skúsený špecialista z vášho okolia, ktorý nehnuteľnosť uvidí naživo. Do 24 hodín sa vám ozve, zdarma s vami prejde presnú cenu a poradí, ako postupovať pri predaji. Bez záväzkov, rozhodnutie je vždy na vás."
              : `Na <strong>${lead.contact.email}</strong> sme poslali odhad. Keď budete chcieť poznať presnú cenu, náš špecialista vám ju zdarma pomôže určiť.`}</p>
          </div>
        </div>
        <p class="result__note">Online odhad je orientačný a vychádza z priemerných cien v regióne.</p>
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
