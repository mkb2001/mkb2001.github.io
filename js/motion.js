/**
 * Page motion with GSAP, plus Lenis smooth scrolling. Everything here is an enhancement: all content
 * is visible without it, and GSAP only animates *from* a hidden state, so nothing can get stuck.
 *
 * Always on (they answer scrolling rather than play on their own):
 *  - the amber trail under the nav fills as the page scrolls
 *  - the nav marks the section being read
 * Only without prefers-reduced-motion:
 *  - Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in step
 *  - the hero: the name slides up from behind a mask with a heavy ease, like a train
 *    pulling into a station, then the bio types out word by word like live captions
 *  - section headings, projects, the call path's signal and the experience rail as they appear
 */
const { gsap, ScrollTrigger, CustomEase, SplitText, ScrambleTextPlugin, Lenis } = window;

if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText, ScrambleTextPlugin);
  CustomEase.create("heavy", "0.16, 1, 0.3, 1");

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const navHeight = () => $(".masthead")?.offsetHeight ?? 0;

  // Trail: how far down the page you are.
  gsap.to("[data-trail]", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: true } });

  // Mark the nav link of the section in view.
  for (const link of $$("nav a[href^='#']")) {
    const section = $(link.getAttribute("href"));
    if (!section) continue;
    ScrollTrigger.create({
      trigger: section,
      start: "top 40%",
      end: "bottom 40%",
      onToggle: ({ isActive }) => (isActive ? link.setAttribute("aria-current", "true") : link.removeAttribute("aria-current")),
    });
  }

  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const lenis = smoothScroll();
    hero();
    reveals();
    callPath();
    rail();
    return () => lenis?.destroy();
  });

  /** Lenis, ticking on GSAP's clock. In-page links glide to their target and move focus there. */
  function smoothScroll() {
    if (!Lenis) return null;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4) });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const onClick = (e) => {
      const href = e.currentTarget.getAttribute("href");
      const target = $(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, {
        offset: -navHeight(),
        duration: 1.4,
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        onComplete: () => {
          history.replaceState(null, "", href);
          if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        },
      });
    };
    const anchors = $$("a[href^='#']");
    anchors.forEach((a) => a.addEventListener("click", onClick));
    return {
      destroy: () => {
        anchors.forEach((a) => a.removeEventListener("click", onClick));
        gsap.ticker.remove(raf);
        lenis.destroy();
      },
    };
  }

  /** The hero arrives: name, captioned bio, links, then the globe. */
  function hero() {
    const tl = gsap.timeline({ defaults: { ease: "heavy" } });

    // Name: each line slides up from behind its mask.
    tl.from($$("[data-reveal]"), { yPercent: 115, duration: 1.4, stagger: 0.12 }, 0.1);

    // Bio: words appear one at a time, like live captions, with an amber caret after the last.
    const bio = $("[data-bio]");
    if (bio && SplitText) {
      const split = SplitText.create(bio, { type: "words" });
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.setAttribute("aria-hidden", "true");
      gsap.set(split.words, { autoAlpha: 0 });
      const typing = gsap.timeline();
      split.words.forEach((word, i) => {
        // Captions arrive in bursts: a short pause after every few words.
        const at = i * 0.07 + Math.floor(i / 5) * 0.18;
        typing.set(word, { autoAlpha: 1 }, at).call(() => word.after(caret), null, at);
      });
      typing.to(caret, { autoAlpha: 0, repeat: 5, yoyo: true, duration: 0.45, ease: "steps(1)" }).set(caret, { autoAlpha: 0 });
      tl.add(typing, 1.1);
    }

    tl.from($$(".links li"), { y: 14, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, ">-0.6");

    // The globe fades up as the text settles.
    const telemetry = $("[data-telemetry]");
    if (telemetry) tl.from(telemetry, { autoAlpha: 0, scale: 0.94, duration: 1.8 }, 0.4);
    tl.from("[data-hud]", { autoAlpha: 0, x: 24, duration: 1 }, 1.2);
  }

  /** Section headings and projects arrive once, as they come into view. */
  function reveals() {
    for (const heading of $$(".block-title")) {
      gsap.from(heading, {
        yPercent: 40,
        autoAlpha: 0,
        duration: 1.1,
        ease: "heavy",
        scrollTrigger: { trigger: heading, start: "top 85%", once: true },
      });
    }
    ScrollTrigger.batch(".project", {
      start: "top 88%",
      once: true,
      onEnter: (items) => gsap.from(items, { y: 30, autoAlpha: 0, duration: 1, stagger: 0.1, ease: "heavy" }),
    });
  }

  /**
   * The AIBOS call path as a transmission: the steps light up and each link draws in turn, then a
   * signal keeps travelling back and forth along the live audio path while it is in view.
   */
  function callPath() {
    const steps = $(".steps");
    if (!steps) return;
    const items = $$(".step", steps);

    const tl = gsap.timeline({ scrollTrigger: { trigger: steps, start: "top 75%", once: true } });
    items.forEach((step, i) => {
      tl.from(step, { autoAlpha: 0, y: 10, duration: 0.35, ease: "power2.out" }, i * 0.35);
      if (i < items.length - 1) tl.fromTo(step, { "--draw": 0 }, { "--draw": 1, duration: 0.3, ease: "none" }, i * 0.35 + 0.25);
    });

    const signal = document.createElement("span");
    signal.className = "signal";
    signal.setAttribute("aria-hidden", "true");
    steps.append(signal);

    const centre = (el) => {
      const a = el.getBoundingClientRect();
      const b = steps.getBoundingClientRect();
      return { x: a.left - b.left + a.width / 2, y: a.top - b.top + Math.min(a.height / 2, 18) };
    };
    const pulse = gsap.timeline({ paused: true, repeat: -1, yoyo: true, repeatDelay: 0.3 });
    const buildPulse = () => {
      const [, twilio, stream, model] = items;
      const pts = [twilio, stream, model].map(centre);
      pulse.clear();
      pulse
        .set(signal, { x: pts[0].x, y: pts[0].y, opacity: 1 })
        .to(signal, { x: pts[1].x, y: pts[1].y, duration: 0.7, ease: "power1.inOut" })
        .to(signal, { x: pts[2].x, y: pts[2].y, duration: 0.7, ease: "power1.inOut" });
    };
    buildPulse();
    tl.call(() => pulse.restart());

    ScrollTrigger.create({
      trigger: steps,
      start: "top bottom",
      end: "bottom top",
      onRefresh: buildPulse,
      onToggle: ({ isActive }) => (isActive && tl.progress() === 1 ? pulse.resume() : pulse.pause()),
    });
    return () => signal.remove();
  }

  /** Experience: the rail draws as the roles scroll past, and each role's dates come in like telemetry. */
  function rail() {
    const roles = $(".roles");
    if (!roles) return;
    gsap.fromTo(
      roles,
      { "--flight": 0 },
      { "--flight": 1, ease: "none", scrollTrigger: { trigger: roles, start: "top 75%", end: "bottom 55%", scrub: 0.5 } },
    );
    for (const dates of $$(".role-dates", roles)) {
      ScrollTrigger.create({
        trigger: dates,
        start: "top 85%",
        once: true,
        onEnter: () => {
          for (const t of $$("time", dates)) {
            gsap.to(t, { duration: 0.9, scrambleText: { text: t.textContent, chars: "0123456789", speed: 0.5 } });
          }
        },
      });
    }
  }
}
