import { animate, createTimer, utils } from "animejs";
import { release } from "./hero.js";

// The clip's last ~0.4 s is flat ivory mist. Handing over there, not on `ended`, lets the hero
// surface out of the mist instead of after it.
const MIST = 0.45;
const RELEASE = 360;
const SPARKS = 14;
// The seal's resting drop-shadow from the stylesheet, plus a gold glow, in a form both ends of the
// flare share so the filter interpolates.
const SHADOW = (glow, alpha) =>
  `drop-shadow(0px 4px 6px rgb(42 33 28 / 0.5)) drop-shadow(0px 0px ${glow}px rgb(241 213 149 / ${alpha}))`;

// The doors swing open in slow motion: the 3 s clip plays over about 5 s.
const DOOR_SPEED = 0.6;

function playIntoMist(video) {
  video.playbackRate = DOOR_SPEED;
  return new Promise((resolve) => {
    const onTime = () => {
      if (video.duration - video.currentTime > MIST) return;
      video.removeEventListener("timeupdate", onTime);
      resolve();
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", resolve, { once: true });
    video.play().catch(resolve);
  });
}

// The seal presses in like a stamp, flares gold and lifts away whole, while rings of light and a
// burst of sparks spread out from under it. Resolves as it lifts, so the doors open behind it.
function releaseSeal(button) {
  animate(button.querySelector(".gate-hint"), {
    opacity: 0,
    duration: 200,
    ease: "out(2)",
  });
  animate(button.querySelector(".seal"), {
    scale: [
      { to: 0.9, duration: 140, ease: "out(2)" },
      { to: 1.08, duration: RELEASE - 140, ease: "out(3)" },
      { to: 1.6, duration: 800, ease: "in(2)" },
    ],
    filter: {
      from: SHADOW(2, 0.2),
      to: SHADOW(28, 1),
      duration: RELEASE,
      ease: "out(2)",
    },
    opacity: { to: 0, delay: RELEASE, duration: 800, ease: "in(2)" },
  });

  const burst = (className, count, params) => {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = className;
      button.append(el);
      animate(el, params(i));
    }
  };
  burst("seal-ring", 2, (i) => ({
    scale: [0.8, 3.4],
    opacity: [0.9, 0],
    delay: RELEASE - 120 + i * 220,
    duration: 1200,
    ease: "out(3)",
  }));
  burst("seal-spark", SPARKS, (i) => {
    const angle = (i / SPARKS) * Math.PI * 2 + utils.random(-0.2, 0.2, 2);
    const distance = utils.random(80, 150);
    return {
      translateX: [0, Math.cos(angle) * distance],
      translateY: [0, Math.sin(angle) * distance],
      scale: [1.4, 0],
      // Holds its light for most of the flight, then goes out.
      opacity: { from: 1, to: 0, ease: "in(3)" },
      delay: RELEASE - 80 + utils.random(0, 100),
      duration: utils.random(800, 1100),
      ease: "out(3)",
    };
  });
  return createTimer({ duration: RELEASE });
}

export function setupGate(gate, { reduceMotion, onOpen, onOpened }) {
  const button = gate.querySelector("#gate-open");
  const video = gate.querySelector(".gate-video");
  // Idle life before the tap: the door breathes in and out, and the seal glows.
  const idle = reduceMotion
    ? []
    : [
        animate(video, {
          scale: [1, 1.03],
          duration: 6000,
          ease: "inOut(2)",
          loop: true,
          alternate: true,
        }),
        animate(button.querySelector(".seal"), {
          filter: [SHADOW(2, 0.2), SHADOW(16, 0.85)],
          duration: 1600,
          ease: "inOut(2)",
          loop: true,
          alternate: true,
        }),
      ];

  button.addEventListener(
    "click",
    async () => {
      button.disabled = true;
      onOpen();
      if (!reduceMotion) {
        // Paused, not reverted, so the door clip starts from the zoom it has reached.
        for (const anim of idle) anim.pause();
        await releaseSeal(button);
        await playIntoMist(video);
      }
      onOpened();
      await animate(gate, {
        opacity: 0,
        duration: reduceMotion ? 600 : 1000,
        ease: "inOut(2)",
      });
      gate.remove();
      release(video);
      document.body.classList.remove("is-gated");
    },
    { once: true },
  );
}
