(() => {
  const TZ = "America/Sao_Paulo";
  const STORE_KEY = "lift.v1";
  const D = window.LIFT_DATA;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    tab: "hoje",
    viewKey: null,
    viewDate: null,
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
      };
    } catch {
      return emptyStore();
    }
  }

  function emptyStore() {
    return { startMonday: null, completions: {} };
  }

  function saveStore() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
  }

  /* ── dates in São Paulo ── */
  function partsInTZ(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
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
    // 0 = Monday … 6 = Sunday
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
    return new Intl.DateTimeFormat("pt-BR", {
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
      return {
        started: false,
        planWeek: null,
        mesoWeek: 1,
        meso: D.meso[0],
        block: null,
      };
    }
    const thisMon = mondayOf(iso);
    const weeks = Math.round((isoToDate(thisMon) - isoToDate(start)) / 86400000 / 7);
    const planWeek = weeks + 1;
    const mesoWeek = ((planWeek - 1) % 4) + 1;
    const block = Math.floor((planWeek - 1) / 4) + 1;
    return {
      started: true,
      planWeek,
      mesoWeek,
      meso: D.meso[mesoWeek - 1],
      block,
    };
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
    if (!confirm("Zerar o plano? Semana e treinos marcados voltam do zero.")) return;
    state.store = emptyStore();
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

  /* ── header ── */
  function renderHeader() {
    const info = planInfo();
    const chip = $("#week-chip");
    chip.classList.remove("idle", "deload");
    if (!info.started) {
      chip.classList.add("idle");
      chip.innerHTML = `<span class="w-num">Não iniciado</span><span class="w-sub">marque o 1º treino</span>`;
    } else {
      if (info.mesoWeek === 4) chip.classList.add("deload");
      chip.innerHTML = `<span class="w-num">Semana ${info.planWeek}</span><span class="w-sub">Bloco ${info.block} · ${info.meso.name}</span>`;
    }
    const p = D.profile;
    $("#brand-sub").textContent = `${p.weightKg} kg · ${p.heightCm} cm · ~${p.bfPct}% · ${p.level}`;
  }

  /* ── session view ── */
  function renderSession(container, iso) {
    const slot = sessionForDate(iso);
    const info = planInfo(iso);
    const meso = info.meso;
    const done = isComplete(iso);
    const isToday = iso === todayISO();

    if (!slot) {
      container.innerHTML = `
        <div class="rest">
          <div class="kind-pill kind-rest" style="margin:0 auto 8px">fim de semana</div>
          <h2>DESCANSO</h2>
          <p>O plano é segunda a sexta. Caminhada fácil vale se você quiser — não conta como semana do plano e não é prioridade.</p>
        </div>`;
      return;
    }

    const ses = D.sessions[slot.key];
    const headDate = fmtLong(iso);

    let html = `
      <div class="session-head">
        <div>
          <h2 class="session-title">${ses.title}</h2>
          <div class="session-meta">${headDate}${isToday ? " · hoje" : ""}</div>
        </div>
        <div class="kind-pill kind-${ses.tag}">${ses.tagLabel}</div>
      </div>
      <div class="callout warm">
        <div class="c-label">Aquecimento</div>
        <p>${ses.warmup}</p>
      </div>
      <div class="callout amber">
        <div class="c-label">Semana ${info.started ? info.planWeek : "—"} · ${meso.name}</div>
        <p>${meso.liftNote}</p>
      </div>`;

    (ses.notes || []).forEach((n, i) => {
      html += `<div class="callout ${i === 0 && ses.key === "lower-a" ? "warn" : ""}">
        <div class="c-label">${ses.key.startsWith("lower") && i === 0 ? "Joelhos" : "Nota"}</div>
        <p>${n}</p>
      </div>`;
    });

    if (ses.kind === "cardio") {
      html += renderCardioBlock(meso);
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
              ${ex.knee ? '<span class="pill">joelho</span>' : ""}
            </div>
            <div class="ex-note">${ex.note}</div>
          </div>
        </div>`;
    });

    const cta = done ? "Treino concluído · toque para desfazer" : "Concluí este treino";
    const hint = info.started
      ? "A semana do plano anda toda segunda. Concluir só registra aderência."
      : "O plano começa na segunda da semana deste treino.";

    html += `
      <div class="complete-wrap">
        <button class="btn-complete${done ? " done" : ""}" type="button" data-complete="${iso}">${cta}</button>
        <p class="complete-hint">${hint}</p>
      </div>`;

    container.innerHTML = html;
  }

  function renderCardioBlock(meso) {
    const c = meso.cardio;
    return `
      <div class="zone-box">
        <div class="zl">Sua Zona 2</div>
        <div class="zv">${D.profile.z2[0]}–${D.profile.z2[1]}<span style="font-size:16px;color:var(--muted)"> bpm</span></div>
        <p>${D.sessions.z2.cardio.hrNote}</p>
      </div>
      <div class="card">
        <h3>${c.title} · ${c.duration}</h3>
        <p>${c.detail}</p>
      </div>
      <div class="callout">
        <div class="c-label">Máquina</div>
        <p>${D.sessions.z2.notes[0]}</p>
      </div>`;
  }

  /* ── tabs ── */
  function renderHoje() {
    const iso = todayISO();
    const slot = sessionForDate(iso);
    const strip = D.weekdays
      .map((d) => {
        const dayIso = addDays(mondayOf(iso), d.dow - 1);
        const active = slot && slot.key === d.key && weekdayMon0(iso) < 5;
        const cls = [
          "day-pill",
          active && weekdayMon0(iso) === d.dow - 1 ? "active today" : "",
          isComplete(dayIso) ? "done" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<div class="${cls}"><span class="d-name">${d.short}</span><span class="d-tag">${d.label.split(" ")[0]}</span></div>`;
      })
      .join("");

    $("#panel-hoje").innerHTML = `<div class="day-strip">${strip}</div><div id="hoje-session"></div>`;
    renderSession($("#hoje-session"), iso);
  }

  function renderSemana() {
    const iso = todayISO();
    const mon = mondayOf(iso);
    const info = planInfo(iso);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const dayIso = addDays(mon, i);
      return { iso: dayIso, slot: sessionForDate(dayIso), mon0: i };
    });
    const liftDays = days.filter((d) => d.slot);
    const doneN = liftDays.filter((d) => isComplete(d.iso)).length;
    const pct = Math.round((doneN / 5) * 100);

    const heroTitle = info.started
      ? `Semana ${info.planWeek} · ${info.meso.name}`
      : "Plano ainda não começou";
    const heroSub = info.started
      ? `Bloco ${info.block} de hipertrofia + Zona 2. ${info.meso.liftNote}`
      : "Marque o primeiro treino (seg–sex). A semana 1 começa na segunda daquela semana.";

    const rows = days
      .map((d) => {
        const names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        const title = d.slot ? D.sessions[d.slot.key].title : "Descanso";
        const sub = d.slot ? D.sessions[d.slot.key].tagLabel : "Não programado";
        const cls = [
          "week-row",
          d.slot && isComplete(d.iso) ? "done" : "",
          d.iso === iso ? "today" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button class="${cls}" type="button" data-open="${d.iso}">
          <span class="wr-dow">${names[d.mon0]}</span>
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
    const meso = info.meso;
    $("#panel-cardio").innerHTML = `
      <div class="zone-box">
        <div class="zl">Zona 2 · FCmáx ${D.profile.hrMax}</div>
        <div class="zv">${D.profile.z2[0]}–${D.profile.z2[1]} <span style="font-size:18px;color:var(--muted)">bpm</span></div>
        <p>220 − ${D.profile.age} = ${D.profile.hrMax}. Alvo 65–70%. VO₂ atual ${D.profile.vo2} → meta ≥ ${D.profile.vo2Target}.</p>
      </div>
      <div class="section-label">Esta semana</div>
      <div class="card">
        <h3>${meso.cardio.title} · ${meso.cardio.duration}</h3>
        <p>${meso.cardio.detail}</p>
      </div>
      <div class="section-label">Onde encaixa</div>
      <div class="card">
        <p><strong>Quarta</strong> é o dia de cardio. Sem musculação. 40–50 min na maior parte das semanas.</p>
        <p style="margin-top:8px"><strong>Quinta</strong>, depois do Upper B, 20–25 min fáceis na bike — segunda dose de Z2 sem pisar no joelho.</p>
        <p style="margin-top:8px">Fim de semana não é prioridade. Se sobrar energia, caminhada. Sem corrida.</p>
      </div>
      <div class="section-label">Bloco de 4 semanas</div>
      ${D.meso
        .map(
          (m) => `<div class="card"><h3>S${m.week} · ${m.name}</h3><p><strong>${m.cardio.title}</strong> — ${m.cardio.duration}. ${m.cardio.detail}</p></div>`
        )
        .join("")}
      <div class="callout warn">
        <div class="c-label">Joelho</div>
        <p>Bike primeiro. Elíptico em segundo. Escada só se estiver confortável. Intervalos da semana 3 só na bike, nunca no dia de perna.</p>
      </div>`;
  }

  function renderGuia() {
    const standalone = window.navigator.standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;

    $("#panel-guia").innerHTML = `
      ${standalone ? "" : `<div class="install"><strong>iPhone · adicionar à Tela de Início.</strong> Safari → Compartilhar → Adicionar à Tela de Início. Abre em tela cheia, sem barra do Safari.</div>`}
      <div class="section-label">Semana do plano</div>
      <div class="info-block">
        <h3>Calendário + conclusão</h3>
        <p>A semana 1 começa na <strong>segunda da semana do primeiro treino que você marcar</strong>. Depois disso, o número da semana avança sozinho toda segunda-feira. Marcar um treino só registra que você fez — não atrasa nem adianta o bloco.</p>
      </div>
      <div class="section-label">Por que este plano</div>
      ${D.why.map((w) => `<div class="info-block"><h3>${w.t}</h3><p>${w.d}</p></div>`).join("")}
      <div class="section-label">Fora do plano</div>
      <div class="info-block">
        <h3>Não faça estes</h3>
        <p>${D.banned.map((b) => `• ${b}`).join("<br>")}</p>
      </div>
      <div class="section-label">Progressão</div>
      <div class="info-block">
        <h3>Dupla progressão</h3>
        <p>Feche o topo da faixa de reps em todas as séries com a mesma carga e RPE certo. Na sessão seguinte, suba o peso. Se não fechar, some reps. Deload (semana 4 de cada bloco): 2 séries, RPE 6.</p>
      </div>
      <div class="section-label">Dados</div>
      <div class="info-block">
        <h3>Tudo fica neste iPhone</h3>
        <p>Conclusões e data de início ficam no Safari/PWA (localStorage). Não passa por servidor. Dieta entra numa versão depois.</p>
      </div>
      <button class="btn-ghost" type="button" id="btn-reset">Zerar plano e marcações</button>
    `;
    $("#btn-reset")?.addEventListener("click", resetPlan);
  }

  function render() {
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

  switchTab("hoje");
})();
