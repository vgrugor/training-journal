(function () {
  function createExplanation(id, html) {
    const existing = document.getElementById(id);
    if (existing) return existing;

    const block = document.createElement("div");
    block.id = id;
    block.className = "progress-explanation";
    block.innerHTML = html;
    return block;
  }

  function addAfterChart(chartId, explanationId, html) {
    const chart = document.getElementById(chartId);
    if (!chart) return;

    const block = createExplanation(explanationId, html);
    if (!block.parentNode) chart.after(block);
  }

  function renderExplanations() {
    addAfterChart("strengthProgressChart", "strengthProgressExplanation", `
      <h4>Параметри силових</h4>
      <ul>
        <li><strong>Повтори</strong> - сума всіх повторів за вибрану вправу в межах дня.</li>
        <li><strong>Навантаження</strong> - рівень гумки, додаткова вага в кг або рівень техніки.</li>
        <li><strong>Індекс</strong> - навантаження плюс прогрес повторів усередині робочого діапазону вправи.</li>
      </ul>
    `);

    addAfterChart("cyclingProgressChart", "cyclingProgressExplanation", `
      <h4>Параметри велотренажера</h4>
      <ul>
        <li><strong>Тривалість хв</strong> - сума тривалості всіх велотренувань за день.</li>
        <li><strong>Середня швидкість км/год</strong> - середнє значення швидкості за день.</li>
        <li><strong>Відстань км</strong> - сума дистанції всіх велотренувань за день.</li>
        <li><strong>Навантаження</strong> - найбільший введений рівень навантаження за день.</li>
        <li><strong>Індекс</strong> - тривалість хв × навантаження × середня швидкість км/год / 10; кілька тренувань за день сумуються.</li>
      </ul>
    `);
  }

  function scheduleRender() {
    window.setTimeout(renderExplanations, 0);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", scheduleRender);
  } else {
    scheduleRender();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-tab='progress']")) scheduleRender();
  });
})();
