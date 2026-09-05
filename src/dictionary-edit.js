(function () {
  const DB_NAME = "personal-day-journal";
  const DB_VERSION = 1;
  const state = {
    exercises: null,
    bands: null,
    supplements: null
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
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

  async function put(storeName, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  function numberOrNull(value) {
    return value === "" ? null : Number(value);
  }

  function setButtonText(formId, text) {
    const button = document.querySelector(`#${formId} button[type='submit']`);
    if (button) button.textContent = text;
  }

  function clearForm(formId, key, buttonText) {
    state[key] = null;
    document.getElementById(formId)?.reset();
    setButtonText(formId, buttonText);
  }

  function prepareChipButtons() {
    document.querySelectorAll("#exerciseList .chip").forEach((chip) => {
      if (chip.querySelector("[data-dictionary-edit]")) return;
      const text = chip.querySelector("span");
      if (!text) return;
      const id = chip.querySelector("[data-delete-id]")?.dataset.deleteId || "";
      const button = document.createElement("button");
      button.className = "chip-edit";
      button.type = "button";
      button.dataset.dictionaryEdit = "exercises";
      button.dataset.dictionaryId = id;
      button.textContent = text.textContent;
      text.replaceWith(button);
    });

    document.querySelectorAll("#bandList .chip").forEach((chip) => {
      if (chip.querySelector("[data-dictionary-edit]")) return;
      const text = chip.querySelector("span");
      if (!text) return;
      const id = chip.querySelector("[data-delete-id]")?.dataset.deleteId || "";
      const button = document.createElement("button");
      button.className = "chip-edit";
      button.type = "button";
      button.dataset.dictionaryEdit = "bands";
      button.dataset.dictionaryId = id;
      button.textContent = text.textContent;
      text.replaceWith(button);
    });

    document.querySelectorAll("#supplementList .chip").forEach((chip) => {
      if (chip.querySelector("[data-dictionary-edit]")) return;
      const text = chip.querySelector("span");
      if (!text) return;
      const id = chip.querySelector("[data-delete-id]")?.dataset.deleteId || "";
      const button = document.createElement("button");
      button.className = "chip-edit";
      button.type = "button";
      button.dataset.dictionaryEdit = "supplements";
      button.dataset.dictionaryId = id;
      button.textContent = text.textContent;
      text.replaceWith(button);
    });
  }

  async function editDictionaryItem(button) {
    const store = button.dataset.dictionaryEdit;
    const id = button.dataset.dictionaryId;
    const item = await getByKey(store, id);
    if (!item) return;

    if (store === "exercises") {
      state.exercises = item.id;
      document.getElementById("exerciseName").value = item.name || "";
      document.getElementById("exerciseLower").value = item.lowerRepTarget ?? "";
      document.getElementById("exerciseUpper").value = item.upperRepTarget ?? "";
      setButtonText("exerciseForm", "Оновити вправу");
      document.getElementById("exerciseForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (store === "bands") {
      state.bands = item.id;
      document.getElementById("bandName").value = item.name || "";
      document.getElementById("bandLevel").value = item.assistanceLevel ?? "";
      setButtonText("bandForm", "Оновити резинку");
      document.getElementById("bandForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (store === "supplements") {
      state.supplements = item.id;
      document.getElementById("supplementName").value = item.name || "";
      document.getElementById("supplementDose").value = item.defaultDose || "";
      setButtonText("supplementForm", "Оновити добавку");
      document.getElementById("supplementForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindFormOverrides() {
    document.getElementById("exerciseForm")?.addEventListener("submit", async (event) => {
      if (!state.exercises) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const existing = await getByKey("exercises", state.exercises);
      if (!existing) return;
      const name = document.getElementById("exerciseName").value.trim();
      if (!name) return;
      await put("exercises", {
        ...existing,
        name,
        lowerRepTarget: numberOrNull(document.getElementById("exerciseLower").value) || 5,
        upperRepTarget: numberOrNull(document.getElementById("exerciseUpper").value) || 10
      });
      clearForm("exerciseForm", "exercises", "Додати вправу");
      window.location.reload();
    }, true);

    document.getElementById("bandForm")?.addEventListener("submit", async (event) => {
      if (!state.bands) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const existing = await getByKey("bands", state.bands);
      if (!existing) return;
      const name = document.getElementById("bandName").value.trim();
      if (!name) return;
      await put("bands", {
        ...existing,
        name,
        assistanceLevel: numberOrNull(document.getElementById("bandLevel").value) || 0
      });
      clearForm("bandForm", "bands", "Додати резинку");
      window.location.reload();
    }, true);

    document.getElementById("supplementForm")?.addEventListener("submit", async (event) => {
      if (!state.supplements) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const existing = await getByKey("supplements", state.supplements);
      if (!existing) return;
      const name = document.getElementById("supplementName").value.trim();
      if (!name) return;
      await put("supplements", {
        ...existing,
        name,
        defaultDose: document.getElementById("supplementDose").value.trim()
      });
      clearForm("supplementForm", "supplements", "Додати добавку");
      window.location.reload();
    }, true);
  }

  window.addEventListener("DOMContentLoaded", () => {
    bindFormOverrides();
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dictionary-edit]");
      if (button) editDictionaryItem(button).catch(() => {});
    });

    const settings = document.getElementById("settingsPanel");
    if (!settings) return;
    const observer = new MutationObserver(prepareChipButtons);
    observer.observe(settings, { childList: true, subtree: true });
    prepareChipButtons();
  });
})();
