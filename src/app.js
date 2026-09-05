import {
  createId,
  exportAll,
  getAll,
  getByDate,
  getByKey,
  importAll,
  put,
  remove,
  seedDefaults
} from "./db.js";

const state = {
  date: toDateInputValue(new Date()),
  day: null,
  exercises: [],
  bands: [],
  supplements: [],
  allStrength: [],
  strength: [],
  cycling: [],
  intakes: [],
  editingStrengthId: null,
  editingCyclingId: null,
  editingIntakeId: null
};

const STRENGTH_ROTATION = [
  "handstand-pushups",
  "pullups-reverse-grip",
  "squats",
  "ring-dips",
  "ring-pullups",
  "leg-raises",
  "horizontal-pullups"
];

const SHEETS_SCRIPT_URL_KEY = "training-journal-sheets-script-url";
const SHEETS_BACKUP_KEY_KEY = "training-journal-sheets-backup-key";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

function shiftDate(dateValue, offset) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function byName(a, b) {
  return a.name.localeCompare(b.name, "uk");
}

function findName(items, id, fallback = "Не вказано") {
  return items.find((item) => item.id === id)?.name || fallback;
}

function numberOrNull(value) {
  return value === "" ? null : Number(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadState() {
  const [day, exercises, bands, supplements, allStrength, strength, cycling, intakes] = await Promise.all([
    getByKey("days", state.date),
    getAll("exercises"),
    getAll("bands"),
    getAll("supplements"),
    getAll("strengthWorkouts"),
    getByDate("strengthWorkouts", state.date),
    getByDate("cyclingWorkouts", state.date),
    getByDate("supplementIntakes", state.date)
  ]);

  state.day = day || { date: state.date, wellbeing: null, note: "" };
  state.exercises = exercises.sort(byName);
  state.bands = bands.sort((a, b) => a.assistanceLevel - b.assistanceLevel);
  state.supplements = supplements.sort(byName);
  state.allStrength = allStrength.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
  state.strength = strength.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  state.cycling = cycling.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  state.intakes = intakes.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function render() {
  $("#selectedDate").value = state.date;
  $$(".sectionDate").forEach((input) => {
    input.value = state.date;
  });
  $("#wellbeing").value = state.day.wellbeing ?? "";
  $("#dayNote").value = state.day.note ?? "";
  $("#sheetsScriptUrl").value = localStorage.getItem(SHEETS_SCRIPT_URL_KEY) || "";
  $("#sheetsBackupKey").value = localStorage.getItem(SHEETS_BACKUP_KEY_KEY) || "";

  renderSummary();
  renderStrength();
  renderCycling();
  renderSupplements();
  renderStrengthHistory();
  renderSettings();
}

function fillStaticSelects() {
  fillNumberSelect("#strengthTargetSets", 1, 10, 1, 5);
  fillNumberSelect("#strengthTargetReps", 1, 20, 1, 5);
  fillNumberSelect("#strengthRest", 0.5, 10, 0.5, 3);
  fillNumberSelect("#cyclingDuration", 1, 30, 1, 10, "Хвилини");
  fillNumberSelect("#cyclingLoad", 1, 20, 1, 1, "Рівень");
}

function renderSummary() {
  const strengthRows = state.strength.length
    ? state.strength.map((item) => {
      if (item.loadMode === "skip") return `<li>Пропуск${item.notes ? `: ${escapeHtml(item.notes)}` : ""}</li>`;
      const load = getStrengthLoadLabel(item);
      const loadText = load ? ` · ${load}` : "";
      return `<li>${escapeHtml(findName(state.exercises, item.exerciseId))}${escapeHtml(loadText)}: ${item.sets.map((set) => set.reps || 0).join(" / ")}</li>`;
    }).join("")
    : "<li>Немає силового тренування</li>";

  const cyclingRows = state.cycling.length
    ? state.cycling.map((item) => `<li>${item.durationMinutes || 0} хв, ${item.distanceKm || 0} км, ${item.averageSpeedKmh || 0} км/год${item.load ? ` · навантаження ${item.load}` : ""}</li>`).join("")
    : "<li>Немає велотренування</li>";

  const intakeRows = state.intakes.length
    ? state.intakes.map((item) => `<li>${escapeHtml(item.time || "--:--")} · ${escapeHtml(findName(state.supplements, item.supplementId))} · ${escapeHtml(item.dose || "")}</li>`).join("")
    : "<li>Немає прийомів добавок</li>";

  $("#summaryPanel").innerHTML = `
    <div class="summary-head">
      <div>
        <p class="eyebrow">Вибраний день</p>
        <h2>${formatDate(state.date)}</h2>
      </div>
      <div class="score">${state.day.wellbeing ? `${state.day.wellbeing}/10` : "—"}</div>
    </div>
    ${state.day.note ? `<p class="day-note">${escapeHtml(state.day.note)}</p>` : ""}
    <div class="summary-grid">
      <article>
        <h3>Силові</h3>
        <ul>${strengthRows}</ul>
      </article>
      <article>
        <h3>Вело</h3>
        <ul>${cyclingRows}</ul>
      </article>
      <article>
        <h3>Добавки</h3>
        <ul>${intakeRows}</ul>
      </article>
    </div>
  `;
}

function renderStrength() {
  fillSelect("#strengthExercise", state.exercises, "Вибери вправу");
  fillSelect("#strengthBand", state.bands, "Вибери гумку");
  updateStrengthSpecificFields();
  renderSetsEditor();
  renderStrengthSuggestion();

  const list = $("#strengthList");
  list.innerHTML = state.strength.length
    ? state.strength.map((item) => {
      if (item.loadMode === "skip") {
        return `
        <article class="entry">
          <div>
            <strong>Пропуск</strong>
            ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
          </div>
          <div class="entry-actions">
            <button class="secondary" type="button" data-edit-strength="${item.id}">Редагувати</button>
            <button class="danger" type="button" data-delete-strength="${item.id}">Видалити</button>
          </div>
        </article>
      `;
      }
      const workoutBand = item.bandId ? findName(state.bands, item.bandId, "") : "";
      const sets = item.sets.map((set) => set.reps || 0).join(" / ");
      const details = [
        workoutBand,
        item.addedWeightKg ? `+${item.addedWeightKg} кг` : "",
        item.technicalStep || "",
        item.needsConsolidation ? "Потребує закріплення" : ""
      ].filter(Boolean).join(" · ");
      return `
        <article class="entry">
          <div>
            <strong>${escapeHtml(findName(state.exercises, item.exerciseId))}</strong>
            <p>Ціль ${item.targetSets || 5}×${item.targetReps || "?"}; ${escapeHtml(sets)}</p>
            ${details ? `<p>${escapeHtml(details)}</p>` : ""}
            ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
          </div>
          <div class="entry-actions">
            <button class="secondary" type="button" data-edit-strength="${item.id}">Редагувати</button>
            <button class="danger" type="button" data-delete-strength="${item.id}">Видалити</button>
          </div>
        </article>
      `;
    }).join("")
    : `<p class="empty">Записів за цей день ще немає.</p>`;

  $$("[data-edit-strength]").forEach((button) => button.addEventListener("click", editStrength));
  $$("[data-delete-strength]").forEach((button) => button.addEventListener("click", deleteStrength));
  $("[data-use-suggested-strength]")?.addEventListener("click", useSuggestedStrength);
}

function renderStrengthSuggestion() {
  const suggestion = getSuggestedStrength();
  if (!suggestion) {
    $("#strengthSuggestion").innerHTML = "";
    $("#strengthSuggestion").hidden = true;
    return;
  }

  const forecast = getStrengthForecast(suggestion.exercise.id);
  const previousHtml = getPreviousStrengthHtml(suggestion.exercise.id) || "<p>Попереднього результату для цієї вправи ще немає.</p>";
  const targetReps = forecast?.targetReps || suggestion.exercise.lowerRepTarget || "";
  const suggestedRows = [
    suggestion.exercise.name,
    targetReps ? `Зробити: ${targetReps} у підході` : "",
    forecast?.bandId ? `Гумка: ${findName(state.bands, forecast.bandId, "")}` : ""
  ].filter(Boolean).map((row) => `<li>${escapeHtml(row)}</li>`).join("");

  $("#strengthSuggestion").innerHTML = `
    <div class="suggestion-content">
      <p><strong>На сьогодні:</strong></p>
      <ul>${suggestedRows}</ul>
      ${previousHtml}
    </div>
    <button class="secondary" type="button" data-use-suggested-strength="${suggestion.exercise.id}">Вибрати</button>
  `;
  $("#strengthSuggestion").hidden = false;
}

function getSuggestedStrength() {
  const records = state.allStrength
    .filter((item) => item.date < state.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));

  let currentIndex = null;
  let last = null;
  let lastLabel = "";

  for (const record of records) {
    const rotationIndex = STRENGTH_ROTATION.indexOf(record.exerciseId);
    if (rotationIndex >= 0) {
      currentIndex = rotationIndex;
      last = record;
      lastLabel = findName(state.exercises, record.exerciseId);
    } else if (record.loadMode === "skip" && currentIndex !== null) {
      currentIndex = (currentIndex + 1) % STRENGTH_ROTATION.length;
      last = record;
      lastLabel = "Пропуск";
    }
  }

  const suggestedId = STRENGTH_ROTATION[currentIndex === null ? 0 : (currentIndex + 1) % STRENGTH_ROTATION.length];
  const exercise = state.exercises.find((item) => item.id === suggestedId);
  return exercise ? { exercise, last, lastLabel } : null;
}

function getPreviousStrengthRecord(exerciseId) {
  return state.allStrength
    .filter((item) => item.exerciseId === exerciseId && item.date < state.date)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;
}

function getStrengthForecast(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  const previous = getPreviousStrengthRecord(exerciseId);
  if (!previous || previous.loadMode === "skip") return null;

  const previousBandId = exercise?.loadMode === "band" ? previous.bandId || "" : "";
  const reps = (previous.sets || []).map((set) => Number(set.reps || 0)).filter((value) => value > 0);
  if (reps.length === 0) {
    return {
      targetReps: previous.targetReps || exercise?.lowerRepTarget || null,
      bandId: previousBandId
    };
  }

  const allSame = reps.every((value) => value === reps[0]);
  if (!allSame) {
    return {
      targetReps: previous.targetReps || reps[0],
      bandId: previousBandId
    };
  }

  if (previous.needsConsolidation) {
    return {
      targetReps: reps[0],
      bandId: previousBandId
    };
  }

  const upperTarget = Number(exercise?.upperRepTarget || 20);
  if (upperTarget && reps[0] >= upperTarget) {
    return {
      targetReps: exercise?.lowerRepTarget || reps[0],
      bandId: exercise?.loadMode === "band" ? getNextHarderBandId(previousBandId) : previousBandId
    };
  }

  return {
    targetReps: Math.min(reps[0] + 1, upperTarget || 20),
    bandId: previousBandId
  };
}

function getForecastReps(exerciseId) {
  return getStrengthForecast(exerciseId)?.targetReps || null;
}

function getNextHarderBandId(bandId) {
  const current = state.bands.find((item) => item.id === bandId);
  if (!current) return bandId || "";

  const currentLevel = Number(current.assistanceLevel);
  const harder = state.bands
    .filter((item) => Number(item.assistanceLevel) < currentLevel)
    .sort((a, b) => Number(b.assistanceLevel) - Number(a.assistanceLevel))[0];

  return harder?.id || current.id;
}

function renderSetsEditor() {
  const repOptions = Array.from({ length: 20 }, (_, index) => {
    const value = index + 1;
    return `<option value="${value}">${value}</option>`;
  }).join("");

  $("#setsEditor").innerHTML = Array.from({ length: 5 }, (_, index) => `
    <div class="set-row">
      <span>${index + 1}</span>
      <select data-set-reps="${index}" aria-label="Повтори у підході ${index + 1}">
        <option value="">Повтори</option>
        ${repOptions}
      </select>
    </div>
  `).join("");
  $$("[data-set-reps]").forEach((input) => input.addEventListener("change", updateConsolidationField));
  updateConsolidationField();
}

function renderCycling() {
  $("#cyclingList").innerHTML = state.cycling.length
    ? state.cycling.map((item) => {
      const details = [
        item.durationMinutes ? `${item.durationMinutes} хв` : "",
        item.distanceKm ? `${item.distanceKm} км` : "",
        item.averageSpeedKmh ? `${item.averageSpeedKmh} км/год` : "",
        item.load ? `навантаження ${item.load}` : ""
      ].filter(Boolean).join(" · ");

      return `
        <article class="entry">
          <div>
            <strong>${escapeHtml(details || "Велотренування")}</strong>
            ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
          </div>
          <div class="entry-actions">
            <button class="secondary" type="button" data-edit-cycling="${item.id}">Редагувати</button>
            <button class="danger" type="button" data-delete-cycling="${item.id}">Видалити</button>
          </div>
        </article>
      `;
    }).join("")
    : `<p class="empty">Велозаписів за цей день ще немає.</p>`;

  $$("[data-edit-cycling]").forEach((button) => button.addEventListener("click", editCycling));
  $$("[data-delete-cycling]").forEach((button) => button.addEventListener("click", deleteCycling));
}

function renderSupplements() {
  fillSelect("#intakeSupplement", state.supplements, "Вибери добавку");
  $("#intakeList").innerHTML = state.intakes.length
    ? state.intakes.map((item) => `
      <article class="entry">
        <div>
          <strong>${escapeHtml(item.time || "--:--")} · ${escapeHtml(findName(state.supplements, item.supplementId))}</strong>
          <p>${escapeHtml(item.dose || "")}</p>
          ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
        </div>
        <div class="entry-actions">
          <button class="secondary" type="button" data-edit-intake="${item.id}">Редагувати</button>
          <button class="danger" type="button" data-delete-intake="${item.id}">Видалити</button>
        </div>
      </article>
    `).join("")
    : `<p class="empty">Прийомів за цей день ще немає.</p>`;

  $$("[data-edit-intake]").forEach((button) => button.addEventListener("click", editIntake));
  $$("[data-delete-intake]").forEach((button) => button.addEventListener("click", deleteIntake));
}

function renderStrengthHistory() {
  fillSelect("#strengthHistoryFilter", state.exercises, "Всі вправи");
  const filter = $("#strengthHistoryFilter").value;
  const rows = state.allStrength
    .filter((item) => !filter || item.exerciseId === filter)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));

  $("#strengthHistoryTable").innerHTML = rows.length
    ? `
      <table class="history-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Вправа</th>
            <th>Навантаження</th>
            <th>Ціль</th>
            <th>Підходи</th>
            <th>Закріплення</th>
            <th>Нотатка</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((item) => {
            const load = getStrengthLoadLabel(item);
            const sets = item.loadMode === "skip" ? "" : (item.sets || []).map((set) => set.reps || 0).join(" / ");
            const target = item.loadMode === "skip" ? "" : `${item.targetSets || 5}×${item.targetReps || "?"}`;
            return `
              <tr>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(item.loadMode === "skip" ? "Пропуск" : findName(state.exercises, item.exerciseId))}</td>
                <td>${escapeHtml(load)}</td>
                <td>${escapeHtml(target)}</td>
                <td>${escapeHtml(sets)}</td>
                <td>${item.needsConsolidation ? "Так" : "Ні"}</td>
                <td>${escapeHtml(item.notes || "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `
    : `<p class="empty">Силових записів ще немає.</p>`;
}

function getStrengthLoadLabel(item) {
  return [
    item.bandId ? findName(state.bands, item.bandId, "") : "",
    item.addedWeightKg ? `+${item.addedWeightKg} кг` : "",
    item.technicalStep || ""
  ].filter(Boolean).join(" · ");
}

function renderSettings() {
  $("#exerciseList").innerHTML = state.exercises.map((item) => `
    <span class="chip">
      <span>${escapeHtml(item.name)} ${item.lowerRepTarget}–${item.upperRepTarget}</span>
      <button class="chip-delete" type="button" title="Видалити" data-delete-dictionary="exercises" data-delete-id="${item.id}">×</button>
    </span>
  `).join("");
  $("#bandList").innerHTML = state.bands.map((item) => `
    <span class="chip">
      <span>${escapeHtml(item.name)} · ${item.assistanceLevel}</span>
      <button class="chip-delete" type="button" title="Видалити" data-delete-dictionary="bands" data-delete-id="${item.id}">×</button>
    </span>
  `).join("");
  $("#supplementList").innerHTML = state.supplements.map((item) => `
    <span class="chip">
      <span>${escapeHtml(item.name)}${item.defaultDose ? ` · ${escapeHtml(item.defaultDose)}` : ""}</span>
      <button class="chip-delete" type="button" title="Видалити" data-delete-dictionary="supplements" data-delete-id="${item.id}">×</button>
    </span>
  `).join("");

  $$("[data-delete-dictionary]").forEach((button) => button.addEventListener("click", deleteDictionaryItem));
}

function fillSelect(selector, items, placeholder) {
  const select = $(selector);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  if (items.some((item) => item.id === current)) select.value = current;
}

function fillNumberSelect(selector, min, max, step, defaultValue, placeholder = "") {
  const select = $(selector);
  const options = [];
  if (placeholder) options.push(`<option value="">${placeholder}</option>`);
  for (let value = min; value <= max; value += step) {
    const rounded = Number(value.toFixed(2));
    const selected = rounded === defaultValue ? " selected" : "";
    options.push(`<option value="${rounded}"${selected}>${rounded}</option>`);
  }
  select.innerHTML = options.join("");
  select.value = String(defaultValue);
}

async function saveDay() {
  await put("days", {
    date: state.date,
    wellbeing: numberOrNull($("#wellbeing").value),
    note: $("#dayNote").value.trim()
  });
  await refresh();
}

function getPreviousStrengthHtml(exerciseId) {
  if (!exerciseId) {
    return "";
  }
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (exercise?.loadMode === "skip") {
    return "";
  }
  const previous = getPreviousStrengthRecord(exerciseId);

  if (!previous) {
    return "";
  }

  const daysAgo = daysBetween(previous.date, state.date);
  const dateLine = `${formatDate(previous.date)} (${daysAgo} дн. тому)`;
  const loadLine = [
    previous.bandId ? findName(state.bands, previous.bandId, "") : "",
    previous.addedWeightKg ? `+${previous.addedWeightKg} кг` : "",
    previous.technicalStep || ""
  ].filter(Boolean).join(" · ");
  const sets = previous.sets.map((set) => set.reps || 0).join(" / ");
  return `
    <p><strong>Попередній результат:</strong></p>
    <ul>
      <li>${escapeHtml(dateLine)}</li>
      ${loadLine ? `<li>${escapeHtml(loadLine)}</li>` : ""}
      <li>Підходи: ${escapeHtml(sets)}</li>
    </ul>
  `;
}

function renderSelectedStrengthContext(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  const previousHtml = getPreviousStrengthHtml(exerciseId);
  if (!exercise || exercise.loadMode === "skip" || !previousHtml) {
    renderStrengthSuggestion();
    return;
  }

  $("#strengthSuggestion").innerHTML = `
    <div class="suggestion-content">
      <p><strong>Вибрана вправа:</strong> ${escapeHtml(exercise.name)}</p>
      ${previousHtml}
    </div>
  `;
  $("#strengthSuggestion").hidden = false;
}

async function refresh() {
  await loadState();
  render();
}

function bindEvents() {
  $("#prevDay").addEventListener("click", () => changeDate(shiftDate(state.date, -1)));
  $("#nextDay").addEventListener("click", () => changeDate(shiftDate(state.date, 1)));
  $("#selectedDate").addEventListener("change", (event) => changeDate(event.target.value));
  $$(".sectionDate").forEach((input) => {
    input.addEventListener("change", (event) => changeDate(event.target.value));
  });
  $("#strengthTargetSets").addEventListener("change", updateConsolidationField);
  $("#wellbeing").addEventListener("change", saveDay);
  $("#dayNote").addEventListener("change", saveDay);

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
      $$(".panel").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.tab));
      $(".app-shell").dataset.activeTab = button.dataset.tab;
    });
  });

  $("#clearStrength").addEventListener("click", () => {
    clearStrengthForm();
  });
  $("#strengthExercise").addEventListener("change", async (event) => {
    const exercise = state.exercises.find((item) => item.id === event.target.value);
    await selectStrengthExercise(exercise);
    updateConsolidationField();
  });
  $("#strengthForm").addEventListener("submit", saveStrength);

  $("#cyclingForm").addEventListener("submit", saveCycling);
  $("#clearCycling").addEventListener("click", clearCyclingForm);

  $("#clearIntake").addEventListener("click", () => {
    clearIntakeForm();
  });
  $("#intakeSupplement").addEventListener("change", (event) => {
    const supplement = state.supplements.find((item) => item.id === event.target.value);
    if (supplement && !$("#intakeDose").value) $("#intakeDose").value = supplement.defaultDose || "";
  });
  $("#intakeForm").addEventListener("submit", saveIntake);

  $("#exerciseForm").addEventListener("submit", saveExercise);
  $("#bandForm").addEventListener("submit", saveBand);
  $("#supplementForm").addEventListener("submit", saveSupplement);
  $("#exportData").addEventListener("click", downloadBackup);
  $("#importData").addEventListener("change", uploadBackup);
  $("#strengthHistoryFilter").addEventListener("change", renderStrengthHistory);
  $("#sheetsScriptUrl").addEventListener("change", saveSheetsBackupSettings);
  $("#sheetsBackupKey").addEventListener("change", saveSheetsBackupSettings);
  $("#backupToSheets").addEventListener("click", backupToSheets);
  $("#restoreFromSheets").addEventListener("click", restoreFromSheets);
}

async function selectStrengthExercise(exercise) {
  if (exercise) {
    const forecast = getStrengthForecast(exercise.id);
    $("#strengthTargetSets").value = exercise.defaultSets || 5;
    $("#strengthTargetReps").value = forecast?.targetReps || exercise.lowerRepTarget || 5;
    $("#strengthTechnique").value = exercise.defaultTechnique || "";
    updateStrengthSpecificFields(exercise);
    $("#strengthBand").value = exercise.loadMode === "band" && forecast?.bandId ? forecast.bandId : "";
  } else {
    updateStrengthSpecificFields(exercise);
  }
  renderSelectedStrengthContext(exercise?.id || "");
}

async function useSuggestedStrength(event) {
  const exercise = state.exercises.find((item) => item.id === event.currentTarget.dataset.useSuggestedStrength);
  if (!exercise) return;
  $("#strengthExercise").value = exercise.id;
  await selectStrengthExercise(exercise);
}

async function changeDate(date) {
  state.date = date;
  clearStrengthForm();
  clearCyclingForm();
  clearIntakeForm();
  await refresh();
}

async function saveStrength(event) {
  event.preventDefault();
  const exerciseId = $("#strengthExercise").value;
  if (!exerciseId) return;
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  const existing = state.editingStrengthId ? await getByKey("strengthWorkouts", state.editingStrengthId) : null;
  const isSkip = exercise?.loadMode === "skip";
  const usesBand = exercise?.loadMode === "band";
  const usesWeight = exercise?.loadMode === "weight";
  const usesTechnique = exercise?.loadMode === "technical_step";

  const sets = isSkip ? [] : Array.from({ length: 5 }, (_, index) => ({
    index: index + 1,
    reps: numberOrNull($(`[data-set-reps="${index}"]`).value) || 0
  }));

  await put("strengthWorkouts", {
    id: existing?.id || createId("strength"),
    date: state.date,
    exerciseId,
    targetSets: isSkip ? 0 : numberOrNull($("#strengthTargetSets").value) || 5,
    targetReps: isSkip ? null : numberOrNull($("#strengthTargetReps").value),
    restMinutes: isSkip ? null : numberOrNull($("#strengthRest").value) || 3,
    loadMode: exercise?.loadMode || "band",
    bandId: usesBand ? $("#strengthBand").value || null : null,
    addedWeightKg: usesWeight ? numberOrNull($("#strengthAddedWeight").value) : null,
    technicalStep: usesTechnique ? $("#strengthTechnique").value.trim() : "",
    needsConsolidation: isSkip ? false : $("#strengthNeedsConsolidation").value === "true",
    notes: $("#strengthNote").value.trim(),
    sets,
    extra: existing?.extra || {},
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  clearStrengthForm();
  await refresh();
}

function updateStrengthSpecificFields(exercise = null) {
  const selected = exercise || state.exercises.find((item) => item.id === $("#strengthExercise").value);
  const isSkip = selected?.loadMode === "skip";
  const usesBand = selected?.loadMode === "band";
  const usesWeight = selected?.loadMode === "weight";
  const usesTechnique = selected?.loadMode === "technical_step";

  $("#strengthExerciseFields").hidden = isSkip;
  $("#strengthBandField").hidden = !usesBand;
  $("#strengthAddedWeightField").hidden = !usesWeight;
  $("#strengthTechniqueField").hidden = !usesTechnique;

  if (!usesBand) $("#strengthBand").value = "";
  if (!usesWeight) $("#strengthAddedWeight").value = "";
  if (!usesTechnique) $("#strengthTechnique").value = "";
  updateConsolidationField();
}

function updateConsolidationField() {
  const exercise = state.exercises.find((item) => item.id === $("#strengthExercise").value);
  const reps = $$("[data-set-reps]").map((input) => input.value).filter(Boolean);
  const expectedSets = Number($("#strengthTargetSets").value || 5);
  const hasAllTargetSets = reps.length === expectedSets;
  const allSame = hasAllTargetSets && reps.every((value) => value === reps[0]);
  const shouldShow = exercise?.loadMode !== "skip" && allSame;

  $("#strengthNeedsConsolidationField").hidden = !shouldShow;
  if (!shouldShow) $("#strengthNeedsConsolidation").value = "false";
}

async function deleteStrength(event) {
  const id = event.currentTarget.dataset.deleteStrength;
  if (!confirm("Видалити цей силовий запис?")) return;
  event.currentTarget.closest(".entry")?.remove();
  await remove("strengthWorkouts", id);
  if (state.editingStrengthId === id) clearStrengthForm();
  await refresh();
}

async function editStrength(event) {
  const item = state.strength.find((record) => record.id === event.currentTarget.dataset.editStrength);
  if (!item) return;

  state.editingStrengthId = item.id;
  $("#strengthSave").textContent = "Оновити";
  $("#strengthExercise").value = item.exerciseId || "";
  $("#strengthTargetSets").value = String(item.targetSets || 5);
  $("#strengthTargetReps").value = item.targetReps == null ? "5" : String(item.targetReps);
  $("#strengthRest").value = String(item.restMinutes ?? (item.restSeconds ? item.restSeconds / 60 : 3));
  $("#strengthBand").value = item.bandId || "";
  $("#strengthAddedWeight").value = item.addedWeightKg ?? "";
  $("#strengthTechnique").value = item.technicalStep || "";
  $("#strengthNeedsConsolidation").value = item.needsConsolidation ? "true" : "false";
  $("#strengthNote").value = item.notes || "";
  updateStrengthSpecificFields(state.exercises.find((exercise) => exercise.id === item.exerciseId));
  renderSetsEditor();
  (item.sets || []).forEach((set, index) => {
    const input = $(`[data-set-reps="${index}"]`);
    if (input) input.value = set.reps || "";
  });
  updateConsolidationField();
  renderSelectedStrengthContext(item.exerciseId || "");
  $("#strengthForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearStrengthForm() {
  state.editingStrengthId = null;
  $("#strengthSave").textContent = "Зберегти";
  $("#strengthForm").reset();
  $("#strengthNeedsConsolidation").value = "false";
  renderStrengthSuggestion();
  updateStrengthSpecificFields();
  renderSetsEditor();
}

async function saveCycling(event) {
  event.preventDefault();
  const existing = state.editingCyclingId ? await getByKey("cyclingWorkouts", state.editingCyclingId) : null;
  await put("cyclingWorkouts", {
    id: existing?.id || createId("cycling"),
    date: state.date,
    durationMinutes: numberOrNull($("#cyclingDuration").value),
    distanceKm: numberOrNull($("#cyclingDistance").value),
    averageSpeedKmh: numberOrNull($("#cyclingSpeed").value),
    load: numberOrNull($("#cyclingLoad").value),
    notes: $("#cyclingNote").value.trim(),
    extra: existing?.extra || {},
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  clearCyclingForm();
  await refresh();
}

async function deleteCycling(event) {
  const id = event.currentTarget.dataset.deleteCycling;
  if (!confirm("Видалити це велотренування?")) return;
  event.currentTarget.closest(".entry")?.remove();
  await remove("cyclingWorkouts", id);
  if (state.editingCyclingId === id) clearCyclingForm();
  await refresh();
}

function editCycling(event) {
  const item = state.cycling.find((record) => record.id === event.currentTarget.dataset.editCycling);
  if (!item) return;

  state.editingCyclingId = item.id;
  $("#cyclingSave").textContent = "Оновити";
  $("#cyclingDuration").value = item.durationMinutes ?? "";
  $("#cyclingDistance").value = item.distanceKm ?? "";
  $("#cyclingSpeed").value = item.averageSpeedKmh ?? "";
  $("#cyclingLoad").value = item.load ?? "";
  $("#cyclingNote").value = item.notes || "";
  $("#cyclingForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearCyclingForm() {
  state.editingCyclingId = null;
  $("#cyclingSave").textContent = "Зберегти";
  $("#cyclingForm").reset();
}

async function saveIntake(event) {
  event.preventDefault();
  if (!$("#intakeSupplement").value) return;
  const existing = state.editingIntakeId ? await getByKey("supplementIntakes", state.editingIntakeId) : null;
  await put("supplementIntakes", {
    id: existing?.id || createId("intake"),
    date: state.date,
    supplementId: $("#intakeSupplement").value,
    time: $("#intakeTime").value,
    dose: $("#intakeDose").value.trim(),
    notes: $("#intakeNote").value.trim(),
    extra: existing?.extra || {},
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  clearIntakeForm();
  await refresh();
}

async function deleteIntake(event) {
  const id = event.currentTarget.dataset.deleteIntake;
  if (!confirm("Видалити цей прийом добавки?")) return;
  event.currentTarget.closest(".entry")?.remove();
  await remove("supplementIntakes", id);
  if (state.editingIntakeId === id) clearIntakeForm();
  await refresh();
}

function editIntake(event) {
  const item = state.intakes.find((record) => record.id === event.currentTarget.dataset.editIntake);
  if (!item) return;

  state.editingIntakeId = item.id;
  $("#intakeSave").textContent = "Оновити";
  $("#intakeSupplement").value = item.supplementId || "";
  $("#intakeTime").value = item.time || "";
  $("#intakeDose").value = item.dose || "";
  $("#intakeNote").value = item.notes || "";
  $("#intakeForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearIntakeForm() {
  state.editingIntakeId = null;
  $("#intakeSave").textContent = "Зберегти";
  $("#intakeForm").reset();
}

async function deleteDictionaryItem(event) {
  const { deleteDictionary, deleteId } = event.currentTarget.dataset;
  if (!confirm("Видалити цей пункт довідника?")) return;
  event.currentTarget.closest(".chip")?.remove();
  await remove(deleteDictionary, deleteId);
  await refresh();
}

async function saveExercise(event) {
  event.preventDefault();
  const name = $("#exerciseName").value.trim();
  if (!name) return;
  await put("exercises", {
    id: createId("exercise"),
    name,
    category: "custom",
    lowerRepTarget: numberOrNull($("#exerciseLower").value) || 5,
    upperRepTarget: numberOrNull($("#exerciseUpper").value) || 10,
    defaultSets: 5
  });
  event.target.reset();
  await refresh();
}

async function saveBand(event) {
  event.preventDefault();
  const name = $("#bandName").value.trim();
  if (!name) return;
  await put("bands", {
    id: createId("band"),
    name,
    assistanceLevel: numberOrNull($("#bandLevel").value) || 0,
    notes: ""
  });
  event.target.reset();
  await refresh();
}

async function saveSupplement(event) {
  event.preventDefault();
  const name = $("#supplementName").value.trim();
  if (!name) return;
  await put("supplements", {
    id: createId("supplement"),
    name,
    defaultDose: $("#supplementDose").value.trim(),
    notes: ""
  });
  event.target.reset();
  await refresh();
}

async function downloadBackup() {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `journal-backup-${state.date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function uploadBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  await importAll(JSON.parse(text));
  event.target.value = "";
  await refresh();
}

function saveSheetsBackupSettings() {
  localStorage.setItem(SHEETS_SCRIPT_URL_KEY, $("#sheetsScriptUrl").value.trim());
  localStorage.setItem(SHEETS_BACKUP_KEY_KEY, $("#sheetsBackupKey").value.trim());
}

function getSheetsBackupSettings() {
  const url = $("#sheetsScriptUrl").value.trim();
  const key = $("#sheetsBackupKey").value.trim();
  saveSheetsBackupSettings();
  return { url, key };
}

function setSheetsBackupStatus(message) {
  $("#sheetsBackupStatus").textContent = message;
}

async function backupToSheets() {
  const { url, key } = getSheetsBackupSettings();
  if (!url || !key) {
    setSheetsBackupStatus("Вкажи Apps Script URL і ключ.");
    return;
  }

  setSheetsBackupStatus("Зберігаю резервну копію...");
  const data = await exportAll();
  const payload = {
    key,
    savedAt: new Date().toISOString(),
    source: location.origin + location.pathname,
    data
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    setSheetsBackupStatus("Резервну копію відправлено. Apps Script збереже її в таблицю.");
  } catch (error) {
    setSheetsBackupStatus("Не вдалося відправити backup. Перевір інтернет і Apps Script URL.");
  }
}

function fetchSheetsBackupJsonp(url, key) {
  return new Promise((resolve, reject) => {
    const callbackName = `receiveSheetsBackup_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timeout"));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}key=${encodeURIComponent(key)}&callback=${encodeURIComponent(callbackName)}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Script load failed"));
    };
    document.body.appendChild(script);
  });
}

async function restoreFromSheets() {
  const { url, key } = getSheetsBackupSettings();
  if (!url || !key) {
    setSheetsBackupStatus("Вкажи Apps Script URL і ключ.");
    return;
  }
  if (!confirm("Відновити дані з Google Sheets? Поточні локальні записи буде замінено backup-версією.")) return;

  setSheetsBackupStatus("Завантажую резервну копію...");
  try {
    const payload = await fetchSheetsBackupJsonp(url, key);
    if (!payload?.ok || !payload.data) {
      throw new Error(payload?.error || "Backup not found");
    }
    await importAll(payload.data);
    await refresh();
    setSheetsBackupStatus(`Відновлено backup від ${payload.savedAt || "невідомої дати"}.`);
  } catch (error) {
    setSheetsBackupStatus("Не вдалося відновити backup. Перевір URL, ключ і наявність backup у таблиці.");
  }
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => registration.update())
      .catch(() => {});
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    $("#installButton").hidden = false;
  });

  $("#installButton").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("#installButton").hidden = true;
  });
}

async function init() {
  bindEvents();
  registerPwa();
  fillStaticSelects();
  await seedDefaults();
  await refresh();
}

init();
