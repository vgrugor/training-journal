(function () {
  window.addEventListener("DOMContentLoaded", () => {
    const moreNav = document.querySelector(".tab-more");
    const moreToggle = document.querySelector(".more-toggle");
    if (!moreNav || !moreToggle) return;

    moreToggle.addEventListener("click", () => {
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
