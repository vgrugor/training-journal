(function () {
  const script = document.createElement("script");
  script.src = "./src/technical-progress.js";
  script.defer = true;
  document.head.appendChild(script);

  const cyclingLoadScript = document.createElement("script");
  cyclingLoadScript.src = "./src/cycling-load-progress.js";
  cyclingLoadScript.defer = true;
  document.head.appendChild(cyclingLoadScript);

  const progressExplanationsScript = document.createElement("script");
  progressExplanationsScript.src = "./src/progress-explanations.js";
  progressExplanationsScript.defer = true;
  document.head.appendChild(progressExplanationsScript);

  window.addEventListener("DOMContentLoaded", () => {
    const moreNav = document.querySelector(".tab-more");
    const moreToggle = document.querySelector(".more-toggle");
    if (!moreNav || !moreToggle) return;

    moreToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = moreNav.classList.toggle("is-open");
      moreToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        moreNav.classList.remove("is-open");
        moreToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (event) => {
      if (moreNav.contains(event.target)) return;
      moreNav.classList.remove("is-open");
      moreToggle.setAttribute("aria-expanded", "false");
    });
  });
})();
