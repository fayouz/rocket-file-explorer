// Bac à sable du module : l'explorateur branché sur un adaptateur en mémoire (aucun serveur).
export default defineNuxtConfig({
  extends: ['..'],
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  compatibilityDate: '2026-09-01',
})
