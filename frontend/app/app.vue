<script setup lang="ts">
import { Volume2, VolumeX } from '@lucide/vue'
import { useBackgroundMusic } from '~/composables/useBackgroundMusic'
import logoMark from '~/assets/images/logo-mark.png'

const music = useBackgroundMusic()

// La session est résolue une fois pour toutes par ~/plugins/auth.ts ; la coque
// n'en affiche que le résultat.
const { label: agentLabel, resolved: sessionResolved, pending: authPending, logout } = useNuxtApp().$auth
</script>

<template>
  <div class="dossier-texture min-h-screen bg-app">
    <header class="sticky top-0 z-50 border-b border-subtle bg-app/85 backdrop-blur-sm">
      <div class="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 py-2.5">
        <NuxtLink to="/" aria-label="Undercover Infinite">
          <img :src="logoMark" alt="Undercover Infinite" class="h-6 object-contain" >
        </NuxtLink>
        <div class="flex items-center gap-2">
          <AccountButton
            :label="agentLabel"
            :resolved="sessionResolved"
            :pending="authPending"
            @logout="logout()"
          />
          <IconButton
            :size="34"
            :active="!music.muted.value"
            :aria-label="music.muted.value ? 'Réactiver la musique' : 'Couper la musique'"
            @click="music.toggleMute()"
          >
            <component :is="music.muted.value ? VolumeX : Volume2" :size="15" />
          </IconButton>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-lg px-5 pb-14 pt-7">
      <NuxtPage />
    </main>
  </div>
</template>
