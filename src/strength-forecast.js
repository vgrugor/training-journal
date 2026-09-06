(function () {
  const DB_NAME = "personal-day-journal";
  const DB_VERSION = 1;
  const WEIGHT_STEP_KG = 5;
  const TECHNIQUE_STEP = 1;
  const MAX_TECHNIQUE_LEVEL = 10;
  const STRENGTH_ROTATION = [
    "handstand-pushups",
    "pullups-reverse-grip",
    "squats",
    "ring-dips",
    "ring-pullups",
    "leg-raises",
    "horizontal-pullups"
  ];

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

  function formatDate(dateValue) {
    return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
  }

  function daysBetween(fromDate, toDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    return Math.round((to - from) / 86400000);
  }

  function currentDate() {
    return document.querySelector("#selectedDate")?.value || new Date().toISOString().slice(0, 10);
  }

  function byWorkoutTime(a, b) {
    return `${a.date || ""} ${a.time || ""} ${a.createdAt || ""}`.localeCompare(`${b.date || ""} ${b.time || ""} ${b.createdAt || ""}`);
  }

  function findName(items, id, fallback = "") {
    return items.find((item) => item.id === id)?.name || fallback;
  }

  function getSuggestedStrength(allStrength, exercises, date) {
    const records = allStrength
      .filter((item) => item.date < date)
      .sort(byWorkoutTime);

    let currentIndex = null;
    for (const record of records) {
      const rotationIndex = STRENGTH_ROTATION.indexOf(record.exerciseId);
      if (rotationIndex >= 0) {
        currentIndex = rotationIndex;
      } else if (record.loadMode === "skip" && currentIndex !== null) {
        currentIndex = (currentIndex + 1) % STRENGTH_ROTATION.length;
      }
    }

    const suggestedId = STRENGTH_ROTATION[currentIndex === null ? 0 : (currentIndex + 1) % STRENGTH_ROTATION.length];
    return exercises.find((item) => item.id === suggestedId) || null;
  }

  function getPreviousStrengthRecord(allStrength, exerciseId, date) {
    return allStrength
      .filter((item) => item.exerciseId === exerciseId && item.date < date)
      .sort((a, b) => byWorkoutTime(b, a))[0] || null;
  }

  function getNextHarderBandId(bands, bandId) {
    const current = bands.find((item) => item.id === bandId);
    if (!current) return bandId || "";

    const currentLevel = Number(current.assistanceLevel);
    const harder = bands
      .filter((item) => Number(item.assistanceLevel) > currentLevel)
      .sort((a, b) => Number(a.assistanceLevel) - Number(b.assistanceLevel))[0];

    return harder?.id || current.id;
  }

  function getStrengthForecast(previous, exercise, bands) {
    if (!previous || previous.loadMode === "skip") return {
      targetReps: exercise?.lowerRepTarget || null,
      bandId: "",
      addedWeightKg: null,
      technicalStep: exercise?.defaultTechnique || "",
      technicalStepLevel: exercise?.defaultTechniqueLevel || 1
    };

    const reps = (previous.sets || []).map((set) => Number(set.reps || 0)).filter((value) => value > 0);
    const sameLoad = {
      bandId: exercise?.loadMode === "band" ? previous.bandId || "" : "",
      addedWeightKg: exercise?.loadMode === "weight" ? Number(previous.addedWeightKg) || 0 : null,
      technicalStep: exercise?.loadMode === "technical_step" ? previous.technicalStep || exercise.defaultTechnique || "" : "",
      technicalStepLevel: exercise?.loadMode === "technical_step" ? Number(previous.technicalStepLevel) || exercise.defaultTechniqueLevel || 1 : null
    };

    if (!reps.length) {
      return {
        targetReps: previous.targetReps || exercise?.lowerRepTarget || null,
        ...sameLoad
      };
    }

    const allSame = reps.every((value) => value === reps[0]);
    if (!allSame) {
      return {
        targetReps: previous.targetReps || reps[0],
        ...sameLoad
      };
    }

    if (previous.needsConsolidation) {
      return {
        targetReps: reps[0],
        ...sameLoad
      };
    }

    const upperTarget = Number(exercise?.upperRepTarget || 20);
    if (upperTarget && reps[0] >= upperTarget) {
      return {
        targetReps: exercise?.lowerRepTarget || reps[0],
        bandId: exercise?.loadMode === "band" ? getNextHarderBandId(bands, sameLoad.bandId) : sameLoad.bandId,
        addedWeightKg: exercise?.loadMode === "weight" ? sameLoad.addedWeightKg + WEIGHT_STEP_KG : sameLoad.addedWeightKg,
        technicalStep: sameLoad.technicalStep,
        technicalStepLevel: exercise?.loadMode === "technical_step"
          ? Math.min(MAX_TECHNIQUE_LEVEL, sameLoad.technicalStepLevel + TECHNIQUE_STEP)
          : sameLoad.technicalStepLevel
      };
    }

    return {
      targetReps: Math.min(reps[0] + 1, upperTarget || 20),
      ...sameLoad
    };
  }

  function getLoadRows(forecast, exercise, bands) {
    if (exercise.loadMode === "band" && forecast.bandId) {
      return [`Гумка: ${findName(bands, forecast.bandId)}`];
    }

    if (exercise.loadMode === "weight" && forecast.addedWeightKg !== null) {
      return [`Додаткова вага: +${forecast.addedWeightKg} кг`];
    }

    if (exercise.loadMode === "technical_step") {
      return [
        forecast.technicalStep ? `Техніка: ${forecast.technicalStep}` : "",
        forecast.technicalStepLevel ? `Рівень техніки: ${forecast.technicalStepLevel}` : ""
      ].filter(Boolean);
    }

    return [];
  }

  function getPreviousHtml(previous, date, bands) {
    if (!previous) return "<p>Попереднього результату для цієї вправи ще немає.</p>";

    const dateLine = `${formatDate(previous.date)} (${daysBetween(previous.date, date)} дн. тому)`;
    const loadLine = [
      previous.bandId ? findName(bands, previous.bandId) : "",
      previous.addedWeightKg ? `+${previous.addedWeightKg} кг` : "",
      previous.technicalStep || "",
      previous.technicalStepLevel ? `рівень ${previous.technicalStepLevel}` : ""
    ].filter(Boolean).join(" · ");
    const sets = (previous.sets || []).map((set) => set.reps || 0).join(" / ");

    return `
      <p><strong>Попередній результат:</strong></p>
      <ul>
        <li>${escapeHtml(dateLine)}</li>
        ${loadLine ? `<li>${escapeHtml(loadLine)}</li>` : ""}
        <li>Підходи: ${escapeHtml(sets)}</li>
      </ul>
    `;
  }

  async function renderForecast() {
    const container = document.querySelector("#strengthSuggestion");
    if (!container) return;

    const date = currentDate();
    const [exercises, bands, allStrength] = await Promise.all([
      getAll("exercises"),
      getAll("bands"),
      getAll("strengthWorkouts")
    ]);
    const exercise = getSuggestedStrength(allStrength, exercises, date);
    if (!exercise) return;

    const previous = getPreviousStrengthRecord(allStrength, exercise.id, date);
    const forecast = getStrengthForecast(previous, exercise, bands);
    const rows = [
      exercise.name,
      forecast.targetReps ? `Зробити: ${forecast.targetReps} у підході` : "",
      ...getLoadRows(forecast, exercise, bands)
    ].filter(Boolean).map((row) => `<li>${escapeHtml(row)}</li>`).join("");

    container.innerHTML = `
      <div class="suggestion-content">
        <p><strong>На сьогодні:</strong></p>
        <ul>${rows}</ul>
        ${getPreviousHtml(previous, date, bands)}
      </div>
      <button class="secondary" type="button" data-enhanced-suggested-strength="${escapeHtml(exercise.id)}">Вибрати</button>
    `;
    container.hidden = false;
    container.dataset.enhancedForecast = "true";
  }

  async function applyForecast(exerciseId) {
    const date = currentDate();
    const [exercises, bands, allStrength] = await Promise.all([
      getAll("exercises"),
      getAll("bands"),
      getAll("strengthWorkouts")
    ]);
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;

    const previous = getPreviousStrengthRecord(allStrength, exercise.id, date);
    const forecast = getStrengthForecast(previous, exercise, bands);
    const exerciseSelect = document.querySelector("#strengthExercise");
    if (exerciseSelect) {
      exerciseSelect.value = exercise.id;
      exerciseSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    window.setTimeout(() => {
      const targetSets = document.querySelector("#strengthTargetSets");
      const targetReps = document.querySelector("#strengthTargetReps");
      const band = document.querySelector("#strengthBand");
      const weight = document.querySelector("#strengthAddedWeight");
      const technique = document.querySelector("#strengthTechnique");
      const techniqueLevel = document.querySelector("#strengthTechniqueLevel");

      if (targetSets) targetSets.value = String(exercise.defaultSets || 5);
      if (targetReps && forecast.targetReps) targetReps.value = String(forecast.targetReps);
      if (band && exercise.loadMode === "band") band.value = forecast.bandId || "";
      if (weight && exercise.loadMode === "weight") weight.value = forecast.addedWeightKg ?? "";
      if (technique && exercise.loadMode === "technical_step") technique.value = forecast.technicalStep || "";
      if (techniqueLevel && exercise.loadMode === "technical_step") techniqueLevel.value = String(forecast.technicalStepLevel || 1);
    }, 40);
  }

  function scheduleRender() {
    window.setTimeout(() => {
      renderForecast().catch(() => {});
    }, 80);
  }

  function bind() {
    scheduleRender();

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-enhanced-suggested-strength]");
      if (button) {
        applyForecast(button.dataset.enhancedSuggestedStrength).catch(() => {});
      }

      if (event.target.closest("[data-tab='strength']")) scheduleRender();
    });

    document.querySelector("#selectedDate")?.addEventListener("change", scheduleRender);

    const container = document.querySelector("#strengthSuggestion");
    if (container) {
      const observer = new MutationObserver(() => {
        if (container.querySelector("[data-enhanced-suggested-strength]")) return;
        scheduleRender();
      });
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
