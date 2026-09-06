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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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

  function formatDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}.${month}`;
  }

  function normalizeDateRange(start, end) {
    if (start && end && start > end) return { start: end, end: start };
    return { start, end };
  }

  function getSelectedCyclingDateRange(items) {
    const selectedStart = document.querySelector("#progressCyclingDateFrom")?.value || "";
    const selectedEnd = document.querySelector("#progressCyclingDateTo")?.value || "";
    const today = dateKey(new Date());

    if (selectedStart || selectedEnd) {
      return normalizeDateRange(
        selectedStart || items[0]?.date || selectedEnd || today,
        selectedEnd || today
      );
    }

    if (!items.length) return null;
    const lastRecordDate = items[items.length - 1].date;
    return {
      start: items[0].date,
      end: lastRecordDate > today ? lastRecordDate : today
    };
  }

  function getCyclingIndex(item) {
    const duration = Number(item.durationMinutes);
    const load = Number(item.load);
    const speed = Number(item.averageSpeedKmh);
    if (!Number.isFinite(duration) || !Number.isFinite(load) || !Number.isFinite(speed)) return null;
    if (duration <= 0 || load <= 0 || speed <= 0) return null;
    return Math.round((duration * load * speed / 10) * 100) / 100;
  }

  function buildCyclingIndexPoints(cycling) {
    const numericCycling = cycling
      .map((item) => ({
        date: item.date || "",
        time: item.time || "",
        value: getCyclingIndex(item)
      }))
      .filter((item) => item.date && item.value !== null)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const range = getSelectedCyclingDateRange(numericCycling);
    if (!range) return [];

    const indexByDate = numericCycling.reduce((acc, item) => {
      acc[item.date] = (acc[item.date] || 0) + item.value;
      return acc;
    }, {});

    return dateRange(range.start, range.end).map((date) => ({
      date,
      value: Math.round((indexByDate[date] || 0) * 100) / 100
    }));
  }

  function renderEmptyChart(chart, message) {
    chart.innerHTML = `<p class="chart-empty">${escapeHtml(message)}</p>`;
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
      const label = point.value ? `${formatDate(point.date)}: ${point.value}` : `${formatDate(point.date)}: пропуск`;
      return `
        <g>
          <rect class="chart-bar${point.value ? "" : " is-missing"}" x="${x}" y="${y}" width="${barWidth}" height="${visibleBarHeight}" rx="4"></rect>
          <text class="chart-value" x="${x + barWidth / 2}" y="${Math.max(16, y - 8)}" text-anchor="middle">${escapeHtml(String(point.value))}</text>
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

  function ensureCyclingOptions() {
    const select = document.querySelector("#progressCyclingMetric");
    if (!select) return;

    [
      { value: "load", label: "Навантаження" },
      { value: "cyclingIndex", label: "Індекс" }
    ].forEach((item) => {
      if (select.querySelector(`option[value="${item.value}"]`)) return;
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  async function renderCyclingIndexChart() {
    const metric = document.querySelector("#progressCyclingMetric")?.value || "";
    if (metric !== "cyclingIndex") return;

    const chart = document.querySelector("#cyclingProgressChart");
    if (!chart) return;

    const cycling = await getAll("cyclingWorkouts");
    renderBarChart(
      chart,
      buildCyclingIndexPoints(cycling),
      "Поки немає велотренувань з тривалістю, швидкістю і навантаженням для індексу.",
      "Діаграма індексу велотренажера"
    );
  }

  function scheduleRender() {
    window.setTimeout(() => {
      ensureCyclingOptions();
      renderCyclingIndexChart().catch(() => {});
    }, 0);
  }

  function bind() {
    ensureCyclingOptions();
    scheduleRender();

    const progressButton = document.querySelector("[data-tab='progress']");
    progressButton?.addEventListener("click", scheduleRender);

    [
      "#progressCyclingMetric",
      "#progressCyclingDateFrom",
      "#progressCyclingDateTo"
    ].forEach((selector) => {
      document.querySelector(selector)?.addEventListener("change", scheduleRender);
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
