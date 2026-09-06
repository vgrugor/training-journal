(function () {
  const DB_NAME = "personal-day-journal";
  const DB_VERSION = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function byName(a, b) {
    return (a.name || "").localeCompare(b.name || "", "uk");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function parseDose(value) {
    const match = String(value ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function formatDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}.${month}`;
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(value, days) {
    const [year, month, day] = value.split("-").map(Number);
    return dateKey(new Date(year, month - 1, day + days));
  }

  function dateRange(start, end) {
    const dates = [];
    let current = start;

    while (current <= end && dates.length < 2000) {
      dates.push(current);
      current = addDays(current, 1);
    }

    return dates;
  }

  function fillSelect(selector, items, placeholder) {
    const select = document.querySelector(selector);
    if (!select) return;

    const selected = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${items
      .sort(byName)
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("")}`;

    if (selected && items.some((item) => item.id === selected)) {
      select.value = selected;
    }
  }

  function fillSupplementSelect(supplements) {
    const select = document.querySelector("#progressSupplement");
    if (!select) return null;

    const sorted = [...supplements].sort(byName);
    const selected = select.value;
    select.innerHTML = sorted
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");

    if (selected && sorted.some((item) => item.id === selected)) {
      select.value = selected;
    } else if (sorted[0]) {
      select.value = sorted[0].id;
    }

    return select.value || null;
  }

  function fillStrengthSelect(exercises) {
    const select = document.querySelector("#progressStrengthExercise");
    if (!select) return null;

    const selected = select.value;
    const sorted = exercises
      .filter((item) => item.loadMode !== "skip")
      .sort(byName);
    select.innerHTML = sorted
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");

    if (selected && sorted.some((item) => item.id === selected)) {
      select.value = selected;
    } else if (sorted[0]) {
      select.value = sorted[0].id;
    }

    return select.value || null;
  }

  function prepareStrengthMetricSelect() {
    const select = document.querySelector("#progressStrengthMetric");
    if (!select || select.dataset.prepared) return;

    const repsOption = Array.from(select.options).find((option) => option.value === "reps");
    if (repsOption) {
      select.prepend(repsOption);
      select.value = "reps";
    }

    select.dataset.prepared = "true";
  }

  function ensureStrengthDateFilters() {
    if (document.querySelector("#progressStrengthDateFrom")) return;

    const metricSelect = document.querySelector("#progressStrengthMetric");
    const container = metricSelect?.closest(".accordion-body");
    if (!container) return;

    const dateGrid = document.createElement("div");
    dateGrid.className = "form-grid two progress-date-filters";
    dateGrid.innerHTML = `
      <label>
        <span>З дати</span>
        <input id="progressStrengthDateFrom" type="date" />
      </label>
      <label>
        <span>По дату</span>
        <input id="progressStrengthDateTo" type="date" />
      </label>
    `;
    metricSelect.closest("label")?.after(dateGrid);
  }

  function ensureDoseDateFilters() {
    if (document.querySelector("#progressSupplementDateFrom")) return;

    const supplementSelect = document.querySelector("#progressSupplement");
    const container = supplementSelect?.closest(".accordion-body");
    if (!container) return;

    const dateGrid = document.createElement("div");
    dateGrid.className = "form-grid two progress-date-filters";
    dateGrid.innerHTML = `
      <label>
        <span>З дати</span>
        <input id="progressSupplementDateFrom" type="date" />
      </label>
      <label>
        <span>По дату</span>
        <input id="progressSupplementDateTo" type="date" />
      </label>
    `;
    supplementSelect.closest("label")?.after(dateGrid);
  }

  function ensureCyclingDateFilters() {
    if (document.querySelector("#progressCyclingDateFrom")) return;

    const metricSelect = document.querySelector("#progressCyclingMetric");
    const container = metricSelect?.closest(".accordion-body");
    if (!container) return;

    const dateGrid = document.createElement("div");
    dateGrid.className = "form-grid two progress-date-filters";
    dateGrid.innerHTML = `
      <label>
        <span>З дати</span>
        <input id="progressCyclingDateFrom" type="date" />
      </label>
      <label>
        <span>По дату</span>
        <input id="progressCyclingDateTo" type="date" />
      </label>
    `;
    metricSelect.closest("label")?.after(dateGrid);
  }

  function getProgressChart(chartId, anchorSelector) {
    let chart = document.querySelector(`#${chartId}`);
    if (chart) return chart;

    const anchor = document.querySelector(anchorSelector);
    const container = anchor?.closest(".accordion-body");
    if (!container) return null;

    chart = document.createElement("div");
    chart.id = chartId;
    chart.className = "progress-chart";
    container.appendChild(chart);
    return chart;
  }

  function getDoseChart() {
    return getProgressChart("supplementDoseChart", "#progressSupplement");
  }

  function getCyclingChart() {
    return getProgressChart("cyclingProgressChart", "#progressCyclingMetric");
  }

  function getStrengthChart() {
    return getProgressChart("strengthProgressChart", "#progressStrengthExercise");
  }

  function renderEmptyChart(chart, message) {
    if (!chart) return;
    chart.innerHTML = `<p class="chart-empty">${escapeHtml(message)}</p>`;
  }

  function normalizeDateRange(start, end) {
    if (start && end && start > end) {
      return { start: end, end: start };
    }

    return { start, end };
  }

  function getSelectedDoseDateRange(numericIntakes) {
    const selectedStart = document.querySelector("#progressSupplementDateFrom")?.value || "";
    const selectedEnd = document.querySelector("#progressSupplementDateTo")?.value || "";
    const today = dateKey(new Date());

    if (selectedStart || selectedEnd) {
      return normalizeDateRange(
        selectedStart || numericIntakes[0]?.date || selectedEnd || today,
        selectedEnd || today
      );
    }

    if (!numericIntakes.length) return null;

    const lastRecordDate = numericIntakes[numericIntakes.length - 1].date;
    return {
      start: numericIntakes[0].date,
      end: lastRecordDate > today ? lastRecordDate : today
    };
  }

  function getSelectedCyclingDateRange(numericCycling) {
    const selectedStart = document.querySelector("#progressCyclingDateFrom")?.value || "";
    const selectedEnd = document.querySelector("#progressCyclingDateTo")?.value || "";
    const today = dateKey(new Date());

    if (selectedStart || selectedEnd) {
      return normalizeDateRange(
        selectedStart || numericCycling[0]?.date || selectedEnd || today,
        selectedEnd || today
      );
    }

    if (!numericCycling.length) return null;

    const lastRecordDate = numericCycling[numericCycling.length - 1].date;
    return {
      start: numericCycling[0].date,
      end: lastRecordDate > today ? lastRecordDate : today
    };
  }

  function getSelectedStrengthDateRange(numericStrength) {
    const selectedStart = document.querySelector("#progressStrengthDateFrom")?.value || "";
    const selectedEnd = document.querySelector("#progressStrengthDateTo")?.value || "";
    const today = dateKey(new Date());

    if (!selectedStart && !selectedEnd) return null;

    return normalizeDateRange(
      selectedStart || numericStrength[0]?.date || selectedEnd || today,
      selectedEnd || today
    );
  }

  function buildDosePoints(intakes) {
    const numericIntakes = intakes
      .map((item) => ({
        date: item.date || "",
        time: item.time || "",
        dose: parseDose(item.dose)
      }))
      .filter((item) => item.date && item.dose !== null)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const range = getSelectedDoseDateRange(numericIntakes);
    if (!range) return [];

    const doseByDate = numericIntakes.reduce((acc, item) => {
      acc[item.date] = (acc[item.date] || 0) + item.dose;
      return acc;
    }, {});

    return dateRange(range.start, range.end).map((date) => ({
      date,
      dose: doseByDate[date] || 0
    }));
  }

  function getStrengthTotalReps(item) {
    return (item.sets || []).reduce((sum, set) => {
      const reps = Number(set.reps || 0);
      return Number.isFinite(reps) ? sum + reps : sum;
    }, 0);
  }

  function getStrengthLoadValue(item, bands) {
    if (item.loadMode === "band") {
      const band = bands.find((bandItem) => bandItem.id === item.bandId);
      const level = Number(band?.assistanceLevel);
      return Number.isFinite(level) ? level : null;
    }

    if (item.loadMode === "weight") {
      const weight = Number(item.addedWeightKg);
      return Number.isFinite(weight) ? weight : null;
    }

    return null;
  }

  function getFilteredStrengthWorkouts(workouts, exerciseId) {
    const filteredWorkouts = workouts
      .filter((item) => item.exerciseId === exerciseId && item.date && item.loadMode !== "skip")
      .sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
    const range = getSelectedStrengthDateRange(filteredWorkouts);
    return filteredWorkouts.filter((item) => !range || (item.date >= range.start && item.date <= range.end));
  }

  function buildStrengthRepsPoints(workouts, exerciseId) {
    const repsByDate = getFilteredStrengthWorkouts(workouts, exerciseId)
      .reduce((acc, item) => {
        const reps = getStrengthTotalReps(item);
        if (!reps) return acc;
        acc[item.date] = (acc[item.date] || 0) + reps;
        return acc;
      }, {});

    return Object.keys(repsByDate)
      .sort()
      .map((date) => ({
        date,
        value: repsByDate[date]
      }));
  }

  function buildStrengthLoadPoints(workouts, exerciseId, bands) {
    const loadByDate = getFilteredStrengthWorkouts(workouts, exerciseId)
      .reduce((acc, item) => {
        const load = getStrengthLoadValue(item, bands);
        if (load === null) return acc;
        acc[item.date] = Math.max(acc[item.date] ?? load, load);
        return acc;
      }, {});

    return Object.keys(loadByDate)
      .sort()
      .map((date) => ({
        date,
        value: loadByDate[date]
      }));
  }

  function renderBarChart(chart, points, emptyMessage, ariaLabel) {
    if (!points.length) {
      renderEmptyChart(chart, emptyMessage);
      return;
    }

    const width = Math.max(320, points.length * 54);
    const height = 236;
    const padding = { top: 34, right: 16, bottom: 48, left: 46 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...points.map((item) => item.value));
    const barGap = 10;
    const barWidth = Math.max(18, (innerWidth - barGap * (points.length - 1)) / points.length);

    const bars = points.map((point, index) => {
      const barHeight = maxValue ? (point.value / maxValue) * innerHeight : 0;
      const visibleBarHeight = point.value ? barHeight : 3;
      const x = padding.left + index * (barWidth + barGap);
      const y = padding.top + innerHeight - visibleBarHeight;
      const valueLabel = String(point.value);
      const valueX = x + barWidth / 2;
      const valueY = Math.max(16, y - 8);
      const label = point.value ? `${formatDate(point.date)}: ${point.value}` : `${formatDate(point.date)}: пропуск`;

      return `
        <g>
          <rect class="chart-bar${point.value ? "" : " is-missing"}" x="${x}" y="${y}" width="${barWidth}" height="${visibleBarHeight}" rx="4"></rect>
          <text class="chart-value" x="${valueX}" y="${valueY}" text-anchor="middle">${escapeHtml(valueLabel)}</text>
          <text class="chart-label" x="${x + barWidth / 2}" y="${height - 24}" text-anchor="middle">${escapeHtml(formatDate(point.date))}</text>
          <title>${escapeHtml(label)}</title>
        </g>
      `;
    }).join("");

    chart.innerHTML = `
      <div class="chart-scroll">
        <svg class="dose-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel)}">
          <line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + innerHeight}"></line>
          <line class="chart-axis" x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}"></line>
          <text class="chart-scale" x="${padding.left - 8}" y="${padding.top + 5}" text-anchor="end">${maxValue}</text>
          <text class="chart-scale" x="${padding.left - 8}" y="${padding.top + innerHeight}" text-anchor="end">0</text>
          ${bars}
        </svg>
      </div>
    `;
  }

  function renderDoseChart(intakes) {
    const chart = getDoseChart();
    if (!chart) return;

    const points = buildDosePoints(intakes).map((point) => ({
      date: point.date,
      value: point.dose
    }));

    renderBarChart(chart, points, "Для вибраної добавки поки немає числових доз.", "Діаграма доз добавки");
  }

  function renderStrengthChart(workouts, exercises, bands) {
    const chart = getStrengthChart();
    if (!chart) return;

    const exerciseId = document.querySelector("#progressStrengthExercise")?.value || "";
    const metric = document.querySelector("#progressStrengthMetric")?.value || "reps";
    const exercise = exercises.find((item) => item.id === exerciseId);

    if (!exerciseId) {
      renderEmptyChart(chart, "Додай вправу в довіднику, щоб побачити графік повторів.");
      return;
    }

    if (metric === "reps") {
      const points = buildStrengthRepsPoints(workouts, exerciseId);
      renderBarChart(chart, points, "Для вибраної вправи поки немає записів з повторами.", "Діаграма повторів силової вправи");
      return;
    }

    if (metric === "load") {
      if (exercise?.loadMode === "technical_step") {
        renderEmptyChart(chart, "Для техніки числова шкала ще не задана.");
        return;
      }

      const points = buildStrengthLoadPoints(workouts, exerciseId, bands);
      renderBarChart(chart, points, "Для вибраної вправи поки немає числового навантаження.", "Діаграма навантаження силової вправи");
      return;
    }

    renderEmptyChart(chart, "Індекс прогресу додамо наступним етапом.");
  }

  function getCyclingMetricValue(item, metric) {
    const value = Number(item[metric]);
    if (!Number.isFinite(value)) return null;
    return metric === "averageSpeedKmh" ? Math.round(value * 10) / 10 : value;
  }

  function buildCyclingPoints(cycling, metric) {
    const numericCycling = cycling
      .map((item) => ({
        date: item.date || "",
        time: item.time || "",
        value: getCyclingMetricValue(item, metric)
      }))
      .filter((item) => item.date && item.value !== null)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const range = getSelectedCyclingDateRange(numericCycling);
    if (!range) return [];

    const valuesByDate = numericCycling.reduce((acc, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item.value);
      return acc;
    }, {});

    return dateRange(range.start, range.end).map((date) => {
      const values = valuesByDate[date] || [];
      const total = values.reduce((sum, value) => sum + value, 0);
      const value = metric === "averageSpeedKmh" && values.length
        ? Math.round((total / values.length) * 10) / 10
        : Math.round(total * 100) / 100;

      return { date, value };
    });
  }

  function renderCyclingChart(cycling) {
    const chart = getCyclingChart();
    if (!chart) return;

    const metric = document.querySelector("#progressCyclingMetric")?.value || "durationMinutes";
    const points = buildCyclingPoints(cycling, metric);
    renderBarChart(chart, points, "Поки немає числових велотренувань для графіка.", "Діаграма велотренажера");
  }

  async function renderProgressFilters() {
    const [exercises, bands, supplements, intakes, cycling, strength] = await Promise.all([
      getAll("exercises"),
      getAll("bands"),
      getAll("supplements"),
      getAll("supplementIntakes"),
      getAll("cyclingWorkouts"),
      getAll("strengthWorkouts")
    ]);

    prepareStrengthMetricSelect();
    fillStrengthSelect(exercises);
    ensureStrengthDateFilters();
    renderStrengthChart(strength, exercises, bands);
    ensureCyclingDateFilters();
    renderCyclingChart(cycling);

    const supplementId = fillSupplementSelect(supplements);
    ensureDoseDateFilters();
    if (!supplementId) {
      renderEmptyChart(getDoseChart(), "Додай добавку в довіднику, щоб побачити діаграму.");
      return;
    }

    renderDoseChart(intakes.filter((item) => item.supplementId === supplementId));
  }

  window.addEventListener("DOMContentLoaded", () => {
    renderProgressFilters().catch(() => {});

    document.querySelectorAll("[data-tab='progress'], [data-tab='settings']").forEach((button) => {
      button.addEventListener("click", () => {
        setTimeout(() => renderProgressFilters().catch(() => {}), 0);
      });
    });

    document.addEventListener("change", (event) => {
      if (![
        "progressSupplement",
        "progressSupplementDateFrom",
        "progressSupplementDateTo",
        "progressStrengthExercise",
        "progressStrengthMetric",
        "progressStrengthDateFrom",
        "progressStrengthDateTo",
        "progressCyclingMetric",
        "progressCyclingDateFrom",
        "progressCyclingDateTo"
      ].includes(event.target.id)) return;
      renderProgressFilters().catch(() => {});
    });
  });
})();
