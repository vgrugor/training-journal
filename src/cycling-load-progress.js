(function () {
  function ensureCyclingLoadOption() {
    const select = document.querySelector("#progressCyclingMetric");
    if (!select || select.querySelector('option[value="load"]')) return;

    const option = document.createElement("option");
    option.value = "load";
    option.textContent = "Навантаження";
    select.appendChild(option);
  }

  function bind() {
    ensureCyclingLoadOption();

    const progressButton = document.querySelector("[data-tab='progress']");
    progressButton?.addEventListener("click", () => {
      window.setTimeout(ensureCyclingLoadOption, 0);
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
