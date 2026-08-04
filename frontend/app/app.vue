<script setup lang="ts">
import { ShoppingBag, Volume2, VolumeX } from '@lucide/vue'
import { useBackgroundMusic } from '~/composables/useBackgroundMusic'
import { useMissionExit } from '~/composables/useMissionExit'
import logoMark from '~/assets/images/logo-mark.png'

const music = useBackgroundMusic()

// Le logo ramène au menu principal, même en pleine partie : sur `/` il n'y a
// aucune navigation à attendre, c'est ce signal qui referme la mission.
const missionExit = useMissionExit()

// La session est résolue une fois pour toutes par ~/plugins/auth.ts ; la coque
// n'en affiche que le résultat.
const {
  label: agentLabel,
  initial: agentInitial,
  avatarUrl: agentAvatar,
  resolved: sessionResolved,
  pending: authPending,
  logout
} = useNuxtApp().$auth
</script>

<template>
  <div class="dossier-texture min-h-screen bg-app">
    <header class="sticky top-0 z-50 border-b border-subtle bg-app/85 backdrop-blur-sm">
      <div class="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 py-2.5">
        <NuxtLink to="/" aria-label="Retour au menu principal" @click="missionExit++">
          <img :src="logoMark" alt="Undercover Infinite" class="h-6 object-contain" >
        </NuxtLink>
        <div class="flex items-center gap-2">
          <AccountButton
            :label="agentLabel"
            :initial="agentInitial"
            :avatar-url="agentAvatar"
            :resolved="sessionResolved"
            :pending="authPending"
            @logout="logout()"
          />
          <NuxtLink to="/boutique" aria-label="Équipement">
            <IconButton :size="34" tabindex="-1">
              <ShoppingBag :size="15" />
            </IconButton>
          </NuxtLink>
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
