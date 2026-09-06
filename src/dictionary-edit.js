(function () {
  const DB_NAME = "personal-day-journal";
  const DB_VERSION = 1;
  const state = {
    exercises: null,
    bands: null,
    supplements: null
  };

  const LOAD_MODES = [
    { value: "band", label: "Гумка" },
    { value: "weight", label: "Додаткова вага" },
    { value: "technical_step", label: "Техніка" },
    { value: "skip", label: "Пропуск" }
  ];

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

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function numberOrNull(value) {
    return value === "" ? null : Number(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setButtonText(formId, text) {
    const button = document.querySelector(`#${formId} button[type='submit']`);
    if (button) button.textContent = text;
  }

  function reloadSettingsTab() {
    sessionStorage.setItem("training-journal-active-tab", "settings");
    window.location.reload();
  }

  function restoreActiveTab() {
    const tabName = sessionStorage.getItem("training-journal-active-tab");
    if (!tabName) return;
    sessionStorage.removeItem("training-journal-active-tab");
    window.setTimeout(() => {
      document.querySelector(`[data-tab="${tabName}"]`)?.click();
    }, 0);
  }

  function ensureExerciseFields() {
    const form = document.getElementById("exerciseForm");
    const lower = document.getElementById("exerciseLower");
    if (!form || !lower || document.getElementById("exerciseLoadMode")) return;

    const fields = document.createElement("div");
    fields.className = "dictionary-extra-fields";
    fields.innerHTML = `
      <label>
        <span>Тип навантаження</span>
        <select id="exerciseLoadMode">
          ${LOAD_MODES.map((item) => `<option value="${item.value}">${escapeHtml(item.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Підходи за замовчуванням</span>
        <select id="exerciseDefaultSets">
          ${Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("")}
        </select>
      </label>
      <label id="exerciseDefaultTechniqueField" hidden>
        <span>Техніка за замовчуванням</span>
        <input id="exerciseDefaultTechnique" type="text" />
      </label>
      <label id="exerciseDefaultTechniqueLevelField" hidden>
        <span>Рівень техніки</span>
        <select id="exerciseDefaultTechniqueLevel">
          ${Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("")}
        </select>
      </label>
    `;

    lower.closest(".form-grid")?.after(fields);
    document.getElementById("exerciseLoadMode")?.addEventListener("change", updateExerciseModeFields);
    updateExerciseModeFields();
  }

  function updateExerciseModeFields() {
    const mode = document.getElementById("exerciseLoadMode")?.value || "band";
    const isSkip = mode === "skip";
    const usesTechnique = mode === "technical_step";
    const lower = document.getElementById("exerciseLower");
    const upper = document.getElementById("exerciseUpper");
    const sets = document.getElementById("exerciseDefaultSets");

    if (lower) lower.disabled = isSkip;
    if (upper) upper.disabled = isSkip;
    if (sets) sets.disabled = isSkip;
    const techniqueField = document.getElementById("exerciseDefaultTechniqueField");
    const levelField = document.getElementById("exerciseDefaultTechniqueLevelField");
    if (techniqueField) techniqueField.hidden = !usesTechnique;
    if (levelField) levelField.hidden = !usesTechnique;
  }

  function clearForm(formId, key, buttonText) {
    state[key] = null;
    document.getElementById(formId)?.reset();
    setButtonText(formId, buttonText);
    if (formId === "exerciseForm") updateExerciseModeFields();
  }

  function prepareChipButtons() {
    document.querySelectorAll("#exerciseList .chip").forEach((chip) => {
      if (chip.querySelector("[data-dictionary-edit]")) return;
      const oldButton = chip.querySelector("[data-edit-dictionary='exercises']");
      const text = oldButton || chip.querySelector("span");
      const id = oldButton?.dataset.editId || chip.querySelector("[data-delete-id]")?.dataset.deleteId || "";
      if (!text || !id) return;

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
      const oldButton = chip.querySelector("[data-edit-dictionary='bands']");
      const text = oldButton || chip.querySelector("span");
      const id = oldButton?.dataset.editId || chip.querySelector("[data-delete-id]")?.dataset.deleteId || "";
      if (!text || !id) return;

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
      const oldButton = chip.querySelector("[data-edit-dictionary='supplements']");
      const text = oldButton || chip.querySelector("span");
      const id = oldButton?.dataset.editId || chip.querySelector("[data-delete-id]")?.dataset.deleteId || "";
      if (!text || !id) return;

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
      ensureExerciseFields();
      document.getElementById("exerciseName").value = item.name || "";
      document.getElementById("exerciseLower").value = item.lowerRepTarget ?? "";
      document.getElementById("exerciseUpper").value = item.upperRepTarget ?? "";
      document.getElementById("exerciseLoadMode").value = item.loadMode || "band";
      document.getElementById("exerciseDefaultSets").value = String(item.defaultSets || 5);
      document.getElementById("exerciseDefaultTechnique").value = item.defaultTechnique || "";
      document.getElementById("exerciseDefaultTechniqueLevel").value = String(item.defaultTechniqueLevel || 1);
      updateExerciseModeFields();
      setButtonText("exerciseForm", "Оновити вправу");
      document.getElementById("exerciseForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (store === "bands") {
      state.bands = item.id;
      document.getElementById("bandName").value = item.name || "";
      document.getElementById("bandLevel").value = item.assistanceLevel ?? "";
      setButtonText("bandForm", "Оновити гумку");
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
      event.preventDefault();
      event.stopImmediatePropagation();

      ensureExerciseFields();
      const existing = state.exercises ? await getByKey("exercises", state.exercises) : null;
      const name = document.getElementById("exerciseName").value.trim();
      const loadMode = document.getElementById("exerciseLoadMode")?.value || existing?.loadMode || "band";
      const isSkip = loadMode === "skip";
      const usesTechnique = loadMode === "technical_step";
      if (!name) return;

      await put("exercises", {
        ...existing,
        id: existing?.id || createId("exercise"),
        name,
        category: existing?.category || (isSkip ? "Пропуск" : "custom"),
        lowerRepTarget: isSkip ? null : numberOrNull(document.getElementById("exerciseLower").value) || 5,
        upperRepTarget: isSkip ? null : numberOrNull(document.getElementById("exerciseUpper").value) || 10,
        defaultSets: isSkip ? 0 : numberOrNull(document.getElementById("exerciseDefaultSets").value) || 5,
        loadMode,
        defaultTechnique: usesTechnique ? document.getElementById("exerciseDefaultTechnique").value.trim() : "",
        defaultTechniqueLevel: usesTechnique ? numberOrNull(document.getElementById("exerciseDefaultTechniqueLevel").value) || 1 : null,
        notes: existing?.notes || ""
      });

      clearForm("exerciseForm", "exercises", "Додати вправу");
      reloadSettingsTab();
    }, true);

    document.getElementById("bandForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const existing = state.bands ? await getByKey("bands", state.bands) : null;
      const name = document.getElementById("bandName").value.trim();
      if (!name) return;

      await put("bands", {
        ...existing,
        id: existing?.id || createId("band"),
        name,
        assistanceLevel: numberOrNull(document.getElementById("bandLevel").value) || 0,
        notes: existing?.notes || ""
      });

      clearForm("bandForm", "bands", "Додати гумку");
      reloadSettingsTab();
    }, true);

    document.getElementById("supplementForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const existing = state.supplements ? await getByKey("supplements", state.supplements) : null;
      const name = document.getElementById("supplementName").value.trim();
      if (!name) return;

      await put("supplements", {
        ...existing,
        id: existing?.id || createId("supplement"),
        name,
        defaultDose: document.getElementById("supplementDose").value.trim(),
        notes: existing?.notes || ""
      });

      clearForm("supplementForm", "supplements", "Додати добавку");
      reloadSettingsTab();
    }, true);
  }

  window.addEventListener("DOMContentLoaded", () => {
    restoreActiveTab();
    ensureExerciseFields();
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
