(function () {
  const DB_NAME = "personal-day-journal";
  const DB_VERSION = 1;
  let editingStrengthId = null;

  function currentTime() {
    return new Date().toTimeString().slice(0, 5);
  }

  function ensureStrengthTimeField() {
    const form = document.getElementById("strengthForm");
    if (!form || document.getElementById("strengthTime")) return;

    const label = document.createElement("label");
    label.innerHTML = '<span>Час</span><input id="strengthTime" type="time" />';
    form.insertBefore(label, form.firstElementChild);
  }

  function setDefaultStrengthTime() {
    const input = document.getElementById("strengthTime");
    if (input && !input.value) input.value = currentTime();
  }

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

  async function put(storeName, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getStrengthRecord(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("strengthWorkouts").objectStore("strengthWorkouts").get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveStrengthTime({ id, date, exerciseId, time }) {
    if (!time) return;

    let record = id ? await getStrengthRecord(id) : null;
    if (!record) {
      const rows = await getAll("strengthWorkouts");
      record = rows
        .filter((item) => item.date === date && item.exerciseId === exerciseId)
        .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))[0];
    }

    if (record && record.time !== time) {
      await put("strengthWorkouts", { ...record, time, updatedAt: new Date().toISOString() });
    }
  }

  function hasTimePrefix(text) {
    return /^\d{2}:\d{2}\s·\s/.test(text.trim());
  }

  function sortStrengthHistory(a, b) {
    return (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "");
  }

  async function enhanceStrengthTimeDisplay() {
    const strength = await getAll("strengthWorkouts");
    const date = document.getElementById("selectedDate")?.value || "";
    const todayRows = strength
      .filter((item) => item.date === date)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

    document.querySelectorAll("#strengthList [data-edit-strength]").forEach((button) => {
      const record = strength.find((item) => item.id === button.dataset.editStrength);
      const title = button.closest(".entry")?.querySelector("strong");
      if (record?.time && title && !hasTimePrefix(title.textContent)) {
        title.textContent = `${record.time} · ${title.textContent.trim()}`;
      }
    });

    const summaryList = Array.from(document.querySelectorAll("#summaryPanel article"))
      .find((article) => article.querySelector("h3")?.textContent.trim() === "Силові")
      ?.querySelector("ul");
    if (summaryList) {
      Array.from(summaryList.children).forEach((item, index) => {
        const record = todayRows[index];
        if (record?.time && !hasTimePrefix(item.textContent)) {
          item.innerHTML = `${record.time} · ${item.innerHTML}`;
        }
      });
    }

    const table = document.querySelector("#strengthHistoryTable table");
    const headerRow = table?.querySelector("thead tr");
    const bodyRows = Array.from(table?.querySelectorAll("tbody tr") || []);
    if (!table || !headerRow || bodyRows.length === 0) return;

    let headers = Array.from(headerRow.children);
    let timeIndex = headers.findIndex((cell) => cell.textContent.trim() === "Час");
    if (timeIndex < 0) {
      const header = document.createElement("th");
      header.textContent = "Час";
      headerRow.insertBefore(header, headerRow.children[1] || null);
      timeIndex = 1;
    }

    const filter = document.getElementById("strengthHistoryFilter")?.value || "";
    const historyRows = strength
      .filter((item) => !filter || item.exerciseId === filter)
      .sort(sortStrengthHistory);

    bodyRows.forEach((row, index) => {
      let cell = row.children[timeIndex];
      if (!cell || row.children.length < headerRow.children.length) {
        cell = document.createElement("td");
        row.insertBefore(cell, row.children[timeIndex] || null);
      }
      const time = historyRows[index]?.time || "";
      if (cell.textContent !== time) cell.textContent = time;
    });
  }

  function bindStrengthTime() {
    ensureStrengthTimeField();
    setDefaultStrengthTime();

    document.addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit-strength]");
      if (editButton) {
        editingStrengthId = editButton.dataset.editStrength || null;
        window.setTimeout(async () => {
          const record = editingStrengthId ? await getStrengthRecord(editingStrengthId) : null;
          const input = document.getElementById("strengthTime");
          if (input) input.value = record?.time || "";
        }, 0);
      }

      if (event.target.closest("#clearStrength")) {
        editingStrengthId = null;
        window.setTimeout(setDefaultStrengthTime, 0);
      }
    });

    document.getElementById("strengthForm")?.addEventListener("submit", () => {
      const payload = {
        id: editingStrengthId,
        date: document.getElementById("selectedDate")?.value || "",
        exerciseId: document.getElementById("strengthExercise")?.value || "",
        time: document.getElementById("strengthTime")?.value || ""
      };
      editingStrengthId = null;
      [300, 800, 1400].forEach((delay) => {
        window.setTimeout(() => {
          saveStrengthTime(payload).catch(() => {});
          enhanceStrengthTimeDisplay().catch(() => {});
          setDefaultStrengthTime();
        }, delay);
      });
    });

    const renderTargets = [
      document.getElementById("strengthList"),
      document.getElementById("summaryPanel"),
      document.getElementById("strengthHistoryTable")
    ].filter(Boolean);
    const observer = new MutationObserver(() => {
      enhanceStrengthTimeDisplay().catch(() => {});
    });
    renderTargets.forEach((target) => observer.observe(target, { childList: true, subtree: true }));
    enhanceStrengthTimeDisplay().catch(() => {});
  }

  window.addEventListener("DOMContentLoaded", bindStrengthTime);
})();
