---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
disable-model-invocation: false
activation-mode: on-request
scope: frontend-development
input-types:
  - design-requirements
  - component-specifications
  - ui-mockups
outputs:
  - production-ready-components
  - styled-interfaces
  - interactive-elements
safety-tier: standard
version: 1
---

# Skill: Frontend Design

## When to Use

Activate this skill when the user requests:

- Building web components, pages, or full applications
- Creating UI/UX interfaces with modern design
- Converting designs to code
- Building responsive layouts
- Implementing interactive elements
- Frontend development with React, TypeScript, or modern frameworks

**Trigger keywords**: "build", "create", "frontend", "component", "page", "UI", "interface", "design", "web app"

Do not activate for backend services, database operations, or CLI applications.

## Purpose

Generate production-grade frontend interfaces that are:
- Visually distinctive and polished
- Built with modern best practices
- Responsive and accessible
- Interactive and engaging
- Avoiding generic AI aesthetics

## Scope

### Included
- React components with TypeScript
- Modern CSS frameworks (Tailwind CSS)
- Component libraries (shadcn/ui)
- Responsive design patterns
- Interactive UI elements
- Icon integration (Lucide React)
- State management patterns
- Form handling and validation

### Excluded
- Backend API development
- Database schema design
- Server-side rendering configuration
- Build tooling setup
- Testing framework setup

## Inputs

- `requirements`: Description of what to build
- `framework`: Target framework (default: React + TypeScript)
- `styling`: Styling approach (default: Tailwind CSS)
- `components`: Component library preference (default: shadcn/ui)
- `features`: Specific functionality requirements
- `responsive`: Breakpoint requirements (default: mobile-first)

## Step-by-step Execution

1. **Requirements Analysis**
   - Parse user requirements and identify core components needed
   - Determine layout structure and responsive behavior
   - Identify interactive elements and state requirements

2. **Technology Stack Selection**
   - Use TypeScript for type safety
   - Apply Tailwind CSS for styling
   - Integrate shadcn/ui components where appropriate
   - Include Lucide React for icons

3. **Component Architecture**
   - Create modular, reusable components
   - Implement proper TypeScript interfaces
   - Follow React best practices (hooks, composition)
   - Ensure proper separation of concerns

4. **Styling Implementation**
   - Apply modern design principles
   - Use consistent spacing and typography scales
   - Implement responsive breakpoints
   - Add hover states and transitions

5. **Interactive Features**
   - Implement state management with useState/useReducer
   - Add form validation where needed
   - Include loading states and error handling
   - Add keyboard navigation support

6. **Quality Assurance**
   - Verify TypeScript compilation without errors
   - Ensure responsive behavior across breakpoints
   - Test interactive elements and accessibility
   - Validate design consistency

## Output Contract

### Code Structure
```
ComponentName/
├── ComponentName.tsx       # Main component
├── types.ts               # TypeScript interfaces
└── index.ts              # Export file
```

### Code Quality
- Strict TypeScript typing (no `any`)
- ESLint compliant code
- Consistent naming conventions
- Proper component composition
- Accessibility attributes (ARIA labels, semantic HTML)

### Design Quality
- Modern, professional appearance
- Consistent design system
- Responsive across mobile/tablet/desktop
- Smooth animations and transitions
- Intuitive user experience

## Verification Commands

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build verification (if applicable)
npm run build

# Format check
npx prettier --check src/
```

## Evidence Format

- **Screenshots**: Visual proof of responsive design
- **Code Quality**: TypeScript compilation without errors
- **Accessibility**: WCAG compliance verification
- **Performance**: Lighthouse scores (if applicable)
- **Cross-browser**: Testing across modern browsers

## Safety / DONTs

### Security
- Never hardcode API keys or sensitive data
- Sanitize user inputs in forms
- Use proper HTTPS for external resources
- Validate data before processing

### Performance
- Don't create unnecessarily deep component nesting
- Avoid inline styles for complex styling
- Don't load unused dependencies
- Minimize re-renders with proper React patterns

### Accessibility
- Don't omit alt text for images
- Always provide keyboard navigation
- Don't use color alone to convey information
- Ensure proper heading hierarchy

### Code Quality
- No `any` types in TypeScript
- Don't mix styling approaches (stay consistent with Tailwind)
- Don't create monolithic components
- Avoid hardcoded values (use design tokens)

## Verification Checklist

- [ ] TypeScript compiles without errors
- [ ] All components are properly typed
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Interactive elements respond appropriately
- [ ] Loading states are implemented where needed
- [ ] Error boundaries handle edge cases
- [ ] Accessibility attributes are present
- [ ] Code follows project conventions
- [ ] No console errors in browser
- [ ] Design is visually polished and distinctive
