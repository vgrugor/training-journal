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

  function renderEmptyChart(message) {
    const chart = document.querySelector("#supplementDoseChart");
    if (!chart) return;
    chart.innerHTML = `<p class="chart-empty">${escapeHtml(message)}</p>`;
  }

  function renderDoseChart(intakes) {
    const chart = document.querySelector("#supplementDoseChart");
    if (!chart) return;

    const points = intakes
      .map((item) => ({
        date: item.date || "",
        time: item.time || "",
        dose: parseDose(item.dose)
      }))
      .filter((item) => item.dose !== null)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    if (!points.length) {
      renderEmptyChart("Для вибраної добавки поки немає числових доз.");
      return;
    }

    const width = Math.max(320, points.length * 54);
    const height = 220;
    const padding = { top: 18, right: 16, bottom: 48, left: 46 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxDose = Math.max(...points.map((item) => item.dose));
    const barGap = 10;
    const barWidth = Math.max(18, (innerWidth - barGap * (points.length - 1)) / points.length);

    const bars = points.map((point, index) => {
      const barHeight = maxDose ? (point.dose / maxDose) * innerHeight : 0;
      const x = padding.left + index * (barWidth + barGap);
      const y = padding.top + innerHeight - barHeight;
      const label = `${formatDate(point.date)}${point.time ? ` ${point.time}` : ""}`;

      return `
        <g>
          <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"></rect>
          <text class="chart-value" x="${x + barWidth / 2}" y="${Math.max(14, y - 6)}" text-anchor="middle">${point.dose}</text>
          <text class="chart-label" x="${x + barWidth / 2}" y="${height - 24}" text-anchor="middle">${escapeHtml(formatDate(point.date))}</text>
          <title>${escapeHtml(label)}: ${point.dose}</title>
        </g>
      `;
    }).join("");

    chart.innerHTML = `
      <div class="chart-scroll">
        <svg class="dose-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Діаграма доз добавки">
          <line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + innerHeight}"></line>
          <line class="chart-axis" x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}"></line>
          <text class="chart-scale" x="${padding.left - 8}" y="${padding.top + 5}" text-anchor="end">${maxDose}</text>
          <text class="chart-scale" x="${padding.left - 8}" y="${padding.top + innerHeight}" text-anchor="end">0</text>
          ${bars}
        </svg>
      </div>
    `;
  }

  async function renderProgressFilters() {
    const [exercises, supplements, intakes] = await Promise.all([
      getAll("exercises"),
      getAll("supplements"),
      getAll("supplementIntakes")
    ]);

    fillSelect("#progressStrengthExercise", exercises, "Всі вправи");

    const supplementId = fillSupplementSelect(supplements);
    if (!supplementId) {
      renderEmptyChart("Додай добавку в довіднику, щоб побачити діаграму.");
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

    document.querySelector("#progressSupplement")?.addEventListener("change", () => {
      renderProgressFilters().catch(() => {});
    });
  });
})();
