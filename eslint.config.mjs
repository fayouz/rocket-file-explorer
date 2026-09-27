import withNuxt from './playground/.nuxt/eslint.config.mjs'

export default withNuxt({
  files: ['playground/app/pages/**/*.vue'],
  rules: { 'vue/multi-word-component-names': 'off' },
})
