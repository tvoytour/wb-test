/* WB-тест — админка кандидатов (статичная страница для GitHub Pages).
 * Ходит за данными в тот же Google Apps Script, что и тест (doGet?action=list,
 * POST set_comment). Правильных ответов/секретов на этой странице нет.
 *
 * НАСТРОЙКА: впишите сюда тот же URL вебхука Apps Script, что и в index.html
 * (EMAIL_WEBHOOK_URL). Токен админки (ADMIN_TOKEN) вводится в поле на странице. */
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxL0N5lOGZtgGPq_BWhCP4_SkI5VHRu6QQlBqgXrSRfAYzA69VE4B9QGq6q27Vfnl_kbg/exec";

(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const tokenEl = $("#token"), tableWrap = $("#tableWrap"), hintEl = $("#hint"),
        countEl = $("#count"), modal = $("#modal"), panel = $("#panel");

  let items = [];
  let sort = { key: "percent", dir: -1 };

  try { tokenEl.value = localStorage.getItem("wbtest_admin_token") || ""; } catch (e) {}

  $("#load").addEventListener("click", load);
  $("#refresh").addEventListener("click", load);
  $("#leaderboard").addEventListener("click", rebuildLeaderboard);
  tokenEl.addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.hidden = true; });

  function rebuildLeaderboard() {
    const token = tokenEl.value.trim();
    try { localStorage.setItem("wbtest_admin_token", token); } catch (e) {}
    if (!WEBHOOK_URL) { hintEl.innerHTML = '<span class="err">В admin.js не задан WEBHOOK_URL.</span>'; return; }
    hintEl.textContent = "Обновляю рейтинг…";
    fetch(WEBHOOK_URL + "?action=leaderboard&token=" + encodeURIComponent(token), { method: "GET", mode: "cors" })
      .then((r) => r.text()).then((t) => {
        let d = null; try { d = JSON.parse(t); } catch (e) {}
        if (!d || !d.ok) { hintEl.innerHTML = '<span class="err">Ошибка рейтинга: ' + esc((d && d.error) || "ответ не распознан") + "</span>"; return; }
        hintEl.innerHTML = 'Лист «Рейтинг» обновлён: <b>' + (d.count || 0) + '</b> кандидатов — см. вкладку «Рейтинг» в таблице.';
      })
      .catch(() => { hintEl.innerHTML = '<span class="err">Сеть недоступна.</span>'; });
  }

  function load() {
    const token = tokenEl.value.trim();
    try { localStorage.setItem("wbtest_admin_token", token); } catch (e) {}
    if (!WEBHOOK_URL) { hintEl.innerHTML = '<span class="err">В admin.js не задан WEBHOOK_URL (тот же, что в index.html).</span>'; return; }
    hintEl.textContent = "Загрузка…";
    fetch(WEBHOOK_URL + "?action=list&token=" + encodeURIComponent(token), { method: "GET", mode: "cors" })
      .then((r) => r.text()).then((t) => {
        let d = null; try { d = JSON.parse(t); } catch (e) {}
        if (!d || !d.ok) { hintEl.innerHTML = '<span class="err">Ошибка: ' + esc((d && d.error) || "ответ не распознан") + " (проверьте токен/URL)</span>"; return; }
        items = d.items || []; hintEl.textContent = "";
        countEl.textContent = items.length + " кандидатов";
        render();
      })
      .catch((e) => { hintEl.innerHTML = '<span class="err">Нет связи с сервером: ' + esc(e.message) + "</span>"; });
  }

  function pctNum(it) { const n = Number(it.percent); return isFinite(n) ? n : -1; }
  function pctClass(p) { return p >= 80 ? "t" : p >= 50 ? "m" : "b"; }
  function af(it) { const a = it.antifraud || {}; return (Number(a.paste) || 0) + (Number(a.copy) || 0) + (Number(a.screenshot) || 0) + (Number(a.tab_switches) || 0); }

  function sorted() {
    const val = (it) => {
      switch (sort.key) {
        case "name": return String(it.name || "").toLowerCase();
        case "percent": return pctNum(it);
        case "antifraud": return af(it);
        case "date": return String(it.timestamp || "");
        default: return 0;
      }
    };
    return items.slice().sort((a, b) => { const x = val(a), y = val(b); return x < y ? -1 * sort.dir : x > y ? sort.dir : 0; });
  }

  function render() {
    if (!items.length) { tableWrap.innerHTML = '<p class="muted">Пока нет прохождений.</p>'; return; }
    const rows = sorted();
    const arr = (k) => sort.key === k ? (sort.dir === -1 ? " ↓" : " ↑") : "";
    let html = '<table><thead><tr>' +
      "<th>#</th>" +
      '<th data-s="name">Кандидат' + arr("name") + "</th>" +
      '<th data-s="percent">%' + arr("percent") + "</th>" +
      "<th>Балл</th><th>Вердикт</th><th>Решение</th>" +
      '<th data-s="antifraud">Антифрод' + arr("antifraud") + "</th>" +
      "<th>Комм.</th><th>PDF</th>" +
      '<th data-s="date">Дата' + arr("date") + "</th>" +
      "</tr></thead><tbody>";
    rows.forEach((it, i) => {
      const p = pctNum(it);
      const a = it.antifraud || {};
      const afBits = [];
      if (Number(a.paste)) afBits.push("вст " + a.paste);
      if (Number(a.copy)) afBits.push("коп " + a.copy);
      if (Number(a.screenshot)) afBits.push("скр " + a.screenshot);
      if (Number(a.tab_switches)) afBits.push("вкл " + a.tab_switches);
      html += '<tr data-id="' + esc(it.id) + '" data-fp="' + esc(it.fingerprint) + '"' + (it.reject ? ' class="reject"' : "") + ">" +
        "<td>" + (i + 1) + "</td>" +
        "<td>" + esc(it.name || "—") + (it.contact ? '<br><small class="muted">' + esc(it.contact) + "</small>" : "") + "</td>" +
        '<td><span class="pct ' + pctClass(p) + '">' + (p < 0 ? "—" : p + "%") + "</span></td>" +
        "<td class=mono>" + esc(it.score || "—") + "</td>" +
        "<td>" + verdictPill(it.verdict) + "</td>" +
        "<td>" + decisionCell(it) + "</td>" +
        '<td class="mono">' + (afBits.length ? '<span class="pill bad">' + afBits.join(" · ") + "</span>" : '<span class="muted">чисто</span>') + "</td>" +
        "<td>" + (it.comment ? "💬" : "") + "</td>" +
        "<td>" + (it.pdf_url ? '<a href="' + esc(it.pdf_url) + '" target="_blank" rel="noopener">PDF↗</a>' : "—") + "</td>" +
        '<td class="mono muted">' + fmtDate(it.timestamp) + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    tableWrap.innerHTML = html;
    tableWrap.querySelectorAll("th[data-s]").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.s;
      if (sort.key === k) sort.dir *= -1; else sort = { key: k, dir: (k === "name" ? 1 : -1) };
      render();
    }));
    tableWrap.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openDetail(tr.dataset.id)));
  }

  function verdictPill(v) {
    if (!v) return "";
    const cls = v === "Сильно" ? "ok" : v === "Средне" ? "mid" : "bad";
    return '<span class="pill ' + cls + '">' + esc(v) + "</span>";
  }

  // Колонка «Решение»: ручная пометка HR (приоритет) либо авто-отсев (<30%).
  function decisionCell(it) {
    if (it.decision === "next") return '<span class="pill ok">След. этап ✓</span>';
    if (it.decision === "reject") return '<span class="pill bad">Отсев</span>';
    if (it.reject) return '<span class="pill bad">Отсев (авто)</span>';
    return '<span class="muted">—</span>';
  }

  function openDetail(id) {
    const it = items.find((x) => String(x.id) === String(id));
    if (!it) return;
    const a = it.antifraud || {};
    const afRows = [["Скриншоты", a.screenshot], ["Уходы/вкладки", a.tab_switches], ["Вне теста, сек", a.away_sec],
      ["Копирование", a.copy], ["Вставка", a.paste], ["Вырезание", a.cut], ["Правый клик", a.context_menu]]
      .map((r) => '<tr><td>' + esc(r[0]) + '</td><td class="mono" style="text-align:right;color:' + (Number(r[1]) ? "var(--bad)" : "var(--ok)") + '">' + (Number(r[1]) || 0) + "</td></tr>").join("");
    const secRows = (it.sections || []).map((s) =>
      "<tr><td>" + esc(s.name) + '</td><td style="text-align:right">' + (s.free ? "свободные" : (s.correct + " / " + s.total)) + "</td></tr>").join("");
    const ans = (it.answers && it.answers.length)
      ? it.answers.map(renderAns).join("")
      : '<p class="muted">Детальные ответы по вопросам не сохранялись для ранних прохождений (доступны только для новых).</p>';
    panel.innerHTML =
      "<h2>" + esc(it.name || "—") + "</h2>" +
      (it.contact ? '<p class="mono" style="margin:.1rem 0">📇 ' + esc(it.contact) + "</p>" : "") +
      '<p class="muted mono">' + fmtDate(it.timestamp) + " · балл " + esc(it.score || "—") + " (" + esc(String(it.percent)) + "%) · " +
        esc(it.verdict || "") + (it.reject ? ' · <span style="color:var(--bad)">' + esc(it.reject) + "</span>" : "") + "</p>" +
      (it.pdf_url ? '<p><a class="btn" href="' + esc(it.pdf_url) + '" target="_blank" rel="noopener">Открыть PDF-отчёт ↗</a></p>' : "") +
      '<div class="sec">Решение</div>' +
      '<div class="decision-bar">' +
        '<span id="decCur">' + decisionCell(it) + "</span>" +
        '<span class="decision-btns"><button class="btn" data-dec="next">На следующий этап</button> ' +
        '<button class="btn btn--ghost" data-dec="reject">На отсев</button> ' +
        '<button class="btn btn--ghost" data-dec="">Сбросить</button></span>' +
      "</div>" +
      '<div class="sec">По разделам</div><table>' + secRows + "</table>" +
      '<div class="sec">Антифрод</div><table>' + afRows + "</table>" +
      '<div class="sec">Ответы (с временем и копипастом по вопросу)</div>' + ans +
      '<div class="sec">Комментарий</div>' +
      '<textarea id="cmt" placeholder="Заметка по кандидату (сохраняется на сервере, видна в списке)">' + esc(it.comment || "") + "</textarea>" +
      '<div class="row-actions"><span class="muted" id="cmtMeta"></span>' +
        '<span><button class="btn btn--ghost" id="close">Закрыть</button> ' +
        '<button class="btn btn--ghost" id="pdfBtn">Сохранить в PDF</button> ' +
        '<button class="btn" id="saveCmt">Сохранить коммент</button></span></div>';
    modal.hidden = false;
    $("#close").addEventListener("click", () => { modal.hidden = true; });
    $("#pdfBtn").addEventListener("click", () => savePdf(it));
    $("#saveCmt").addEventListener("click", () => saveComment(it));
    panel.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => saveDecision(it, b.dataset.dec)));
  }

  function saveDecision(it, decision) {
    fetch(WEBHOOK_URL, {
      method: "POST", mode: "cors", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "set_decision", token: tokenEl.value.trim(), row: it.id, fingerprint: it.fingerprint, decision: decision }),
    }).then((r) => r.text()).then((t) => {
      let d = null; try { d = JSON.parse(t); } catch (e) {}
      if (d && d.ok) { it.decision = decision; const cur = $("#decCur"); if (cur) cur.innerHTML = decisionCell(it); render(); }
      else { alert("Не удалось сохранить решение: " + ((d && d.error) || "?")); }
    }).catch((e) => alert("Ошибка связи: " + e.message));
  }

  // Моментальное скачивание .pdf отчёта кандидата (без диалога печати).
  function savePdf(it) {
    if (typeof html2pdf === "undefined") { alert("Библиотека PDF не загрузилась (vendor/html2pdf.bundle.min.js)."); return; }
    // ВАЖНО: у positioned-узлов (fixed/absolute) html2canvas вычисляет высоту 0 → пустой PDF.
    // Рендерим в ОБЫЧНОМ потоке документа (без position) — высота считается корректно.
    window.scrollTo(0, 0);
    const node = document.createElement("div");
    node.style.cssText = "width:700px;background:#fff;color:#1a1612;padding:20px;margin:0 auto;" +
      "font-family:Arial,Helvetica,sans-serif;overflow-wrap:anywhere;word-break:break-word";
    node.innerHTML = buildReportHTML(it);
    // белая «вуаль» поверх страницы, чтобы узел не «мигал» снизу во время сборки
    const veil = document.createElement("div");
    veil.style.cssText = "position:fixed;inset:0;background:#fff;z-index:99998";
    document.body.appendChild(veil);
    document.body.appendChild(node);
    const safe = String(it.name || "кандидат").replace(/[\\/:*?"<>|]/g, " ").trim();
    const btn = $("#pdfBtn"); if (btn) { btn.disabled = true; btn.textContent = "Готовлю PDF…"; }
    html2pdf().set({
      margin: [10, 10, 10, 10], filename: "WB-тест — " + safe + ".pdf",
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    }).from(node).save()
      .catch((e) => alert("Не удалось собрать PDF: " + e.message))
      .finally(() => { node.remove(); veil.remove(); if (btn) { btn.disabled = false; btn.textContent = "Сохранить в PDF"; } });
  }

  function buildReportHTML(it) {
    const a = it.antifraud || {};
    const afRows = [["Скриншоты", a.screenshot], ["Уходы/вкладки", a.tab_switches], ["Вне теста, сек", a.away_sec],
      ["Копирование", a.copy], ["Вставка", a.paste], ["Вырезание", a.cut], ["Правый клик", a.context_menu]]
      .map((r) => '<tr><td>' + esc(r[0]) + '</td><td class="mono" style="text-align:right;color:' + (Number(r[1]) ? "#c62828" : "#2e7d32") + '">' + (Number(r[1]) || 0) + "</td></tr>").join("");
    const secRows = (it.sections || []).map((s) =>
      "<tr><td>" + esc(s.name) + '</td><td style="text-align:right">' + (s.free ? "свободные" : (s.correct + " / " + s.total)) + "</td></tr>").join("");
    const ans = (it.answers && it.answers.length)
      ? it.answers.map(renderAns).join("")
      : '<p class="muted">Детальные ответы по вопросам не сохранялись для ранних прохождений (доступны только для новых).</p>';
    const decTxt = it.decision === "next" ? "На следующий этап" : it.decision === "reject" ? "На отсев"
      : (it.reject ? "На отсев (авто)" : "—");
    return "<h2 style='margin:.1rem 0'>" + esc(it.name || "—") + "</h2>" +
      (it.contact ? "<div class='mono' style='font-size:.9rem'>📇 " + esc(it.contact) + "</div>" : "") +
      "<div class='mono' style='color:#9a8a90;font-size:.85rem;margin-bottom:.4rem'>" + fmtDate(it.timestamp) +
        " · балл " + esc(it.score || "—") + " (" + esc(String(it.percent)) + "%) · " + esc(it.verdict || "") + "</div>" +
      "<div style='font-size:.9rem;margin-bottom:.4rem'><b>Решение:</b> " + esc(decTxt) + "</div>" +
      '<div class="sec">По разделам</div><table>' + secRows + "</table>" +
      '<div class="sec">Антифрод</div><table>' + afRows + "</table>" +
      '<div class="sec">Ответы (время и копипаст по вопросу)</div>' + ans +
      '<div class="sec">Комментарий</div><div>' + (it.comment ? esc(it.comment) : '<span class="muted">—</span>') + "</div>";
  }

  function renderAns(a) {
    const meta = '<div class="qmeta' + ((Number(a.paste_attempts) || Number(a.copy_attempts)) ? " flag" : "") + '">' + esc(qMeta(a)) + "</div>";
    if (a.type === "free") {
      const txt = (a.free_text || "").trim();
      return '<div class="qa"><b>#' + a.num + " · " + esc(a.section) + " · свободный</b><br>" + esc(a.q) +
        (txt ? "<pre>" + esc(txt) + "</pre>" : '<div class="muted">— пусто —</div>') + meta + "</div>";
    }
    const ok = a.is_correct, answered = a.answered;
    const v = !answered ? '<span class="v man">не отвечено</span>' : (ok ? '<span class="v ok">✓ верно</span>' : '<span class="v no">✕ неверно</span>');
    return '<div class="qa"><b>#' + a.num + " · " + esc(a.section) + "</b> " + v + "<br>" + esc(a.q) +
      '<div>ответ: <span class="mono">' + esc(a.picked_text || "—") + "</span></div>" +
      (ok ? "" : '<div style="color:#2e7d32"><b>Правильный ответ:</b> <span class="mono">' + esc(a.correct_text || "—") + "</span></div>") +
      meta + "</div>";
  }

  function qMeta(a) {
    return "время: " + Math.round(Number(a.time_sec) || 0) + "с · вставки: " + (Number(a.paste_attempts) || 0) +
      " · копирования: " + (Number(a.copy_attempts) || 0);
  }

  function saveComment(it) {
    const ta = $("#cmt"), meta = $("#cmtMeta"), btn = $("#saveCmt");
    btn.disabled = true; meta.textContent = "Сохраняю…";
    fetch(WEBHOOK_URL, {
      method: "POST", mode: "cors", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "set_comment", token: tokenEl.value.trim(), row: it.id, fingerprint: it.fingerprint, comment: ta.value }),
    }).then((r) => r.text()).then((t) => {
      let d = null; try { d = JSON.parse(t); } catch (e) {}
      if (d && d.ok) { it.comment = ta.value; meta.textContent = "сохранено ✓"; render(); }
      else { meta.textContent = "ошибка: " + ((d && d.error) || "не сохранилось"); }
    }).catch((e) => { meta.textContent = "ошибка связи: " + e.message; })
      .finally(() => { btn.disabled = false; });
  }

  function fmtDate(v) { if (!v) return "—"; try { return new Date(v).toLocaleString("ru-RU"); } catch (e) { return String(v); } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
})();
