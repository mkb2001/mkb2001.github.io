/**
 * Speech waves: when a hero link is hovered or focused, the four bars beside it pulse like a tiny
 * audio level meter (anime.js). They settle back when the pointer or focus leaves.
 * With reduced motion the bars simply show at a fixed height.
 */
import { animate, stagger } from "./vendor/anime.esm.min.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

for (const link of document.querySelectorAll(".links a")) {
  const bars = link.querySelectorAll(".wave i");
  if (!bars.length) continue;
  let running = null;

  const speak = () => {
    running?.pause();
    if (reduced) {
      bars.forEach((b, i) => (b.style.transform = `scaleY(${[0.5, 0.9, 0.7, 0.4][i % 4]})`));
      return;
    }
    running = animate(bars, {
      scaleY: [
        { to: () => 0.35 + Math.random() * 0.65, duration: 140 },
        { to: () => 0.2 + Math.random() * 0.5, duration: 160 },
      ],
      delay: stagger(45),
      loop: true,
      ease: "inOutSine",
    });
  };
  const hush = () => {
    running?.pause();
    running = null;
    if (reduced) return bars.forEach((b) => (b.style.transform = ""));
    animate(bars, { scaleY: 0.2, duration: 220, ease: "outQuad" });
  };

  link.addEventListener("pointerenter", speak);
  link.addEventListener("focus", speak);
  link.addEventListener("pointerleave", hush);
  link.addEventListener("blur", hush);
}
