/**
 * Week 1 — Terminal Dashboard
 * app.js: boot sequence animation + uptime clock
 */

(function () {
  "use strict";

  /* ── Config ────────────────────────────────────────────────── */
  const BOOT_START = Date.now();     // treat page load as "boot time"
  const BOOT_LINE_DELAY  = 160;     // ms between each line appearing
  const BOOT_HOLD        = 300;     // ms to hold before fading out
  const BOOT_FADE        = 400;     // matches CSS transition duration

  /* ── Elements ──────────────────────────────────────────────── */
  const bootScreen = document.getElementById("boot-screen");
  const mainShell  = document.getElementById("main-shell");
  const bootLines  = Array.from(document.querySelectorAll(".boot-line"));
  const uptimeEl   = document.getElementById("uptime-display");

  /* ── Boot sequence ─────────────────────────────────────────── */
  function runBoot() {
    // Respect reduced-motion: skip straight to dashboard
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishBoot();
      return;
    }

    // Reveal each boot line in sequence
    bootLines.forEach((line, i) => {
      setTimeout(() => line.classList.add("visible"), i * BOOT_LINE_DELAY);
    });

    // After all lines shown, fade out and reveal dashboard
    const totalDelay = bootLines.length * BOOT_LINE_DELAY + BOOT_HOLD;
    setTimeout(() => {
      bootScreen.classList.add("fade-out");
      mainShell.style.transition = "opacity .4s ease";
      mainShell.style.opacity = "1";
      setTimeout(() => bootScreen.classList.add("hidden"), BOOT_FADE);
    }, totalDelay);
  }

  function finishBoot() {
    bootScreen.classList.add("hidden");
    mainShell.style.opacity = "1";
  }

  /* ── Uptime clock ──────────────────────────────────────────── */
  function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);

    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  function tickUptime() {
    if (!uptimeEl) return;
    uptimeEl.textContent = `uptime: ${formatUptime(Date.now() - BOOT_START)}`;
  }

  /* ── Project row hover: show full URL in status bar ───────── */
  function initRowHints() {
    const rows = document.querySelectorAll(".project-row:not(.pending)");
    rows.forEach(row => {
      const href = row.getAttribute("href");
      if (!href || href === "#") return;

      row.addEventListener("mouseenter", () => {
        if (uptimeEl) {
          uptimeEl.textContent = `→ ${href}`;
        }
      });
      row.addEventListener("mouseleave", tickUptime);
    });
  }

  /* ── Keyboard shortcut: press Escape to skip boot ─────────── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !bootScreen.classList.contains("hidden")) {
      bootScreen.classList.add("hidden");
      mainShell.style.opacity = "1";
    }
  }, { once: true });

  /* ── Init ──────────────────────────────────────────────────── */
  runBoot();
  initRowHints();
  tickUptime();
  setInterval(tickUptime, 1000);

})();
