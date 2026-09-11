<script setup lang="ts">
import { ref } from 'vue'
import { createRoomSocket } from '~/composables/useRoomSocket'

const nuxtApp = useNuxtApp()
const auth = nuxtApp.$auth
const runtimeConfig = useRuntimeConfig()

const room = createRoomSocket({ apiBase: runtimeConfig.public.apiBase, request: auth.authFetch })

const displayName = ref('')
const joinCode = ref('')
const pending = ref(false)

async function createAndEnter() {
  const name = displayName.value.trim()
  if (!name) return
  pending.value = true
  const result = await room.createRoom(name)
  pending.value = false
  if (!result) return
  await navigateTo(`/salle/${result.code}`)
}

async function joinAndEnter() {
  const code = joinCode.value.trim().toUpperCase()
  const name = displayName.value.trim()
  if (!code || !name) return
  pending.value = true
  const result = await room.joinRoom(code, name)
  pending.value = false
  if (!result) return
  await navigateTo(`/salle/${result.code}`)
}

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-[16px] text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col items-center gap-2 text-center">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Mode réseau</span>
      <span class="font-display text-display-m uppercase tracking-caps text-primary">Salle en ligne</span>
      <p class="max-w-xs text-body-s text-secondary">
        Chacun son téléphone, une seule salle. Crée-la, ou rejoins-en une avec un code.
      </p>
    </div>

    <Card class="flex flex-col gap-3">
      <label class="font-display text-body-s uppercase tracking-caps text-secondary" for="salle-name">
        Ton nom de code
      </label>
      <input
        id="salle-name"
        v-model="displayName"
        :class="inputClass"
        placeholder="Ex. Marion"
        type="text"
        maxlength="24"
        autocomplete="off"
      >
    </Card>

    <Card class="flex flex-col gap-3">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Créer une salle</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">
          Tu deviens l'hôte : c'est toi qui choisis quand la mission commence.
        </div>
      </div>
      <Button size="l" class="w-full" :disabled="pending || !displayName.trim()" @click="createAndEnter()">
        {{ pending ? 'Création…' : 'Créer une partie' }}
      </Button>
    </Card>

    <Card class="flex flex-col gap-3">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Rejoindre avec un code</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">
          Le code t'a été transmis par l'hôte, ou tu as suivi son lien.
        </div>
      </div>
      <input
        v-model="joinCode"
        :class="[inputClass, 'text-center font-mono uppercase tracking-caps']"
        placeholder="AB12CD"
        type="text"
        maxlength="6"
        autocomplete="off"
      >
      <Button
        size="l"
        variant="secondary"
        class="w-full"
        :disabled="pending || !joinCode.trim() || !displayName.trim()"
        @click="joinAndEnter()"
      >
        {{ pending ? 'Connexion…' : 'Rejoindre' }}
      </Button>
    </Card>

    <Toast v-if="room.error.value" tone="danger">{{ room.error.value }}</Toast>
  </div>
</template>
