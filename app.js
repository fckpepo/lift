(() => {
  const TZ = "America/Sao_Paulo";
  const STORE_KEY = "lift.v1";
  const D = window.LIFT_DATA;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    tab: "hoje",
    store: loadStore(),
  };

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      return {
        startMonday: parsed.startMonday || null,
        completions: parsed.completions || {},
        lang: parsed.lang === "en" ? "en" : "pt-BR",
      };
    } catch {
      return emptyStore();
    }
  }

  function emptyStore() {
    return { startMonday: null, completions: {}, lang: "pt-BR" };
  }

  function saveStore() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
  }

  function lang() {
    return state.store.lang === "en" ? "en" : "pt-BR";
  }

  function L() {
    return window.LIFT_I18N[lang()];
  }

  function fill(str, map) {
    return String(str).replace(/\{(\w+)\}/g, (_, k) =>
      map[k] === undefined ? "" : map[k]
    );
  }

  function setLang(next) {
    state.store.lang = next === "en" ? "en" : "pt-BR";
    saveStore();
    document.documentElement.lang = lang();
    render();
  }

  function sessionView(key) {
    const base = D.sessions[key];
    const loc = L().sessions[key];
    return {
      ...base,
      title: loc.title,
      tagLabel: loc.tagLabel,
      warmup: loc.warmup,
      notes: loc.notes || [],
      cardio: loc.cardio,
      exercises: (base.exercises || []).map((ex, i) => ({
        ...ex,
        ...(loc.exercises[i] || {}),
      })),
    };
  }

  /* ── dates in São Paulo ── */
  function partsInTZ(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const map = {};
    for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
    return map;
  }

  function todayISO() {
    const p = partsInTZ();
    return `${p.year}-${p.month}-${p.day}`;
  }

  function isoToDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function weekdayMon0(iso) {
    return (isoToDate(iso).getUTCDay() + 6) % 7;
  }

  function mondayOf(iso) {
    const d = isoToDate(iso);
    const mon0 = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - mon0);
    return d.toISOString().slice(0, 10);
  }

  function addDays(iso, n) {
    const d = isoToDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function fmtLong(iso) {
    const tag = lang() === "en" ? "en-US" : "pt-BR";
    return new Intl.DateTimeFormat(tag, {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(isoToDate(iso));
  }

  /* ── plan week ── */
  function planInfo(iso = todayISO()) {
    const start = state.store.startMonday;
    if (!start) {
      return { started: false, planWeek: null, mesoWeek: 1, block: null };
    }
    const thisMon = mondayOf(iso);
    const weeks = Math.round((isoToDate(thisMon) - isoToDate(start)) / 86400000 / 7);
    const planWeek = weeks + 1;
    const mesoWeek = ((planWeek - 1) % 4) + 1;
    const block = Math.floor((planWeek - 1) / 4) + 1;
    return { started: true, planWeek, mesoWeek, block };
  }

  function mesoOf(mesoWeek) {
    return L().meso[mesoWeek - 1];
  }

  function sessionForDate(iso) {
    const mon0 = weekdayMon0(iso);
    if (mon0 >= 5) return null;
    return D.weekdays[mon0];
  }

  function isComplete(iso) {
    return Boolean(state.store.completions[iso]);
  }

  function toggleComplete(iso) {
    const slot = sessionForDate(iso);
    if (!slot) return;
    if (state.store.completions[iso]) {
      delete state.store.completions[iso];
    } else {
      state.store.completions[iso] = {
        key: slot.key,
        at: new Date().toISOString(),
      };
      if (!state.store.startMonday) {
        state.store.startMonday = mondayOf(iso);
      }
    }
    const openDetail = $("#semana-detail")?.dataset.iso;
    saveStore();
    render();
    if (state.tab === "semana" && openDetail) {
      const detail = $("#semana-detail");
      if (detail) {
        detail.dataset.iso = openDetail;
        renderSession(detail, openDetail);
      }
    }
  }

  function resetPlan() {
    if (!confirm(L().ui.resetConfirm)) return;
    const keepLang = lang();
    state.store = emptyStore();
    state.store.lang = keepLang;
    saveStore();
    render();
  }

  function setsFor(ex, mesoWeek) {
    if (ex.cardioItem) {
      if (mesoWeek === 4) return "15 min";
      return ex.reps;
    }
    const n = mesoWeek === 4 ? Math.min(2, ex.sets) : ex.sets;
    return `${n} × ${ex.reps}`;
  }

  function updateChrome() {
    const ui = L().ui;
    const labels = {
      hoje: ui.tabToday,
      semana: ui.tabWeek,
      cardio: ui.tabCardio,
      guia: ui.tabGuide,
    };
    $$(".tab").forEach((btn) => {
      const span = btn.querySelector("span");
      if (span && labels[btn.dataset.tab]) span.textContent = labels[btn.dataset.tab];
    });
    document.documentElement.lang = lang();
  }

  /* ── header ── */
  function renderHeader() {
    const info = planInfo();
    const ui = L().ui;
    const chip = $("#week-chip");
    chip.classList.remove("idle", "deload");
    if (!info.started) {
      chip.classList.add("idle");
      chip.innerHTML = `<span class="w-num">${ui.weekIdle}</span><span class="w-sub">${ui.weekIdleSub}</span>`;
    } else {
      if (info.mesoWeek === 4) chip.classList.add("deload");
      const meso = mesoOf(info.mesoWeek);
      chip.innerHTML = `<span class="w-num">${fill(ui.weekN, { n: info.planWeek })}</span><span class="w-sub">${fill(ui.blockMeso, { b: info.block, name: meso.name })}</span>`;
    }
    const p = D.profile;
    $("#brand-sub").textContent = `${p.weightKg} kg · ${p.heightCm} cm · ~${p.bfPct}% · ${ui.level}`;
  }

  /* ── session view ── */
  function renderSession(container, iso) {
    const slot = sessionForDate(iso);
    const info = planInfo(iso);
    const meso = mesoOf(info.mesoWeek);
    const done = isComplete(iso);
    const isToday = iso === todayISO();
    const ui = L().ui;

    if (!slot) {
      container.innerHTML = `
        <div class="rest">
          <div class="kind-pill kind-rest" style="margin:0 auto 8px">${ui.weekend}</div>
          <h2>${ui.rest}</h2>
          <p>${ui.restBody}</p>
        </div>`;
      return;
    }

    const ses = sessionView(slot.key);
    const headDate = fmtLong(iso);

    let html = `
      <div class="session-head">
        <div>
          <h2 class="session-title">${ses.title}</h2>
          <div class="session-meta">${headDate}${isToday ? ` · ${ui.today}` : ""} · ${ses.minutes || 45} ${ui.min}</div>
        </div>
        <div class="kind-pill kind-${ses.tag}">${ses.tagLabel}</div>
      </div>
      <div class="callout warm">
        <div class="c-label">${ui.warmup}</div>
        <p>${ses.warmup}</p>
      </div>
      <div class="callout amber">
        <div class="c-label">${fill(ui.weekChip, { n: info.started ? info.planWeek : "—", name: meso.name })}</div>
        <p>${meso.liftNote}</p>
      </div>`;

    (ses.notes || []).forEach((n, i) => {
      const isKnee = ses.key.startsWith("lower") && i === 1;
      const label = isKnee ? ui.knees : ui.note;
      html += `<div class="callout ${ses.key === "lower-a" && i === 1 ? "warn" : ""}">
        <div class="c-label">${label}</div>
        <p>${n}</p>
      </div>`;
    });

    if (ses.kind === "cardio") {
      html += renderCardioBlock(meso, ses);
    }

    ses.exercises.forEach((ex, i) => {
      html += `
        <div class="ex-card${ex.knee ? " knee" : ""}" data-ex="${i}">
          <button class="ex-head" type="button">
            <span class="ex-num">${ex.num}</span>
            <div class="ex-info">
              <div class="ex-name">${ex.name}</div>
              <div class="ex-sub">${ex.sub}</div>
            </div>
            <div class="ex-sets">${setsFor(ex, info.mesoWeek)}</div>
            <span class="chev">▼</span>
          </button>
          <div class="ex-body">
            <div class="pills">
              <span class="pill rpe">RPE ${ex.rpe}</span>
              <span class="pill">⏱ ${ex.rest}</span>
              ${ex.knee ? `<span class="pill">${ui.kneePill}</span>` : ""}
            </div>
            <div class="ex-note">${ex.note}</div>
          </div>
        </div>`;
    });

    const cta = done ? ui.doneCta : ui.doCta;
    const hint = info.started ? ui.hintStarted : ui.hintNotStarted;

    html += `
      <div class="complete-wrap">
        <button class="btn-complete${done ? " done" : ""}" type="button" data-complete="${iso}">${cta}</button>
        <p class="complete-hint">${hint}</p>
      </div>`;

    container.innerHTML = html;
  }

  function renderCardioBlock(meso, ses) {
    const c = meso.cardio;
    const ui = L().ui;
    return `
      <div class="zone-box">
        <div class="zl">${ui.yourZ2}</div>
        <div class="zv">${D.profile.z2[0]}–${D.profile.z2[1]}<span style="font-size:16px;color:var(--muted)"> bpm</span></div>
        <p>${ses.cardio.hrNote}</p>
      </div>
      <div class="card">
        <h3>${c.title} · ${c.duration}</h3>
        <p>${c.detail}</p>
      </div>
      <div class="callout">
        <div class="c-label">${ui.machine}</div>
        <p>${ses.notes[1] || ses.notes[0]}</p>
      </div>`;
  }

  /* ── tabs ── */
  function renderHoje() {
    const iso = todayISO();
    const slot = sessionForDate(iso);
    const days = L().weekdays;
    const strip = D.weekdays
      .map((d) => {
        const dayIso = addDays(mondayOf(iso), d.dow - 1);
        const loc = days[d.key];
        const cls = [
          "day-pill",
          slot && slot.key === d.key && weekdayMon0(iso) === d.dow - 1 ? "active today" : "",
          isComplete(dayIso) ? "done" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<div class="${cls}"><span class="d-name">${loc.short}</span><span class="d-tag">${loc.pill}</span></div>`;
      })
      .join("");

    $("#panel-hoje").innerHTML = `<div class="day-strip">${strip}</div><div id="hoje-session"></div>`;
    renderSession($("#hoje-session"), iso);
  }

  function renderSemana() {
    const iso = todayISO();
    const mon = mondayOf(iso);
    const info = planInfo(iso);
    const ui = L().ui;
    const meso = mesoOf(info.mesoWeek);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const dayIso = addDays(mon, i);
      return { iso: dayIso, slot: sessionForDate(dayIso), mon0: i };
    });
    const liftDays = days.filter((d) => d.slot);
    const doneN = liftDays.filter((d) => isComplete(d.iso)).length;
    const pct = Math.round((doneN / 5) * 100);

    const heroTitle = info.started
      ? fill(ui.weekChip, { n: info.planWeek, name: meso.name })
      : ui.planNotStarted;
    const heroSub = info.started
      ? fill(ui.planHero, { b: info.block, note: meso.liftNote })
      : ui.planNotStartedSub;

    const rows = days
      .map((d) => {
        const title = d.slot ? sessionView(d.slot.key).title : ui.restDay;
        const sub = d.slot ? sessionView(d.slot.key).tagLabel : ui.notProgrammed;
        const cls = [
          "week-row",
          d.slot && isComplete(d.iso) ? "done" : "",
          d.iso === iso ? "today" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button class="${cls}" type="button" data-open="${d.iso}">
          <span class="wr-dow">${ui.daysTiny[d.mon0]}</span>
          <div class="wr-main"><div class="wr-title">${title}</div><div class="wr-sub">${sub}</div></div>
          ${d.slot ? '<span class="check"></span>' : ""}
        </button>`;
      })
      .join("");

    $("#panel-semana").innerHTML = `
      <div class="week-hero">
        <h2>${heroTitle}</h2>
        <p>${heroSub}</p>
        <div class="progress-row">
          <div class="bar"><i style="width:${pct}%"></i></div>
          <span class="bar-label">${doneN}/5</span>
        </div>
      </div>
      <div class="week-list">${rows}</div>
      <div id="semana-detail"></div>`;
  }

  function renderCardio() {
    const info = planInfo();
    const meso = mesoOf(info.mesoWeek);
    const ui = L().ui;
    const p = D.profile;
    $("#panel-cardio").innerHTML = `
      <div class="zone-box">
        <div class="zl">${fill(ui.zoneLine, { hr: p.hrMax })}</div>
        <div class="zv">${p.z2[0]}–${p.z2[1]} <span style="font-size:18px;color:var(--muted)">bpm</span></div>
        <p>${fill(ui.zoneMath, { age: p.age, hr: p.hrMax, vo2: p.vo2, target: p.vo2Target })}</p>
      </div>
      <div class="section-label">${ui.thisWeek}</div>
      <div class="card">
        <h3>${meso.cardio.title} · ${meso.cardio.duration}</h3>
        <p>${meso.cardio.detail}</p>
      </div>
      <div class="section-label">${ui.whereItFits}</div>
      <div class="card">
        <p>${ui.cardioWhere1}</p>
        <p style="margin-top:8px">${ui.cardioWhere2}</p>
        <p style="margin-top:8px">${ui.cardioWhere3}</p>
      </div>
      <div class="section-label">${ui.fourWeekBlock}</div>
      ${L()
        .meso.map(
          (m, i) =>
            `<div class="card"><h3>${fill(ui.mesoWeek, { n: i + 1, name: m.name })}</h3><p><strong>${m.cardio.title}</strong> — ${m.cardio.duration}. ${m.cardio.detail}</p></div>`
        )
        .join("")}
      <div class="callout warn">
        <div class="c-label">${ui.knee}</div>
        <p>${ui.kneeCardio}</p>
      </div>`;
  }

  function renderGuia() {
    const standalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const ui = L().ui;
    const current = lang();

    $("#panel-guia").innerHTML = `
      <div class="lang-card">
        <div class="section-label" style="padding:0 0 8px">${ui.sectionLang}</div>
        <div class="lang-switch" role="group" aria-label="${ui.sectionLang}">
          <button type="button" class="lang-btn${current === "pt-BR" ? " on" : ""}" data-lang="pt-BR">PT-BR</button>
          <button type="button" class="lang-btn${current === "en" ? " on" : ""}" data-lang="en">EN</button>
        </div>
        <p class="lang-hint">${ui.langHint}</p>
      </div>
      ${standalone ? "" : `<div class="install"><strong>${ui.installTitle}</strong> ${ui.installBody}</div>`}
      <div class="section-label">${ui.sectionWeek}</div>
      <div class="info-block">
        <h3>${ui.weekHowTitle}</h3>
        <p>${ui.weekHowBody}</p>
      </div>
      <div class="section-label">${ui.sectionWhy}</div>
      ${L()
        .why.map((w) => `<div class="info-block"><h3>${w.t}</h3><p>${w.d}</p></div>`)
        .join("")}
      <div class="section-label">${ui.sectionBanned}</div>
      <div class="info-block">
        <h3>${ui.bannedTitle}</h3>
        <p>${L()
          .banned.map((b) => `• ${b}`)
          .join("<br>")}</p>
      </div>
      <div class="section-label">${ui.sectionProgress}</div>
      <div class="info-block">
        <h3>${ui.progressTitle}</h3>
        <p>${ui.progressBody}</p>
      </div>
      <div class="section-label">${ui.sectionData}</div>
      <div class="info-block">
        <h3>${ui.dataTitle}</h3>
        <p>${ui.dataBody}</p>
      </div>
      <button class="btn-ghost" type="button" id="btn-reset">${ui.reset}</button>
    `;
    $("#btn-reset")?.addEventListener("click", resetPlan);
  }

  function render() {
    updateChrome();
    renderHeader();
    if (state.tab === "hoje") renderHoje();
    if (state.tab === "semana") renderSemana();
    if (state.tab === "cardio") renderCardio();
    if (state.tab === "guia") renderGuia();
  }

  function switchTab(tab) {
    state.tab = tab;
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${tab}`));
    $("#content").scrollTop = 0;
    render();
  }

  document.addEventListener("click", (e) => {
    const langBtn = e.target.closest("[data-lang]");
    if (langBtn) {
      setLang(langBtn.dataset.lang);
      return;
    }
    const tab = e.target.closest(".tab");
    if (tab) {
      switchTab(tab.dataset.tab);
      return;
    }
    const head = e.target.closest(".ex-head");
    if (head) {
      head.parentElement.classList.toggle("open");
      return;
    }
    const complete = e.target.closest("[data-complete]");
    if (complete) {
      toggleComplete(complete.dataset.complete);
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      const iso = open.dataset.open;
      const detail = $("#semana-detail");
      if (!detail) return;
      if (detail.dataset.iso === iso) {
        detail.innerHTML = "";
        delete detail.dataset.iso;
        return;
      }
      detail.dataset.iso = iso;
      renderSession(detail, iso);
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  document.documentElement.lang = lang();
  switchTab("hoje");
})();
