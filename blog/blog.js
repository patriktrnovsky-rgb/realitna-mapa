// Ikony + tooltip pre grafy v článkoch
hydrateIcons();
(() => {
  const tip = document.getElementById("chartTip");
  if (!tip) return;
  const show = (el, x, y) => { tip.textContent = el.dataset.tip; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("show"); };
  const hide = () => tip.classList.remove("show");
  document.querySelectorAll(".chart .bar").forEach((el) => {
    el.addEventListener("mousemove", (e) => show(el, e.clientX, e.clientY));
    el.addEventListener("mouseleave", hide);
    el.addEventListener("focus", () => { const r = el.querySelector("path").getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); });
    el.addEventListener("blur", hide);
  });
  addEventListener("scroll", hide, { passive: true });
})();
