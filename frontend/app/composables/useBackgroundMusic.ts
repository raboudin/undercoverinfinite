import { ref } from 'vue'

const STORAGE_KEY = 'undercover:music-muted'

// État partagé au niveau du module : le bouton de la coque et l'écran de
// configuration pilotent la même piste audio.
const muted = ref(false)
const playing = ref(false)
let audio: HTMLAudioElement | null = null
let restored = false

function isClient() {
  return typeof window !== 'undefined'
}

function element(): HTMLAudioElement | null {
  if (!isClient()) return null
  if (!audio) {
    audio = new Audio('/audio/music.mp3')
    audio.loop = true
    audio.volume = 0.22
  }
  return audio
}

export function useBackgroundMusic() {
  if (!restored && isClient()) {
    restored = true
    muted.value = window.localStorage.getItem(STORAGE_KEY) === '1'
  }

  /**
   * Les navigateurs refusent l'autoplay : à n'appeler que depuis un vrai geste
   * utilisateur (le clic sur « Lancer la mission »).
   */
  async function start() {
    const el = element()
    if (!el || muted.value) return
    try {
      await el.play()
      playing.value = true
    }
    catch {
      // Geste refusé par le navigateur : on retentera au prochain clic.
      playing.value = false
    }
  }

  function toggleMute() {
    muted.value = !muted.value
    if (isClient()) window.localStorage.setItem(STORAGE_KEY, muted.value ? '1' : '0')

    const el = element()
    if (!el) return
    if (muted.value) {
      el.pause()
      playing.value = false
    }
    else {
      void start()
    }
  }

  return { muted, playing, start, toggleMute }
}
