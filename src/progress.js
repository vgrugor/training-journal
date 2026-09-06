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

  async function renderProgressFilters() {
    const [exercises, supplements] = await Promise.all([
      getAll("exercises"),
      getAll("supplements")
    ]);

    fillSelect("#progressStrengthExercise", exercises, "Всі вправи");
    fillSelect("#progressSupplement", supplements, "Всі добавки");
  }

  window.addEventListener("DOMContentLoaded", () => {
    renderProgressFilters().catch(() => {});

    document.querySelectorAll("[data-tab='progress'], [data-tab='settings']").forEach((button) => {
      button.addEventListener("click", () => {
        setTimeout(() => renderProgressFilters().catch(() => {}), 0);
      });
    });
  });
})();
