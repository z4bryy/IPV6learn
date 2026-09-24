/**
 * IPV6learn — procvičování a test zkracování IPv6 (RFC 5952)
 */

/* —— Theme —— */
(function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function current() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("ipv6learn-theme", theme);
    } catch (_) {
      /* ignore */
    }
    btn.setAttribute("aria-label", theme === "dark" ? "Zapnout světlý režim" : "Zapnout tmavý režim");
  }

  btn.addEventListener("click", () => {
    apply(current() === "dark" ? "light" : "dark");
  });

  apply(current());
})();

const HEX = "0123456789abcdef";
const TEST_SIZE = 10;

/* ========== IPv6 logika ========== */

function randomHextet({ allowLeadingZeros = true } = {}) {
  if (!allowLeadingZeros) {
    let s = HEX[1 + Math.floor(Math.random() * 15)];
    for (let i = 0; i < 3; i++) s += HEX[Math.floor(Math.random() * 16)];
    return s;
  }
  // často s úvodními nulami — lepší na procvičení
  const style = Math.random();
  if (style < 0.25) return "0000";
  if (style < 0.4) {
    // 000x / 00xx / 0xxx
    const zeros = 1 + Math.floor(Math.random() * 3);
    let s = "0".repeat(zeros);
    while (s.length < 4) s += HEX[Math.floor(Math.random() * 16)];
    return s;
  }
  let s = "";
  for (let i = 0; i < 4; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

/** Preferovaný formát (8×4 hex) s rozmanitými vzory nul. */
function generatePreferred() {
  const hextets = Array.from({ length: 8 }, () => randomHextet());
  const pattern = Math.random();

  if (pattern < 0.55) {
    // souvislá řada 2–5 nul
    const len = 2 + Math.floor(Math.random() * 4);
    const start = Math.floor(Math.random() * (9 - len));
    for (let i = start; i < start + len; i++) hextets[i] = "0000";
  } else if (pattern < 0.75) {
    // dvě kratší řady — procvičení „nejdelší / nejlevější“
    const a = Math.floor(Math.random() * 3);
    hextets[a] = "0000";
    hextets[a + 1] = "0000";
    const b = 4 + Math.floor(Math.random() * 3);
    hextets[b] = "0000";
    hextets[b + 1] = "0000";
  } else if (pattern < 0.9) {
    hextets[Math.floor(Math.random() * 8)] = "0000";
  }

  // alespoň jeden nenulový blok
  if (hextets.every((h) => h === "0000")) {
    hextets[0] = "2001";
    hextets[7] = "0001";
  }

  // zajistit, že některý nenulový blok má úvodní nulu (didaktika)
  const nonzero = hextets.map((h, i) => (h !== "0000" ? i : -1)).filter((i) => i >= 0);
  if (nonzero.length && Math.random() < 0.7) {
    const i = nonzero[Math.floor(Math.random() * nonzero.length)];
    const n = parseInt(hextets[i], 16) % 0xfff || 1;
    hextets[i] = n.toString(16).padStart(4, "0");
  }

  return hextets;
}

function omitLeadingZeros(hextets) {
  return hextets.map((h) => {
    const stripped = h.replace(/^0+/, "");
    return stripped === "" ? "0" : stripped;
  });
}

/**
 * Komprese podle RFC 5952:
 * - nejdelší souvislá řada nulových hextetů (≥ 2)
 * - při shodě délky bere se nejlevější
 * - jeden samotný nulový blok se nekomprimuje
 */
function compress(hextets) {
  const short = omitLeadingZeros(hextets);

  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < 8) {
    if (short[i] === "0") {
      let j = i;
      while (j < 8 && short[j] === "0") j++;
      const len = j - i;
      if (len > bestLen) {
        bestLen = len;
        bestStart = i;
      }
      i = j;
    } else {
      i++;
    }
  }

  if (bestLen < 2) return short.join(":");

  const left = short.slice(0, bestStart).join(":");
  const right = short.slice(bestStart + bestLen).join(":");

  if (bestStart === 0 && bestStart + bestLen === 8) return "::";
  if (bestStart === 0) return "::" + right;
  if (bestStart + bestLen === 8) return left + "::";
  return left + "::" + right;
}

function normalizeAnswer(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function checkOmit(userParts, expected) {
  return userParts.map((u, i) => normalizeAnswer(u) === expected[i]);
}

function checkCompressed(user, expected) {
  return normalizeAnswer(user) === expected;
}

function isAnswered(item) {
  const hasOmit = (item.userOmit || []).some((v) => normalizeAnswer(v) !== "");
  const hasComp = normalizeAnswer(item.userCompressed) !== "";
  return hasOmit || hasComp;
}

function gradeItem(item) {
  const omitFlags = checkOmit(item.userOmit || Array(8).fill(""), item.omit);
  const omitOk = omitFlags.every(Boolean);
  const compressOk = checkCompressed(item.userCompressed, item.compressed);
  return { omitFlags, omitOk, compressOk, ok: omitOk && compressOk };
}

/* ========== UI board ========== */

function buildBoard(container, hextets, { answers = null, autoFocus = false } = {}) {
  container.replaceChildren();

  const shortExpected = omitLeadingZeros(hextets);
  const compressedExpected = compress(hextets);

  // Row 1 — preferred
  const row1 = document.createElement("div");
  row1.className = "addr-row";
  row1.appendChild(makeLabel("Preferovaný<br>formát"));
  const wrap1 = document.createElement("div");
  wrap1.className = "hextets-wrap";
  hextets.forEach((h) => {
    const cell = document.createElement("div");
    cell.className = "hextet";
    cell.textContent = h;
    wrap1.appendChild(cell);
  });
  row1.appendChild(wrap1);
  container.appendChild(row1);

  // Row 2 — omit leading zeros
  const row2 = document.createElement("div");
  row2.className = "addr-row";
  row2.appendChild(makeLabel("Vynechat<br>úvodní nuly"));
  const wrap2 = document.createElement("div");
  wrap2.className = "hextets-wrap";
  const omitInputs = [];

  for (let i = 0; i < 8; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "hextet-input";
    input.maxLength = 4;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.inputMode = "text";
    input.setAttribute("aria-label", `Blok ${i + 1} bez úvodních nul`);
    if (answers?.omit) input.value = answers.omit[i] || "";

    input.addEventListener("input", () => {
      const caret = input.selectionStart;
      const cleaned = input.value.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 4);
      input.value = cleaned;
      input.classList.remove("is-ok", "is-bad");
      try {
        input.setSelectionRange(caret, caret);
      } catch (_) {
        /* ignore */
      }
      // auto-posun po 4 znacích
      if (cleaned.length === 4 && i < 7) {
        omitInputs[i + 1].focus();
        omitInputs[i + 1].select();
      }
      container.dispatchEvent(new CustomEvent("boardchange"));
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === ":" || e.key === "ArrowRight") {
        if (e.key !== "ArrowRight" || input.selectionStart === input.value.length) {
          e.preventDefault();
          if (i < 7) {
            omitInputs[i + 1].focus();
            omitInputs[i + 1].select();
          } else {
            compressInput.focus();
          }
        }
      } else if (e.key === "ArrowLeft" && input.selectionStart === 0 && i > 0) {
        e.preventDefault();
        omitInputs[i - 1].focus();
        omitInputs[i - 1].select();
      } else if (e.key === "Backspace" && input.value === "" && i > 0) {
        e.preventDefault();
        omitInputs[i - 1].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (i < 7) {
          omitInputs[i + 1].focus();
        } else {
          compressInput.focus();
        }
      }
    });

    // vložení celé zkrácené adresy do prvního pole
    input.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      if (!text.includes(":")) return;
      e.preventDefault();
      const parts = normalizeAnswer(text).split(":").filter((p) => p !== "");
      // pokud je :: v paste, neřešíme — jen plain omit tvar
      if (text.includes("::")) return;
      parts.slice(0, 8).forEach((p, idx) => {
        if (omitInputs[idx]) {
          omitInputs[idx].value = p.replace(/[^0-9a-f]/gi, "").toLowerCase().slice(0, 4);
          omitInputs[idx].classList.remove("is-ok", "is-bad");
        }
      });
      const focusIdx = Math.min(parts.length, 7);
      omitInputs[focusIdx].focus();
      container.dispatchEvent(new CustomEvent("boardchange"));
    });

    omitInputs.push(input);
    wrap2.appendChild(input);
  }
  row2.appendChild(wrap2);
  container.appendChild(row2);

  // Row 3 — compressed
  const row3 = document.createElement("div");
  row3.className = "addr-row compressed";
  row3.appendChild(makeLabel("Komprimovaný<br>formát"));
  const compressInput = document.createElement("input");
  compressInput.type = "text";
  compressInput.className = "compress-input";
  compressInput.autocomplete = "off";
  compressInput.spellcheck = false;
  compressInput.placeholder = "např. fe80::6678:9101:0:34ab";
  compressInput.setAttribute("aria-label", "Komprimovaný formát");
  if (answers?.compressed) compressInput.value = answers.compressed;

  compressInput.addEventListener("input", () => {
    compressInput.value = compressInput.value.toLowerCase().replace(/[^0-9a-f:]/g, "");
    compressInput.classList.remove("is-ok", "is-bad");
    container.dispatchEvent(new CustomEvent("boardchange"));
  });

  row3.appendChild(compressInput);
  container.appendChild(row3);

  if (autoFocus) {
    requestAnimationFrame(() => omitInputs[0].focus());
  }

  return {
    hextets,
    shortExpected,
    compressedExpected,
    omitInputs,
    compressInput,
    getOmit() {
      return omitInputs.map((el) => el.value);
    },
    getCompressed() {
      return compressInput.value;
    },
    setAnswers(omit, compressed) {
      omit.forEach((v, i) => {
        omitInputs[i].value = v;
      });
      compressInput.value = compressed;
    },
    clearMarks() {
      omitInputs.forEach((el) => el.classList.remove("is-ok", "is-bad"));
      compressInput.classList.remove("is-ok", "is-bad");
    },
    mark(omitOk, compressOk) {
      omitOk.forEach((ok, i) => {
        omitInputs[i].classList.toggle("is-ok", ok);
        omitInputs[i].classList.toggle("is-bad", !ok);
      });
      compressInput.classList.toggle("is-ok", compressOk);
      compressInput.classList.toggle("is-bad", !compressOk);
    },
    reset() {
      omitInputs.forEach((el) => {
        el.value = "";
        el.classList.remove("is-ok", "is-bad");
      });
      compressInput.value = "";
      compressInput.classList.remove("is-ok", "is-bad");
      omitInputs[0].focus();
    },
  };
}

function makeLabel(html) {
  const el = document.createElement("div");
  el.className = "row-label";
  el.innerHTML = html;
  return el;
}

/* ========== Stav aplikace ========== */

const views = {
  home: document.getElementById("view-home"),
  learn: document.getElementById("view-learn"),
  subnet: document.getElementById("view-subnet"),
  practice: document.getElementById("view-practice"),
  test: document.getElementById("view-test"),
  results: document.getElementById("view-results"),
};

const CRUMBS = {
  home: "",
  learn: "Teorie",
  subnet: "Subnetting",
  practice: "Zkracování",
  test: "Test zkracování",
  results: "Výsledek testu",
};

let practiceBoard = null;
let practiceCorrect = 0;
let practiceCheckedOk = false;
let practiceRevealed = false;
let practiceFailCount = 0;

let testIndex = 0;
let testItems = [];
let testBoard = null;
let testActive = false;

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (el) el.classList.toggle("is-visible", key === name);
  });
  const crumb = document.getElementById("header-crumb");
  if (crumb) {
    const label = CRUMBS[name] || "";
    crumb.hidden = !label;
    crumb.textContent = label;
  }
  if (name === "learn" || name === "subnet" || name === "home") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goHome() {
  if (testActive && !confirm("Opustit test a vrátit se do menu?")) return;
  testActive = false;
  showView("home");
}

function openPractice() {
  if (testActive) {
    const leave = confirm("Opustit test a přejít na procvičování?");
    if (!leave) return;
    testActive = false;
  }
  showView("practice");
  if (!practiceBoard) loadPractice(false);
}

function openLearn(anchor) {
  if (testActive) {
    const leave = confirm("Opustit test a otevřít teorii?");
    if (!leave) return;
    testActive = false;
  }
  showView("learn");
  if (anchor) {
    requestAnimationFrame(() => {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function openSubnet() {
  if (testActive) {
    const leave = confirm("Opustit test a otevřít subnetting?");
    if (!leave) return;
    testActive = false;
  }
  showView("subnet");
}

function requestTest() {
  if (testActive) {
    const restart = confirm("Probíhá test. Chcete začít znovu od začátku?");
    if (!restart) {
      showView("test");
      return;
    }
  } else if (!confirm("Spustit nový test s 10 příklady?")) {
    return;
  }
  startTest();
}

function updatePracticeStat() {
  document.querySelector("#practice-stat span").textContent = String(practiceCorrect);
}

function setFeedback(el, type, text) {
  el.hidden = false;
  el.className = `feedback is-${type}`;
  el.textContent = text;
}

function setFeedbackHtml(el, type, html) {
  el.hidden = false;
  el.className = `feedback is-${type}`;
  el.innerHTML = html;
}

/** Diagnostika chyb v řádu „vynechat úvodní nuly“. */
function diagnoseOmit(userParts, expected, preferred) {
  const details = [];
  const kinds = new Set();

  userParts.forEach((raw, i) => {
    const user = normalizeAnswer(raw);
    const exp = expected[i];
    if (user === exp) return;

    const block = i + 1;
    const pref = preferred[i];

    if (user === "") {
      kinds.add("empty");
      details.push({
        where: `Blok ${block}`,
        msg: `je prázdný — má být <code>${exp}</code> (z <code>${pref}</code>).`,
        kind: "empty",
      });
      return;
    }

    // stále má úvodní nuly, ale jinak stejná hodnota
    const strippedUser = user.replace(/^0+/, "") || "0";
    if (/^0+[0-9a-f]+$/i.test(user) && strippedUser === exp) {
      kinds.add("leading");
      details.push({
        where: `Blok ${block}`,
        msg: `máte <code>${user}</code>, ale úvodní nuly se vynechávají → <code>${exp}</code>.`,
        kind: "leading",
      });
      return;
    }

    // napsali plný preferred místo zkráceného
    if (user === pref.toLowerCase() && pref.toLowerCase() !== exp) {
      kinds.add("leading");
      details.push({
        where: `Blok ${block}`,
        msg: `opsali jste celý blok <code>${user}</code> — správně bez úvodních nul: <code>${exp}</code>.`,
        kind: "leading",
      });
      return;
    }

    kinds.add("value");
    details.push({
      where: `Blok ${block}`,
      msg: `máte <code>${user}</code>, správně je <code>${exp}</code>.`,
      kind: "value",
    });
  });

  return { details, kinds };
}

/** Najde nejdelší (a při shodě nejlevější) řadu nul v shortened hextetech. */
function findZeroRun(short) {
  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < 8) {
    if (short[i] === "0") {
      let j = i;
      while (j < 8 && short[j] === "0") j++;
      const len = j - i;
      if (len > bestLen) {
        bestLen = len;
        bestStart = i;
      }
      i = j;
    } else {
      i++;
    }
  }
  return { bestStart, bestLen };
}

/** Diagnostika komprimovaného zápisu. */
function diagnoseCompress(userRaw, expected, shortHextets) {
  const details = [];
  const kinds = new Set();
  const user = normalizeAnswer(userRaw);

  if (user === expected) return { details, kinds };

  if (user === "") {
    kinds.add("empty");
    details.push({
      where: "Komprimovaný formát",
      msg: "je prázdný — doplňte zkrácenou adresu s případným <code>::</code>.",
      kind: "empty",
    });
    return { details, kinds };
  }

  const { bestStart, bestLen } = findZeroRun(shortHextets);
  const plainJoin = shortHextets.join(":");

  // opsali jen omit bez komprese, ač :: patří
  if (user === plainJoin && expected.includes("::")) {
    kinds.add("no_compress");
    const from = bestStart + 1;
    const to = bestStart + bestLen;
    details.push({
      where: "Komprimovaný formát",
      msg: `máte zápis bez <code>::</code>. Nulové bloky ${from}–${to} nahradíte jedním <code>::</code> → <code>${expected}</code>.`,
      kind: "no_compress",
    });
    return { details, kinds };
  }

  // použili :: i když netřeba (jen jedna nula / žádná řada ≥2)
  if (user.includes("::") && !expected.includes("::")) {
    kinds.add("single_zero");
    details.push({
      where: "Komprimovaný formát",
      msg: `tady se <code>::</code> nepoužívá — nejdelší řada nul má méně než 2 bloky. Správně: <code>${expected}</code>.`,
      kind: "single_zero",
    });
    return { details, kinds };
  }

  // špatné místo / délka komprese
  if (user.includes("::") && expected.includes("::") && user !== expected) {
    kinds.add("wrong_run");
    const from = bestStart + 1;
    const to = bestStart + bestLen;
    details.push({
      where: "Komprimovaný formát",
      msg: `máte <code>${user}</code>. <code>::</code> musí nahradit nejdelší souvislou řadu nul (bloky ${from}–${to}, při shodě tu nejlevější) → <code>${expected}</code>.`,
      kind: "wrong_run",
    });
    return { details, kinds };
  }

  kinds.add("general");
  details.push({
    where: "Komprimovaný formát",
    msg: `máte <code>${user}</code>, správně je <code>${expected}</code>.`,
    kind: "general",
  });
  return { details, kinds };
}

const LESSONS = {
  leading:
    "Úvodní nuly v každém bloku vždy smažte: <code>00ab</code> → <code>ab</code>, <code>0000</code> → <code>0</code>. Nikdy nenechávejte nulu navíc vlevo.",
  empty: "Každý z osmi bloků i komprimovaný řádek musí být vyplněný — prázdné pole je chyba.",
  value:
    "Blok musí přesně odpovídat hextetu bez úvodních nul. Kontrolujte, že jste nepřepsali číslice.",
  no_compress:
    "Když máte 2 a více nulových bloků za sebou, musíte je nahradit <code>::</code> — a to jen jednou v celé adrese.",
  single_zero:
    "Jeden samotný nulový blok se <strong>nekomprimuje</strong>. Píšete ho jako <code>0</code>, ne jako <code>::</code>.",
  wrong_run:
    "Pravidlo RFC 5952: <code>::</code> patří na <strong>nejdelší</strong> řadu nul. Když jsou dvě stejně dlouhé, berete tu <strong>vlevo</strong>.",
  general:
    "Komprimovaný tvar vznikne z bloků bez úvodních nul a případně jednoho <code>::</code> místo nejdelší řady nul.",
};

function pickLesson(kinds) {
  const order = ["leading", "no_compress", "wrong_run", "single_zero", "empty", "value", "general"];
  for (const k of order) {
    if (kinds.has(k) && LESSONS[k]) return LESSONS[k];
  }
  return LESSONS.general;
}

function buildErrorFeedbackHtml(omitDiag, compDiag, failCount) {
  const allDetails = [...omitDiag.details, ...compDiag.details];
  const allKinds = new Set([...omitDiag.kinds, ...compDiag.kinds]);
  const items = [];

  const leading = omitDiag.details.filter((d) => d.kind === "leading");
  const otherOmit = omitDiag.details.filter((d) => d.kind !== "leading");

  if (leading.length >= 2) {
    const nums = leading.map((d) => d.where.replace("Blok ", ""));
    const fixes = leading
      .map((d) => {
        const idx = Number(d.where.replace("Blok ", "")) - 1;
        const got = normalizeAnswer(practiceBoard.getOmit()[idx]) || "—";
        const exp = practiceBoard.shortExpected[idx];
        return `blok ${idx + 1}: <code>${got}</code> → <code>${exp}</code>`;
      })
      .join("; ");
    items.push(
      `<li><span class="fb-where">Bloky ${nums.join(", ")}</span> — zbývají úvodní nuly (${fixes}).</li>`
    );
  } else {
    leading.forEach((d) => {
      items.push(`<li><span class="fb-where">${d.where}</span> — ${d.msg}</li>`);
    });
  }

  otherOmit.forEach((d) => {
    items.push(`<li><span class="fb-where">${d.where}</span> — ${d.msg}</li>`);
  });
  compDiag.details.forEach((d) => {
    items.push(`<li><span class="fb-where">${d.where}</span> — ${d.msg}</li>`);
  });

  let html = `<p class="fb-title">Chyba na ${allDetails.length === 1 ? "tomto místě" : "těchto místech"}:</p>`;
  html += `<ul class="fb-list">${items.join("")}</ul>`;

  if (failCount >= 2) {
    html += `<div class="fb-lesson"><strong>Ponaučení</strong><p>${pickLesson(allKinds)}</p></div>`;
  } else {
    html += `<p class="fb-hint">Opravte označená pole a zkontrolujte znovu — při další chybě dostanete vysvětlení pravidla.</p>`;
  }

  return html;
}

function loadPractice(keepScore = true) {
  if (!keepScore) practiceCorrect = 0;
  practiceCheckedOk = false;
  practiceRevealed = false;
  practiceFailCount = 0;
  updatePracticeStat();
  practiceBoard = buildBoard(document.getElementById("practice-board"), generatePreferred(), {
    autoFocus: true,
  });
  const fb = document.getElementById("practice-feedback");
  fb.hidden = true;
  fb.textContent = "";
  fb.className = "feedback";
  document.getElementById("practice-next").classList.remove("is-pulse");
}

function evaluatePractice() {
  if (!practiceBoard) return;
  const userOmit = practiceBoard.getOmit();
  const userComp = practiceBoard.getCompressed();
  const omitOk = checkOmit(userOmit, practiceBoard.shortExpected);
  const compressOk = checkCompressed(userComp, practiceBoard.compressedExpected);
  practiceBoard.mark(omitOk, compressOk);
  const allOk = omitOk.every(Boolean) && compressOk;
  const fb = document.getElementById("practice-feedback");

  if (allOk) {
    practiceFailCount = 0;
    if (practiceRevealed) {
      practiceCheckedOk = true;
      setFeedback(
        fb,
        "info",
        "Ano, toto je správné řešení — bod se nepočítá, protože jste použili Ukázat."
      );
    } else if (!practiceCheckedOk) {
      practiceCorrect += 1;
      practiceCheckedOk = true;
      updatePracticeStat();
      setFeedback(fb, "ok", "Správně! Adresa je zkrácena podle pravidel.");
      document.getElementById("practice-next").classList.add("is-pulse");
      document.getElementById("practice-next").focus();
    } else {
      setFeedback(fb, "ok", "Stále správně. Pokračujte na další příklad.");
      document.getElementById("practice-next").classList.add("is-pulse");
    }
  } else {
    practiceFailCount += 1;
    const omitDiag = diagnoseOmit(
      userOmit,
      practiceBoard.shortExpected,
      practiceBoard.hextets
    );
    const compDiag = compressOk
      ? { details: [], kinds: new Set() }
      : diagnoseCompress(
          userComp,
          practiceBoard.compressedExpected,
          practiceBoard.shortExpected
        );
    setFeedbackHtml(fb, "bad", buildErrorFeedbackHtml(omitDiag, compDiag, practiceFailCount));

    // fokus na první chybné pole
    const firstBad = practiceBoard.omitInputs.findIndex((_, i) => !omitOk[i]);
    if (firstBad >= 0) practiceBoard.omitInputs[firstBad].focus();
    else if (!compressOk) practiceBoard.compressInput.focus();
  }
}

document.getElementById("practice-check").addEventListener("click", evaluatePractice);

document.getElementById("practice-next").addEventListener("click", () => {
  loadPractice(true);
});

document.getElementById("practice-show").addEventListener("click", () => {
  if (!practiceBoard) return;
  practiceRevealed = true;
  practiceBoard.setAnswers(practiceBoard.shortExpected, practiceBoard.compressedExpected);
  practiceBoard.clearMarks();
  setFeedback(
    document.getElementById("practice-feedback"),
    "info",
    `Řešení: ${practiceBoard.compressedExpected}  ·  bod se za tento příklad nepočítá`
  );
  document.getElementById("practice-next").classList.add("is-pulse");
});

document.getElementById("practice-reset").addEventListener("click", () => {
  if (!practiceBoard) return;
  practiceBoard.reset();
  practiceCheckedOk = false;
  practiceFailCount = 0;
  // revealed zůstává — po Ukázat už bod nedostanete
  const fb = document.getElementById("practice-feedback");
  fb.hidden = true;
  document.getElementById("practice-next").classList.remove("is-pulse");
});

/* ========== Test ========== */

function buildTestDots() {
  const host = document.getElementById("test-dots");
  if (!host) return;
  host.replaceChildren();
  testItems.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "test-dot";
    btn.textContent = String(idx + 1);
    btn.setAttribute("aria-label", `Příklad ${idx + 1}`);
    if (idx === testIndex) btn.classList.add("is-current");
    if (isAnswered(item)) btn.classList.add("is-filled");
    btn.addEventListener("click", () => {
      saveCurrentTestAnswers();
      testIndex = idx;
      renderTestQuestion();
    });
    host.appendChild(btn);
  });
}

function startTest() {
  testItems = Array.from({ length: TEST_SIZE }, () => {
    const hextets = generatePreferred();
    return {
      hextets,
      omit: omitLeadingZeros(hextets),
      compressed: compress(hextets),
      userOmit: Array(8).fill(""),
      userCompressed: "",
    };
  });
  testIndex = 0;
  testActive = true;
  showView("test");
  renderTestQuestion();
}

function saveCurrentTestAnswers() {
  if (!testBoard || !testItems[testIndex]) return;
  testItems[testIndex].userOmit = testBoard.getOmit();
  testItems[testIndex].userCompressed = testBoard.getCompressed();
}

function renderTestQuestion() {
  const item = testItems[testIndex];
  document.querySelector("#test-progress span").textContent = String(testIndex + 1);
  document.getElementById("test-progress-fill").style.width =
    `${((testIndex + 1) / TEST_SIZE) * 100}%`;

  testBoard = buildBoard(document.getElementById("test-board"), item.hextets, {
    answers: { omit: item.userOmit, compressed: item.userCompressed },
    autoFocus: true,
  });

  document.getElementById("test-prev").disabled = testIndex === 0;
  document.getElementById("test-next").textContent =
    testIndex === TEST_SIZE - 1 ? "Dokončit test" : "Další příklad";

  buildTestDots();
}

document.getElementById("test-prev").addEventListener("click", () => {
  saveCurrentTestAnswers();
  if (testIndex > 0) {
    testIndex -= 1;
    renderTestQuestion();
  }
});

document.getElementById("test-next").addEventListener("click", () => {
  saveCurrentTestAnswers();
  if (testIndex < TEST_SIZE - 1) {
    testIndex += 1;
    renderTestQuestion();
  } else {
    requestFinishTest();
  }
});

function requestFinishTest() {
  saveCurrentTestAnswers();
  const unanswered = testItems.filter((it) => !isAnswered(it)).length;
  if (unanswered > 0) {
    let label;
    if (unanswered === 1) label = "1 nezodpovězený příklad";
    else if (unanswered >= 2 && unanswered <= 4) label = `${unanswered} nezodpovězené příklady`;
    else label = `${unanswered} nezodpovězených příkladů`;
    if (!confirm(`Máte ${label}. Opravdu chcete test ukončit?`)) return;
  }
  finishTest();
}

function finishTest() {
  saveCurrentTestAnswers();
  testActive = false;
  let score = 0;
  let omitScore = 0;
  let compressScore = 0;
  const list = document.getElementById("results-list");
  list.replaceChildren();

  testItems.forEach((item, idx) => {
    const { omitOk, compressOk, ok } = gradeItem(item);
    if (ok) score += 1;
    if (omitOk) omitScore += 1;
    if (compressOk) compressScore += 1;

    const div = document.createElement("div");
    div.className = `result-item ${ok ? "is-ok" : "is-bad"}`;
    const omitNote = omitOk ? "nuly ✓" : "nuly ✗";
    const compNote = compressOk ? "komprese ✓" : "komprese ✗";
    div.innerHTML = `
      <span class="badge">${ok ? "OK" : "CHYBA"}</span>
      <div>
        <div><strong>#${idx + 1}</strong> <code>${item.hextets.join(":")}</code></div>
        <div class="result-meta">${omitNote} · ${compNote}</div>
        <div class="result-meta">Správně: <code>${item.compressed}</code></div>
        ${
          !ok
            ? `<div class="result-meta">Vaše: <code>${
                normalizeAnswer(item.userCompressed) || "—"
              }</code></div>`
            : ""
        }
      </div>
    `;
    list.appendChild(div);
  });

  document.getElementById("results-score").textContent = `${score} / ${TEST_SIZE}`;
  document.getElementById("results-pct").textContent = `${Math.round((score / TEST_SIZE) * 100)} %`;
  document.getElementById("results-breakdown").textContent =
    `Úvodní nuly: ${omitScore}/${TEST_SIZE} · Komprese: ${compressScore}/${TEST_SIZE}`;

  const msg = document.getElementById("results-msg");
  if (score === TEST_SIZE) msg.textContent = "Perfektní výsledek — ovládáte zkracování IPv6!";
  else if (score >= 8) msg.textContent = "Výborně, jen drobné chyby.";
  else if (score >= 5) msg.textContent = "Solidní základ — ještě si to procvičte.";
  else msg.textContent = "Doporučujeme vrátit se k procvičování a zkusit test znovu.";

  showView("results");
}

/* ========== Navigace ========== */

document.querySelectorAll("[data-go]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const go = btn.dataset.go;
    if (go === "practice") openPractice();
    else if (go === "test") requestTest();
    else if (go === "learn") openLearn();
    else if (go === "special") openLearn("l-spec");
    else if (go === "subnet") openSubnet();
  });
});

document.querySelectorAll("[data-back-home]").forEach((btn) => {
  btn.addEventListener("click", () => goHome());
});

document.getElementById("learn-to-practice").addEventListener("click", () => openPractice());

document.getElementById("learn-jump-practice").addEventListener("click", (e) => {
  e.preventDefault();
  openPractice();
});

document.getElementById("subnet-to-practice").addEventListener("click", () => openPractice());
document.getElementById("subnet-to-learn").addEventListener("click", () => openLearn());

document.getElementById("practice-open-test").addEventListener("click", () => requestTest());

document.getElementById("retry-test").addEventListener("click", () => startTest());
document.getElementById("back-practice").addEventListener("click", () => openPractice());

document.getElementById("brand-home").addEventListener("click", () => goHome());

document.getElementById("practice-board").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("compress-input")) {
    e.preventDefault();
    evaluatePractice();
  }
});

document.getElementById("test-board").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("compress-input")) {
    e.preventDefault();
    document.getElementById("test-next").click();
  }
});

document.getElementById("test-board").addEventListener("boardchange", () => {
  saveCurrentTestAnswers();
  buildTestDots();
});

// Expose for debugging / eventual unit hooks
window.IPV6learn = {
  omitLeadingZeros,
  compress,
  generatePreferred,
  checkOmit,
  checkCompressed,
  gradeItem,
  showView,
};
