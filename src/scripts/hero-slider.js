const AUTOPLAY_DELAY = 6000;
const VIDEO_MAX_DURATION = 12000;
const SWIPE_THRESHOLD = 48;

document.querySelectorAll("[data-hero-slider]").forEach((slider) => {
  const slides = [...slider.querySelectorAll("[data-slide]")];
  const dots = [...slider.querySelectorAll("[data-go-to]")];
  const previous = slider.querySelector("[data-previous]");
  const next = slider.querySelector("[data-next]");
  const toggle = slider.querySelector("[data-toggle]");
  const status = slider.querySelector("[data-status]");
  const videos = [...slider.querySelectorAll("[data-video]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!slides.length || !previous || !next || !toggle || !status) return;

  let current = 0;
  let timer;
  let timerStarted = 0;
  let remaining = AUTOPLAY_DELAY;
  let userPaused = reducedMotion.matches;
  let hovered = false;
  let focused = false;
  let touchStart;

  const shouldPlay = () =>
    !userPaused && !hovered && !focused && !reducedMotion.matches;

  const stopTimer = (preserveTime = false) => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
      if (preserveTime) {
        remaining = Math.max(0, remaining - (Date.now() - timerStarted));
      }
    }
    videos.forEach((video) => video.pause());
  };

  const updateToggle = () => {
    toggle.textContent = userPaused ? "Play" : "Pause";
    toggle.setAttribute(
      "aria-label",
      userPaused ? "Play slideshow" : "Pause slideshow",
    );
    toggle.setAttribute("aria-pressed", String(userPaused));
  };

  const showSlide = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === current;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.inert = !active;
    });
    dots.forEach((dot, dotIndex) => {
      if (dotIndex === current) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    status.textContent = `Slide ${current + 1} of ${slides.length}: ${slides[current].querySelector("h2")?.textContent ?? ""}`;
    remaining =
      slides[current].dataset.slideType === "video"
        ? VIDEO_MAX_DURATION
        : AUTOPLAY_DELAY;
    stopTimer();
    startIfAllowed();
  };

  const advance = () => showSlide(current + 1);

  const loadVideo = (video) => {
    if (video.dataset.loaded || !video.dataset.videoSrc) return false;
    const connection = navigator.connection;
    if (
      !window.matchMedia("(min-width: 769px)").matches ||
      connection?.saveData ||
      ["2g", "slow-2g"].includes(connection?.effectiveType)
    ) {
      return false;
    }

    video.poster = video.dataset.videoPoster;
    video.src = video.dataset.videoSrc;
    video.dataset.loaded = "true";
    video.addEventListener("canplay", () => video.classList.add("is-ready"), {
      once: true,
    });
    return true;
  };

  const startVideo = (video) => {
    if (!loadVideo(video) && !video.dataset.loaded) return false;
    video.muted = true;
    video.loop = false;
    video.playsInline = true;
    video.play().catch(() => video.classList.remove("is-ready"));
    video.onended = advance;
    return true;
  };

  function startIfAllowed() {
    updateToggle();
    if (!shouldPlay() || timer) return;
    const slide = slides[current];
    const video = slide.querySelector("[data-video]");
    if (video) startVideo(video);
    timerStarted = Date.now();
    timer = setTimeout(advance, remaining);
  }

  const pauseForInteraction = () => {
    stopTimer(true);
    updateToggle();
  };

  previous.addEventListener("click", () => showSlide(current - 1));
  next.addEventListener("click", () => showSlide(current + 1));
  dots.forEach((dot) =>
    dot.addEventListener("click", () => showSlide(Number(dot.dataset.goTo))),
  );
  toggle.addEventListener("click", () => {
    userPaused = !userPaused;
    if (shouldPlay()) startIfAllowed();
    else stopTimer();
    updateToggle();
  });

  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(current + 1);
    }
  });
  slider.addEventListener("focusin", () => {
    focused = true;
    pauseForInteraction();
  });
  slider.addEventListener("focusout", (event) => {
    if (!slider.contains(event.relatedTarget)) {
      focused = false;
      startIfAllowed();
    }
  });
  slider.addEventListener("mouseenter", () => {
    hovered = true;
    pauseForInteraction();
  });
  slider.addEventListener("mouseleave", () => {
    hovered = false;
    startIfAllowed();
  });
  slider.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch")
      touchStart = [event.clientX, event.clientY];
  });
  slider.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch" || !touchStart) return;
    const [startX, startY] = touchStart;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    touchStart = undefined;
    if (
      Math.abs(deltaX) > SWIPE_THRESHOLD &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      showSlide(current + (deltaX < 0 ? 1 : -1));
    }
  });
  slider.addEventListener("pointercancel", () => {
    touchStart = undefined;
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      userPaused = true;
      stopTimer();
    }
    updateToggle();
    startIfAllowed();
  });

  slides[0].classList.add("is-active");
  updateToggle();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const firstVideo = slides
        .find((slide) => slide.dataset.slideType === "video")
        ?.querySelector("[data-video]");
      if (firstVideo) loadVideo(firstVideo);
      startIfAllowed();
    });
  });
});
