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

  async function enhanceHistoryTable() {
    const table = document.querySelector("#strengthHistoryTable table");
    if (!table) return;

    const headerRow = table.querySelector("thead tr");
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    if (!headerRow || bodyRows.length === 0) return;
    const hasCyclingColumn = Array.from(headerRow.children).some((cell) => cell.textContent.trim() === "Велотренажер");
    if (hasCyclingColumn) return;

    const filter = document.getElementById("strengthHistoryFilter")?.value || "";
    const [strength, cycling] = await Promise.all([
      getAll("strengthWorkouts"),
      getAll("cyclingWorkouts")
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

    const header = document.createElement("th");
    header.dataset.historyCycling = "true";
    header.textContent = "Велотренажер";
    headerRow.insertBefore(header, headerRow.children[5] || null);

    bodyRows.forEach((row, index) => {
      const date = strengthRows[index]?.date;
      const items = (cyclingByDate[date] || []).sort(sortCyclingEntries);
      const cell = document.createElement("td");
      cell.innerHTML = items.length
        ? `<ul class="history-inline-list">${items.map((item) => `<li>${formatCyclingEntry(item)}</li>`).join("")}</ul>`
        : "";
      row.insertBefore(cell, row.children[5] || null);
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
