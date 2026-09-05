(function () {
  function currentTime() {
    return new Date().toTimeString().slice(0, 5);
  }

  function setIfEmpty(id) {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = currentTime();
  }

  function setCyclingDurationDefault() {
    const input = document.getElementById("cyclingDuration");
    if (input) input.value = "5";
  }

  function fillDefaults() {
    setIfEmpty("strengthTime");
    setIfEmpty("cyclingTime");
    setIfEmpty("intakeTime");
    setCyclingDurationDefault();
  }

  function fillSoon() {
    [0, 100, 500, 1000].forEach((delay) => {
      window.setTimeout(fillDefaults, delay);
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    fillDefaults();

    [
      "clearCycling",
      "clearStrength",
      "clearIntake",
      "strengthSave",
      "cyclingSave",
      "intakeSave",
      "prevDay",
      "nextDay"
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", fillSoon);
    });

    document.getElementById("strengthForm")?.addEventListener("submit", fillSoon);
    document.getElementById("cyclingForm")?.addEventListener("submit", fillSoon);
    document.getElementById("intakeForm")?.addEventListener("submit", fillSoon);
    document.getElementById("selectedDate")?.addEventListener("change", fillSoon);
    document.querySelectorAll(".sectionDate").forEach((input) => {
      input.addEventListener("change", fillSoon);
    });
  });
})();
