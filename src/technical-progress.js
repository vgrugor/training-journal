(function () {
  const DB_NAME = "personal-day-journal";
  const DB_VERSION = 1;
  const LEVEL_MIN = 1;
  const LEVEL_MAX = 10;

  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function patchedPut(value, ...args) {
    if (this.name === "strengthWorkouts" && value?.loadMode === "technical_step") {
      const level = Number(document.querySelector("#strengthTechniqueLevel")?.value);
      value = {
        ...value,
        technicalStepLevel: Number.isFinite(level) ? level : null
      };
    }
    return originalPut.call(this, value, ...args);
  };

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

  async function getByKey(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatDate(dateValue) {
    return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" }).format(new Date(`${dateValue}T00:00:00`));
  }

  function ensureTechniqueLevelField() {
    const techniqueField = document.querySelector("#strengthTechniqueField");
    if (!techniqueField) return null;

    let field = document.querySelector("#strengthTechniqueLevelField");
    if (!field) {
      field = document.createElement("label");
      field.id = "strengthTechniqueLevelField";
      field.hidden = true;
      field.innerHTML = `
        <span>Рівень техніки</span>
        <select id="strengthTechniqueLevel"></select>
      `;
      techniqueField.after(field);
    }

    const select = document.querySelector("#strengthTechniqueLevel");
    if (select && !select.options.length) {
      select.innerHTML = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, index) => {
        const value = LEVEL_MIN + index;
        return `<option value="${value}">${value}</option>`;
      }).join("");
      select.value = "1";
    }

    return field;
  }

  async function updateTechniqueLevelVisibility() {
    const field = ensureTechniqueLevelField();
    if (!field) return;

    const exerciseId = document.querySelector("#strengthExercise")?.value || "";
    const exercises = await getAll("exercises");
    const exercise = exercises.find((item) => item.id === exerciseId);
    const usesTechnique = exercise?.loadMode === "technical_step";
    field.hidden = !usesTechnique;

    const select = document.querySelector("#strengthTechniqueLevel");
    if (!usesTechnique && select) {
      select.value = "1";
    } else if (usesTechnique && select && !select.value) {
      select.value = String(exercise.defaultTechniqueLevel || 1);
    }
  }

  function getAverageReps(item) {
    const reps = (item.sets || [])
      .map((set) => Number(set.reps || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!reps.length) return null;
    return reps.reduce((sum, value) => sum + value, 0) / reps.length;
  }

  function getDateRange() {
    const start = document.querySelector("#progressStrengthDateFrom")?.value || "";
    const end = document.querySelector("#progressStrengthDateTo")?.value || "";
    return { start, end };
  }

  function getFilteredTechnicalWorkouts(workouts, exerciseId) {
    const { start, end } = getDateRange();
    return workouts
      .filter((item) => item.exerciseId === exerciseId && item.date && item.loadMode !== "skip")
      .filter((item) => (!start || item.date >= start) && (!end || item.date <= end))
      .sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
  }

  function buildTechnicalLoadPoints(workouts, exerciseId) {
    const loadByDate = getFilteredTechnicalWorkouts(workouts, exerciseId)
      .reduce((acc, item) => {
        const level = Number(item.technicalStepLevel);
        if (!Number.isFinite(level)) return acc;
        acc[item.date] = Math.max(acc[item.date] ?? level, level);
        return acc;
      }, {});

    return Object.keys(loadByDate).sort().map((date) => ({
      date,
      value: loadByDate[date]
    }));
  }

  function buildTechnicalIndexPoints(workouts, exercise) {
    const lower = Number(exercise?.lowerRepTarget);
    const upper = Number(exercise?.upperRepTarget);
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) return [];

    const indexByDate = getFilteredTechnicalWorkouts(workouts, exercise.id)
      .reduce((acc, item) => {
        const level = Number(item.technicalStepLevel);
        const averageReps = getAverageReps(item);
        if (!Number.isFinite(level) || averageReps === null) return acc;

        const repProgress = Math.min(1, Math.max(0, (averageReps - lower) / (upper - lower)));
        const index = Math.round((level + repProgress) * 100) / 100;
        acc[item.date] = Math.max(acc[item.date] ?? index, index);
        return acc;
      }, {});

    return Object.keys(indexByDate).sort().map((date) => ({
      date,
      value: indexByDate[date]
    }));
  }

  function renderEmptyChart(chart, message) {
    chart.innerHTML = `<p class="empty chart-empty">${escapeHtml(message)}</p>`;
  }

  function renderBarChart(chart, points, emptyMessage, ariaLabel) {
    if (!points.length) {
      renderEmptyChart(chart, emptyMessage);
      return;
    }

    const width = Math.max(320, points.length * 54);
    const height = 236;
    const padding = { top: 34, right: 16, bottom: 48, left: 46 };
    const innerHeight = height - padding.top - padding.bottom;
    const innerWidth = width - padding.left - padding.right;
    const maxValue = Math.max(...points.map((item) => item.value));
    const barGap = 10;
    const barWidth = Math.max(18, (innerWidth - barGap * (points.length - 1)) / points.length);

    const bars = points.map((point, index) => {
      const barHeight = maxValue ? (point.value / maxValue) * innerHeight : 0;
      const x = padding.left + index * (barWidth + barGap);
      const y = padding.top + innerHeight - barHeight;
      return `
        <g>
          <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(3, barHeight)}" rx="5"></rect>
          <text class="chart-value" x="${x + barWidth / 2}" y="${Math.max(16, y - 8)}" text-anchor="middle">${escapeHtml(String(point.value))}</text>
          <text class="chart-label" x="${x + barWidth / 2}" y="${height - 24}" text-anchor="middle">${escapeHtml(formatDate(point.date))}</text>
          <title>${escapeHtml(`${formatDate(point.date)}: ${point.value}`)}</title>
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

  function renderLineChart(chart, points, emptyMessage, ariaLabel) {
    if (!points.length) {
      renderEmptyChart(chart, emptyMessage);
      return;
    }

    const width = Math.max(320, points.length * 54);
    const height = 236;
    const padding = { top: 34, right: 18, bottom: 48, left: 46 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...points.map((item) => item.value));
    const minValue = Math.min(...points.map((item) => item.value));
    const valueRange = maxValue - minValue || 1;
    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
    const lastPoint = points[points.length - 1];
    const coordinates = points.map((point, index) => {
      const x = points.length > 1 ? padding.left + index * step : padding.left + innerWidth / 2;
      const y = padding.top + innerHeight - ((point.value - minValue) / valueRange) * innerHeight;
      return { ...point, x, y };
    });
    const linePath = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    const dots = coordinates.map((point) => {
      const isLast = point.date === lastPoint.date && point.value === lastPoint.value;
      return `
        <g>
          <circle class="chart-line-dot${isLast ? " is-last" : ""}" cx="${point.x}" cy="${point.y}" r="${isLast ? 4 : 3}"></circle>
          ${isLast ? `<text class="chart-value" x="${point.x}" y="${Math.max(16, point.y - 12)}" text-anchor="middle">${escapeHtml(String(point.value))}</text>` : ""}
          <text class="chart-label" x="${point.x}" y="${height - 24}" text-anchor="middle">${escapeHtml(formatDate(point.date))}</text>
          <title>${escapeHtml(`${formatDate(point.date)}: ${point.value}`)}</title>
        </g>
      `;
    }).join("");

    chart.innerHTML = `
      <div class="chart-scroll">
        <svg class="dose-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel)}">
          <line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + innerHeight}"></line>
          <line class="chart-axis" x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}"></line>
          <text class="chart-scale" x="${padding.left - 8}" y="${padding.top + 5}" text-anchor="end">${maxValue}</text>
          <text class="chart-scale" x="${padding.left - 8}" y="${padding.top + innerHeight}" text-anchor="end">${minValue}</text>
          <path class="chart-line" d="${linePath}"></path>
          ${dots}
        </svg>
      </div>
    `;
  }

  async function renderTechnicalStrengthChart() {
    const chart = document.querySelector("#strengthProgressChart");
    const exerciseId = document.querySelector("#progressStrengthExercise")?.value || "";
    const metric = document.querySelector("#progressStrengthMetric")?.value || "reps";
    if (!chart || !exerciseId || metric === "reps") return;

    const [exercises, workouts] = await Promise.all([
      getAll("exercises"),
      getAll("strengthWorkouts")
    ]);
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (exercise?.loadMode !== "technical_step") return;

    if (metric === "load") {
      renderBarChart(
        chart,
        buildTechnicalLoadPoints(workouts, exerciseId),
        "Для вибраної вправи поки немає записів із рівнем техніки.",
        "Діаграма рівня техніки силової вправи"
      );
      return;
    }

    renderLineChart(
      chart,
      buildTechnicalIndexPoints(workouts, exercise),
      "Для вибраної вправи поки немає даних для індексу.",
      "Діаграма індексу силової вправи"
    );
  }

  function scheduleTechnicalChartRender() {
    window.setTimeout(() => {
      renderTechnicalStrengthChart().catch(() => {});
    }, 0);
  }

  function bind() {
    ensureTechniqueLevelField();
    updateTechniqueLevelVisibility().catch(() => {});
    scheduleTechnicalChartRender();

    document.querySelector("#strengthExercise")?.addEventListener("change", () => {
      window.setTimeout(() => updateTechniqueLevelVisibility().catch(() => {}), 0);
    });

    document.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-strength]");
      if (editButton) {
        window.setTimeout(async () => {
          ensureTechniqueLevelField();
          const record = await getByKey("strengthWorkouts", editButton.dataset.editStrength);
          if (record?.technicalStepLevel) {
            document.querySelector("#strengthTechniqueLevel").value = String(record.technicalStepLevel);
          }
          await updateTechniqueLevelVisibility();
        }, 0);
      }
    });

    [
      "#progressStrengthExercise",
      "#progressStrengthMetric",
      "#progressStrengthDateFrom",
      "#progressStrengthDateTo"
    ].forEach((selector) => {
      document.querySelector(selector)?.addEventListener("change", scheduleTechnicalChartRender);
    });
  }

  if (document.readyState === "complete") {
    bind();
  } else {
    window.addEventListener("load", bind);
  }
})();
