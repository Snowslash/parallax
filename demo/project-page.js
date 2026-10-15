// Picks up a screenshot print into the held-print dialog and puts it down again.
// The framework-free twin of the held print in the shared ProjectPage template.
(function () {
  "use strict";
  var dialog = document.querySelector(".held-print");
  if (!dialog || typeof dialog.showModal !== "function") return;
  var image = dialog.querySelector("img");
  var caption = dialog.querySelector(".held-caption");
  var putDownButton = dialog.querySelector(".put-down");
  var source = null;
  var pending = null;

  function clearMotion() {
    if (pending) pending();
    pending = null;
    dialog.removeAttribute("data-lifting");
    dialog.removeAttribute("data-dropping");
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Wait for this figure's animation, with a cancellable fallback for missing events.
  function afterAnimation(name, ms, done) {
    var figure = dialog.querySelector("figure");
    var finished = false;
    function cancel() {
      finished = true;
      window.clearTimeout(timer);
      dialog.removeEventListener("animationend", onEnd);
    }
    function finish() {
      if (finished) return;
      cancel();
      done();
    }
    function onEnd(event) {
      if (event.target === figure && event.animationName === name && !event.pseudoElement) finish();
    }
    var timer = window.setTimeout(finish, ms);
    dialog.addEventListener("animationend", onEnd);
    return cancel;
  }

  function liftFrom(button) {
    var from = button.getBoundingClientRect();
    var to = dialog.getBoundingClientRect();
    dialog.style.setProperty("--lift-x", from.left + from.width / 2 - (to.left + to.width / 2) + "px");
    dialog.style.setProperty("--lift-y", from.top + from.height / 2 - (to.top + to.height / 2) + "px");
    dialog.style.setProperty("--lift-s", String(Math.min(1, from.width / to.width)));
  }

  function pickUp(button) {
    if (dialog.open) return;
    clearMotion();
    var shot = button.querySelector("img");
    source = button;
    image.src = shot.getAttribute("src");
    image.alt = shot.alt;
    image.width = shot.width;
    image.height = shot.height;
    caption.textContent = button.closest("figure").querySelector("figcaption").textContent;
    dialog.setAttribute("aria-label", caption.textContent);
    if (shot.naturalWidth > shot.naturalHeight) dialog.setAttribute("data-wide", "");
    else dialog.removeAttribute("data-wide");
    dialog.removeAttribute("data-dropping");
    dialog.showModal();
    putDownButton.focus();
    if (reducedMotion()) return;
    liftFrom(button);
    dialog.setAttribute("data-lifting", "");
    pending = afterAnimation("print-lift", 600, clearMotion);
  }

  function putDown() {
    if (!dialog.open || dialog.hasAttribute("data-dropping")) return;
    clearMotion();
    if (reducedMotion() || !source) {
      dialog.close();
      return;
    }
    liftFrom(source);
    dialog.setAttribute("data-dropping", "");
    pending = afterAnimation("print-lift", 360, function () {
      clearMotion();
      dialog.close();
    });
  }

  document.querySelectorAll(".print-image").forEach(function (button) {
    button.addEventListener("click", function () { pickUp(button); });
  });
  putDownButton.addEventListener("click", putDown);
  dialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    putDown();
  });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) putDown();
  });
  dialog.addEventListener("close", function () {
    if (dialog.open) return;
    clearMotion();
    if (source) source.focus();
    source = null;
  });
})();
