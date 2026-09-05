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

  function sortCyclingEntries(a, b) {
    return (a.time || "").localeCompare(b.time || "") || (a.createdAt || "").localeCompare(b.createdAt || "");
  }

  function sortIntakeEntries(a, b) {
    return (a.time || "").localeCompare(b.time || "") || (a.createdAt || "").localeCompare(b.createdAt || "");
  }

  function sortStrengthHistory(a, b) {
    return (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatCyclingEntry(item) {
    return `${item.time ? `${escapeHtml(item.time)} · ` : ""}${item.durationMinutes || 0} хв, ${item.distanceKm || 0} км, ${item.averageSpeedKmh || 0} км/год${item.load ? ` · навантаження ${item.load}` : ""}`;
  }

  function formatIntakeEntry(item, supplements) {
    const supplementName = supplements.find((supplement) => supplement.id === item.supplementId)?.name || "Не вказано";
    return `${escapeHtml(item.time || "--:--")} · ${escapeHtml(supplementName)} · ${escapeHtml(item.dose || "")}`;
  }

  async function enhanceHistoryTable() {
    const table = document.querySelector("#strengthHistoryTable table");
    if (!table) return;

    const headerRow = table.querySelector("thead tr");
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    if (!headerRow || bodyRows.length === 0) return;
    const hasCyclingColumn = Array.from(headerRow.children).some((cell) => cell.textContent.trim() === "Велотренажер");
    const hasIntakeColumn = Array.from(headerRow.children).some((cell) => cell.textContent.trim() === "Добавки");
    if (hasCyclingColumn && hasIntakeColumn) return;

    const filter = document.getElementById("strengthHistoryFilter")?.value || "";
    const [strength, cycling, intakes, supplements] = await Promise.all([
      getAll("strengthWorkouts"),
      getAll("cyclingWorkouts"),
      getAll("supplementIntakes"),
      getAll("supplements")
    ]);
    const strengthRows = strength
      .filter((item) => !filter || item.exerciseId === filter)
      .sort(sortStrengthHistory);
    const cyclingByDate = cycling.reduce((acc, item) => {
      if (!item.date) return acc;
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});
    const intakesByDate = intakes.reduce((acc, item) => {
      if (!item.date) return acc;
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});

    if (!hasCyclingColumn) {
      const header = document.createElement("th");
      header.textContent = "Велотренажер";
      headerRow.insertBefore(header, headerRow.children[5] || null);
    }

    if (!hasIntakeColumn) {
      const header = document.createElement("th");
      header.textContent = "Добавки";
      headerRow.insertBefore(header, headerRow.children[hasCyclingColumn ? 6 : 6] || null);
    }

    bodyRows.forEach((row, index) => {
      const date = strengthRows[index]?.date;
      if (!hasCyclingColumn) {
        const items = (cyclingByDate[date] || []).sort(sortCyclingEntries);
        const cell = document.createElement("td");
        cell.innerHTML = items.length
          ? `<ul class="history-inline-list">${items.map((item) => `<li>${formatCyclingEntry(item)}</li>`).join("")}</ul>`
          : "";
        row.insertBefore(cell, row.children[5] || null);
      }

      if (!hasIntakeColumn) {
        const items = (intakesByDate[date] || []).sort(sortIntakeEntries);
        const cell = document.createElement("td");
        cell.innerHTML = items.length
          ? `<ul class="history-inline-list">${items.map((item) => `<li>${formatIntakeEntry(item, supplements)}</li>`).join("")}</ul>`
          : "";
        row.insertBefore(cell, row.children[hasCyclingColumn ? 6 : 6] || null);
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    const title = document.querySelector("#strengthHistoryPanel .panel-title h2");
    if (title) title.textContent = "Історія";

    const target = document.getElementById("strengthHistoryTable");
    if (!target) return;

    const observer = new MutationObserver(() => {
      enhanceHistoryTable().catch(() => {});
    });
    observer.observe(target, { childList: true, subtree: true });
    enhanceHistoryTable().catch(() => {});
  });
})();
