# Vue 3 & Nuxt 3 AI Standards (Frontend)

**CRITICAL CONSTRAINT:**
When working in the `client/` directory (Frontend), you MUST follow these community-vetted Nuxt 3 standards. Do NOT write React code. Do NOT write Vue 2 Options API.

## Code Implementation Guidelines

1. **Composition API Only:** Always use Vue 3 `<script setup>` and the Composition API.
2. **Styling:** Always use Tailwind classes for styling HTML elements. Avoid using standard CSS files or `<style>` blocks unless absolutely necessary for complex animations.
3. **Control Flow:** Use early returns whenever possible to avoid deep nesting and make the code more readable.
4. **Naming Conventions:**
   - Use highly descriptive variable and function names.
   - Event handlers MUST be named with a `handle` prefix (e.g., `handleClick` for `@click` and `handleKeyDown` for `@keydown`).
5. **Accessibility:** Must implement accessibility features on interactive elements (e.g., `tabindex="0"`, `aria-label`, `@click`, and `@keydown.enter`).
6. **Arrow Functions:** Use `const` and arrow functions instead of standard `function` declarations (e.g., `const toggle = () => {}`). Define TypeScript types whenever possible.
7. **Completeness:** Leave NO todo's, placeholders, or missing pieces. Ensure code is complete, fully functional, and working.

## Architecture
- Use **Pinia** for global state.
- Use Nuxt 3 auto-imports for composables and components. Do not manually import Vue components if they are in the `components/` directory.
