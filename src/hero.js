import { animate, stagger, utils } from 'animejs'

const FADE = 1.5
// B's loop opens mid-shower, with petals already over the couple. By 2.5 s they have all fallen
// and the sky is clear; the next toss comes in from the top about half a second later.
const SHOWER_START = 2.5
// The petals fall in slight slow motion.
const SHOWER_SPEED = 0.8
// A video can refuse to play: iOS caps how many play at once across all of Safari's tabs, so a
// guest who has opened the link many times can hit it, and Low Power Mode blocks them outright.
// The page then moves on regardless: B fades in once A would have ended, and the tour starts once
// the shower would have come down. Both in seconds from the reveal.
const A_STALL = 7
const SHOWER_STALL = 13

// Frees a finished video's decoder, of which iOS has few; its poster stands in.
export function release(video) {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

// A plays once and holds its last frame. B (the flower shower) fades in over A's last 1.5 s while
// paused on its clear-sky frame, then plays and loops, so the first petals are seen falling from
// the top, and A, hidden beneath it, is released. If B is not buffered by then, A holds until it
// is. `onShowerFalling` runs once, as B first wraps round: the toss has come down and its petals
// are falling past the couple. Returns whether B has been started, for pausing it off screen.
function crossfadeAfterFirstPass(a, b, onShowerFalling) {
  let started = false
  setTimeout(onShowerFalling, SHOWER_STALL * 1000)
  b.preload = 'auto'
  b.load()

  const ready = new Promise((resolve) => {
    if (b.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) resolve()
    else b.addEventListener('canplay', resolve, { once: true })
  }).then(
    () =>
      new Promise((resolve) => {
        b.addEventListener('seeked', resolve, { once: true })
        b.currentTime = SHOWER_START
      }),
  )
  // timeupdate fires about every 250 ms, so the fade can start up to that much late; A's held last
  // frame covers the gap.
  const nearEnd = new Promise((resolve) => {
    const onTime = () => {
      if (a.duration - a.currentTime > FADE) return
      a.removeEventListener('timeupdate', onTime)
      resolve()
    }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', resolve, { once: true })
    setTimeout(resolve, A_STALL * 1000)
  })

  let last = SHOWER_START
  const onWrap = () => {
    if (b.currentTime >= last) {
      last = b.currentTime
      return
    }
    b.removeEventListener('timeupdate', onWrap)
    onShowerFalling()
  }
  b.addEventListener('timeupdate', onWrap)

  Promise.all([ready, nearEnd]).then(async () => {
    await animate(b, { opacity: 1, duration: FADE * 1000, ease: 'inOut(2)' })
    b.playbackRate = SHOWER_SPEED
    started = true
    b.play().then(() => release(a), () => {})
  })
  return () => started
}

// The hero waits hidden under the gate, then surfaces out of the gate video's closing mist.
export function setupHero(hero, { reduceMotion, onShowerFalling }) {
  const media = hero.querySelector('.hero-media')
  const [a, b] = media.querySelectorAll('video')
  const lines = hero.querySelectorAll('.hero-text > *')
  utils.set([media, ...lines], { opacity: 0 })
  // Reduced motion keeps A's poster as a still.
  if (reduceMotion) a.preload = 'none'

  return function revealHero() {
    if (reduceMotion) {
      animate([media, ...lines], { opacity: 1, duration: 600, ease: 'linear' })
      return
    }
    a.play().catch(() => {})
    const showering = crossfadeAfterFirstPass(a, b, onShowerFalling)
    // The shower plays only while the hero is on screen and the tab is in front.
    let inView = true
    const follow = () => {
      if (!showering()) return
      if (inView && !document.hidden) b.play().catch(() => {})
      else b.pause()
    }
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      follow()
    }).observe(hero)
    document.addEventListener('visibilitychange', follow)
    animate(media, {
      opacity: 1,
      scale: [1.06, 1],
      filter: ['blur(14px)', 'blur(0px)'],
      duration: 1800,
      ease: 'out(3)',
    })
    // Line by line, once the mist has mostly cleared.
    animate(lines, {
      opacity: 1,
      translateY: [16, 0],
      filter: ['blur(6px)', 'blur(0px)'],
      delay: stagger(180, { start: 700 }),
      duration: 900,
      ease: 'out(3)',
    })
  }
}
