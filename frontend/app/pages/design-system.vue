<script setup lang="ts">
import { ref } from 'vue'
import { Eye, Settings } from '@lucide/vue'

const modalOpen = ref(false)
const voteTarget = ref<string | null>(null)
</script>

<template>
  <div class="flex flex-col gap-10">
    <header class="flex items-center gap-3">
      <img src="~/assets/images/logo-badge.jpg" alt="Undercover Infinite" class="h-9 w-9 rounded-sm object-contain" >
      <h1 class="font-display text-title uppercase tracking-caps text-primary">Undercover Infinite — Design System</h1>
    </header>

    <section class="flex flex-col gap-4">
      <h2 class="font-display text-body-s uppercase tracking-caps text-tertiary">Core</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="primary">Transmettre</Button>
        <Button variant="secondary">Confirmer</Button>
        <Button variant="ghost">Annuler</Button>
        <Button variant="danger">Compromettre</Button>
        <Button variant="primary" disabled>Verrouillé</Button>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <IconButton active><Eye :size="18" /></IconButton>
        <IconButton><Settings :size="18" /></IconButton>
        <RoleTag tone="danger">Grillé</RoleTag>
        <RoleTag tone="ally">Couverture intacte</RoleTag>
        <RoleTag tone="classified">Top Secret</RoleTag>
        <RoleTag tone="neutral">En attente</RoleTag>
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="font-display text-body-s uppercase tracking-caps text-tertiary">Data display</h2>
      <div class="flex gap-4">
        <Card glow="danger" class="flex flex-1 flex-col items-center gap-2">
          <Avatar initial="M" status="eliminated" :size="56" />
          <RoleTag tone="danger">Grillé</RoleTag>
        </Card>
        <Card class="flex flex-1 flex-col items-center gap-2">
          <Avatar initial="K" status="online" :size="56" />
          <RoleTag tone="ally">Couverture intacte</RoleTag>
        </Card>
      </div>
      <div class="flex flex-col gap-2">
        <PlayerRow name="Marion" status="active" is-host action-label="ACCUSER" @action="voteTarget = 'Marion'" />
        <PlayerRow name="Karim" status="active" action-label="ACCUSER" @action="voteTarget = 'Karim'" />
        <PlayerRow name="Sami" status="eliminated" />
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="font-display text-body-s uppercase tracking-caps text-tertiary">Feedback</h2>
      <ProgressTimer :pct="0.55" label="TRANSMISSION 00:47" />
      <ProgressTimer :pct="0.1" label="VOTE 00:08" danger />
      <div class="flex flex-wrap gap-3">
        <Toast tone="danger">Transmission interrompue — signal perdu</Toast>
        <Toast tone="success">Agent connecté</Toast>
      </div>
      <div>
        <Button variant="ghost" @click="modalOpen = true">Ouvrir le modal</Button>
      </div>
    </section>

    <Modal :open="modalOpen" title="Confirmer l'accusation" @close="modalOpen = false">
      <p class="mb-4 text-body-s text-secondary">Cette décision est irréversible.</p>
      <Button variant="danger" @click="modalOpen = false">Désigner cet agent</Button>
    </Modal>

    <Modal :open="!!voteTarget" title="Confirmer l'accusation" @close="voteTarget = null">
      <p class="mb-4 text-body-s text-secondary">
        Désigner {{ voteTarget }} comme agent double ? Cette décision est irréversible.
      </p>
      <div class="flex gap-2.5">
        <Button variant="ghost" @click="voteTarget = null">Annuler</Button>
        <Button variant="danger" @click="voteTarget = null">Désigner cet agent</Button>
      </div>
    </Modal>
  </div>
</template>
