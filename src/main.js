const world = document.querySelector("#world");
const progressBar = document.querySelector("#progressBar");
const levelCounter = document.querySelector("#levelCounter");
const player = document.querySelector(".player");
const navLinks = document.querySelectorAll("[data-nav]");
const sections = [...document.querySelectorAll(".level")];
const tourSections = sections.filter((section) => section.id !== "home");

const desktopQuery = window.matchMedia("(min-width: 860px)");
let activeTour = null;

function getCurrentScroll() {
  return {
    x: Math.max(window.scrollX, document.documentElement.scrollLeft, document.body.scrollLeft),
    y: Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop)
  };
}

function setPageScroll(left, top) {
  window.scrollTo(left, top);
  document.documentElement.scrollLeft = left;
  document.documentElement.scrollTop = top;
  document.body.scrollLeft = left;
  document.body.scrollTop = top;
}

function getScrollMetrics() {
  if (desktopQuery.matches) {
    const { x } = getCurrentScroll();
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const max = Math.max(scrollWidth - window.innerWidth, 1);
    return { current: x, max };
  }

  const { y } = getCurrentScroll();
  const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const max = Math.max(scrollHeight - window.innerHeight, 1);
  return { current: y, max };
}

function updateProgress() {
  const { current, max } = getScrollMetrics();
  const progress = Math.min(Math.max(current / max, 0), 1);
  const level = Math.min(Math.round(progress * (sections.length - 1)), sections.length - 1);

  progressBar.style.transform = `scaleX(${progress})`;
  document.documentElement.style.setProperty("--journey", progress.toFixed(3));
  levelCounter.textContent = String(level);

  const playerTravel = desktopQuery.matches ? 68 : 28;
  player.style.setProperty("--player-x", `${8 + progress * playerTravel}vw`);
}

function setActiveSection(id) {
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === id);
  });
}

function getSectionPosition(section) {
  const rect = section.getBoundingClientRect();
  const { x, y } = getCurrentScroll();

  if (desktopQuery.matches) {
    return {
      left: rect.left + x,
      top: 0
    };
  }

  return {
    left: 0,
    top: rect.top + y
  };
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function wait(ms, token) {
  return new Promise((resolve) => {
    const startedAt = performance.now();

    function tick(now) {
      if (token.cancelled) {
        resolve();
        return;
      }

      if (now - startedAt >= ms) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function animateToSection(section, duration, token) {
  const target = getSectionPosition(section);
  const { x: startX, y: startY } = getCurrentScroll();
  const deltaX = target.left - startX;
  const deltaY = target.top - startY;

  return new Promise((resolve) => {
    const startedAt = performance.now();

    function step(now) {
      if (token.cancelled) {
        resolve();
        return;
      }

      const elapsed = Math.min((now - startedAt) / duration, 1);
      const eased = easeInOutCubic(elapsed);

      setPageScroll(startX + deltaX * eased, startY + deltaY * eased);
      updateProgress();

      if (elapsed < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}

function stopTour() {
  if (activeTour) {
    activeTour.cancelled = true;
    activeTour = null;
  }

  document.body.classList.remove("is-auto-playing");
  document.documentElement.classList.remove("is-auto-playing");
}

async function startGameTour() {
  stopTour();

  const token = { cancelled: false };
  activeTour = token;
  document.body.classList.add("is-auto-playing");
  document.documentElement.classList.add("is-auto-playing");

  const readableStops = {
    about: 5200,
    skills: 6200,
    projects: 9000,
    contact: 6200
  };

  for (const section of tourSections) {
    history.replaceState(null, "", `#${section.id}`);
    await animateToSection(section, desktopQuery.matches ? 2600 : 1400, token);

    if (token.cancelled) {
      break;
    }

    await wait(readableStops[section.id] ?? 5200, token);
  }

  if (activeTour === token) {
    activeTour = null;
    document.body.classList.remove("is-auto-playing");
    document.documentElement.classList.remove("is-auto-playing");
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActiveSection(visible.target.id);
      levelCounter.textContent = visible.target.dataset.level;
    }
  },
  {
    root: null,
    threshold: [0.35, 0.55, 0.75]
  }
);

sections.forEach((section) => observer.observe(section));

function scrollToTarget(hash, behavior = "smooth") {
  const target = document.querySelector(hash);
  if (!target) return;

  if (desktopQuery.matches) {
    if (behavior === "auto") {
      const targetPosition = getSectionPosition(target);
      setPageScroll(targetPosition.left, targetPosition.top);
      return;
    }

    animateToSection(target, 720, { cancelled: false });
  } else {
    target.scrollIntoView({ behavior, block: "start" });
  }
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    event.preventDefault();
    const hash = anchor.getAttribute("href");

    if (anchor.hasAttribute("data-start")) {
      startGameTour();
      return;
    }

    stopTour();
    history.replaceState(null, "", hash);
    scrollToTarget(hash);
  });
});

window.addEventListener("keydown", (event) => {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(event.key)) return;
  stopTour();

  const activeId = [...navLinks].find((link) => link.classList.contains("is-active"))?.dataset.nav ?? "home";
  const currentIndex = Math.max(sections.findIndex((section) => section.id === activeId), 0);
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next = sections[Math.min(Math.max(currentIndex + direction, 0), sections.length - 1)];

  if (next) {
    event.preventDefault();
    scrollToTarget(`#${next.id}`);
  }
});

window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
window.addEventListener("wheel", stopTour, { passive: true });
window.addEventListener("touchstart", stopTour, { passive: true });
window.addEventListener("load", () => {
  if (window.location.hash) {
    const hash = window.location.hash;
    scrollToTarget(hash, "auto");
    requestAnimationFrame(() => scrollToTarget(hash, "auto"));
    window.setTimeout(() => scrollToTarget(hash, "auto"), 120);
  }

  updateProgress();
});

updateProgress();
