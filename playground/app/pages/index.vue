<script setup lang="ts">
import type { ExplorerItem } from '#file-explorer'

// Bac à sable : l'explorateur sur un adaptateur en mémoire ; une action de l'application (« Changer le type… »).
const adapter = createMemoryAdapter() as ReturnType<typeof createMemoryAdapter> & { setType(id: string | number, type: string): void }
const explorer = ref<{ refresh(): Promise<void> } | null>(null)
const locked = ref(false)
const readonly = ref(false)
const typeItem = ref<ExplorerItem | null>(null)
const typeValue = ref('invoice')
function onAction(id: string, items: ExplorerItem[]) {
  if (id === 'type') typeItem.value = items[0] ?? null
}
async function saveType() {
  if (!typeItem.value) return
  adapter.setType(typeItem.value.id, typeValue.value)
  typeItem.value = null
  await explorer.value?.refresh()
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4 p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">@rocket/file-explorer</h1>
      <div class="flex gap-4">
        <USwitch v-model="locked" label="Verrouillé sur un espace" />
        <USwitch v-model="readonly" label="Lecture seule" />
      </div>
    </div>
    <RocketFileExplorer :key="`${locked}`" ref="explorer" :adapter="adapter" :space="locked ? 1 : undefined" :readonly="readonly" height="calc(100vh - 8rem)" @action="onAction" />
    <UModal :open="!!typeItem" :title="typeItem?.name" @update:open="typeItem = null">
      <template #body>
        <USelect v-model="typeValue" :items="[{ label: 'Facture', value: 'invoice' }, { label: 'Contrat', value: 'contract' }, { label: 'Photo', value: 'photo' }]" class="w-full" />
      </template>
      <template #footer>
        <UButton label="Enregistrer" @click="saveType" />
      </template>
    </UModal>
  </div>
</template>
