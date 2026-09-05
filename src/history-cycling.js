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
    const headers = Array.from(headerRow.children);
    const cyclingIndex = headers.findIndex((cell) => cell.textContent.trim() === "Велотренажер");
    const intakeIndex = headers.findIndex((cell) => cell.textContent.trim() === "Добавки");
    const noteIndex = headers.findIndex((cell) => cell.textContent.trim() === "Нотатка");
    const isOrdered = noteIndex >= 0 && cyclingIndex === noteIndex + 1 && intakeIndex === cyclingIndex + 1;
    if (isOrdered) return;

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

    bodyRows.forEach((row, index) => {
      const date = strengthRows[index]?.date;
      const cyclingItems = (cyclingByDate[date] || []).sort(sortCyclingEntries);
      const intakeItems = (intakesByDate[date] || []).sort(sortIntakeEntries);
      const cyclingCell = cyclingIndex >= 0 ? row.children[cyclingIndex] : document.createElement("td");
      const intakeCell = intakeIndex >= 0 ? row.children[intakeIndex] : document.createElement("td");

      cyclingCell.innerHTML = cyclingItems.length
        ? `<ul class="history-inline-list">${cyclingItems.map((item) => `<li>${formatCyclingEntry(item)}</li>`).join("")}</ul>`
        : "";
      intakeCell.innerHTML = intakeItems.length
        ? `<ul class="history-inline-list">${intakeItems.map((item) => `<li>${formatIntakeEntry(item, supplements)}</li>`).join("")}</ul>`
        : "";

      row.appendChild(cyclingCell);
      row.appendChild(intakeCell);
    });

    const cyclingHeader = cyclingIndex >= 0 ? headerRow.children[cyclingIndex] : document.createElement("th");
    const intakeHeader = intakeIndex >= 0 ? headerRow.children[intakeIndex] : document.createElement("th");
    cyclingHeader.textContent = "Велотренажер";
    intakeHeader.textContent = "Добавки";
    headerRow.appendChild(cyclingHeader);
    headerRow.appendChild(intakeHeader);
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
