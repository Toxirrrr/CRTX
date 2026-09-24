# TINIQ Agency UI/UX Design Standards

**CRITICAL CONSTRAINT:**
When generating UI components or modifying CSS/Tailwind in the `client/` directory, you MUST strictly adhere to the TINIQ Premium Design Language.

## 1. Visual Identity & Theme
- **Premium B2B Dark Theme:** The primary aesthetic is dark, sleek, and high-contrast. Use deep blacks/grays for backgrounds (e.g., `bg-zinc-950`, `bg-black`) and crisp whites or subtle grays for text (`text-zinc-100`, `text-zinc-400`).
- **Glassmorphism:** Use backdrop filters and semi-transparent backgrounds for floating elements like navbars, modals, and dropdowns (e.g., `bg-black/50 backdrop-blur-md`).
- **Accents:** Use subtle, glowing, or gradient accents sparingly to draw attention.

## 2. Layout & Spacing
- **Fluid Spacing:** Do not hardcode pixel heights. Use fluid utilities (`p-4 sm:p-6 lg:p-8`).
- **Mobile-First Responsiveness:** Every component MUST look perfect on mobile devices (`< 640px`) before scaling up to desktop screens. Never forget mobile padding and touch targets.
- **Micro-interactions:** Add smooth transitions to all interactive elements (e.g., `transition-all duration-300 ease-in-out hover:scale-[1.02] active:scale-95`).

## 3. Typography
- Use Inter or the project's default sans-serif font.
- Maintain strict hierarchy: huge, tight headers (`text-4xl tracking-tight font-semibold`) and legible body copy (`text-sm leading-relaxed`).

## 4. Modern CSS Capabilities
- Avoid writing raw CSS. Use Tailwind arbitrary values if necessary.
- Always use CSS Grid or Flexbox for layout; never use floats or absolute positioning for structural layouts.
