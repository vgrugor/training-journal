(function () {
  function currentTime() {
    return new Date().toTimeString().slice(0, 5);
  }

  function setIfEmpty(id) {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = currentTime();
  }

  function fillTimeFields() {
    setIfEmpty("cyclingTime");
    setIfEmpty("intakeTime");
  }

  function fillSoon() {
    window.setTimeout(fillTimeFields, 0);
  }

  window.addEventListener("DOMContentLoaded", () => {
    fillTimeFields();

    [
      "clearCycling",
      "clearIntake",
      "cyclingSave",
      "intakeSave",
      "prevDay",
      "nextDay"
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", fillSoon);
    });

    document.getElementById("selectedDate")?.addEventListener("change", fillSoon);
    document.querySelectorAll(".sectionDate").forEach((input) => {
      input.addEventListener("change", fillSoon);
    });
  });
})();
