---
description: Official Nuxt 3, Vue 3, and Tailwind CSS coding standards from the web.
globs: client/**/*.vue, client/**/*.ts
alwaysApply: true
id: nuxt3-vue3-standards
version: 1.0.0
stage: Engineering
priority: P1
depends: []
---
# Vue 3 & Nuxt 3 Best Practices (Community Standard)

- **Composition API ONLY**: Exclusively use `<script setup lang="ts">`. Do not use the Options API (`export default { ... }`).
- **Auto-imports**: Rely on Nuxt 3 auto-imports. Do not manually import `ref`, `computed`, `watch`, `onMounted`, or Nuxt composables like `useRouter()`.
- **Tailwind CSS**: Use Tailwind utility classes for all styling. STRICTLY FORBIDDEN to use `<style scoped>` blocks or external CSS files for component-specific styles unless completely unavoidable (e.g., complex animations).
- **Naming Conventions**: 
  - Use PascalCase for component filenames (`MyComponent.vue`).
  - Use descriptive, functional naming for event handlers (e.g., `onSubmit`, `handleUpdate`).
- **Accessibility (a11y)**: Require `tabindex`, `aria-label`, `aria-pressed`, and keyboard event handlers (like `@keydown.enter`) for all custom interactive elements.
- **State**: Use Pinia for global state. Use local `ref()` for UI-only state.
