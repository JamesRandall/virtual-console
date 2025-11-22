# Virtual Console DevKit React Coding Guidelines

For general TypeScript usage read the TypeScript guidelines that can be found at:

    ../../../specs/typescript-guide.md

Key source and specifications for the virtual console "hardware" can be found in

    ../console/src
    ../../../specs/hardware

## CSS and Styling

Consult the style guide here:

    ./styleguide.md

## State

* Use component local state where possible.
* Shared state should be managed using Zustand (the store can be found in src/application/devKitStore.ts).

## Component Structure

* Prefer functional components with hooks over class components.
* Order component internals consistently:
    1. Props destructuring
    2. Zustand store hooks
    3. Local state (useState)
    4. Refs (useRef)
    5. Computed values (useMemo)
    6. Effects (useEffect)
    7. Event handlers and callbacks
    8. Render helpers
    9. Return/JSX
* Extract complex JSX into separate render functions or sub-components.
* Keep components focused on a single responsibility.
* Introduce layout components to handle, and componentize, common Tailwind CSS patterns

## File Organization

* One component per file.
* Name files using PascalCase matching the component name (e.g., `MemoryViewer.tsx`).
* Co-locate component-specific types, constants, and utilities in the same file when used only by that component.
* Place shared utilities in appropriate subdirectories under `src/utils/`.

## Props and Types

* Always explicitly type component props using interfaces or types.
* Prefer interfaces for props definitions (better error messages, extendability).
* Avoid prop drilling beyond 2-3 levels—use Zustand store instead.
* Use discriminated unions for components with multiple modes/variants.
* Provide JSDoc comments for complex props or non-obvious behavior.

## Hooks

* Prefix custom hooks with `use` (e.g., `useRegisterState`).
* Extract reusable logic into custom hooks.
* Keep hooks at the top level of components—never conditional.
* Use `useCallback` for event handlers passed to child components to prevent unnecessary re-renders.
* Use `useMemo` for expensive computations, not as a premature optimization.
* Prefer `useEffect` with explicit dependencies over empty arrays unless truly mount-only.

## Event Handlers

* Name event handlers with `handle` prefix (e.g., `handleAddressChange`).
* For inline handlers passed as props, use arrow functions sparingly—prefer defined handlers.
* Avoid creating new function references in render unless necessary.

## Conditional Rendering

* Use early returns for guard clauses rather than nested ternaries.
* Prefer `&&` for simple conditional rendering.
* Use ternaries for if/else cases.
* Extract complex conditional logic into variables or functions.

## Lists and Keys

* Always provide stable, unique keys when rendering lists.
* Avoid using array indices as keys unless the list is static and never reordered.
* For virtual console data (registers, memory), use stable identifiers.

## Performance

* Use React DevTools Profiler to identify performance bottlenecks before optimizing.
* Wrap expensive components with `React.memo` when they receive the same props frequently.
* Leverage Zustand's selector pattern to subscribe only to needed state slices.
* Consider virtualization for large lists (registers, memory dumps, etc.).

## Error Handling

* Implement error boundaries for major sections of the devkit.
* Handle async errors explicitly in components.
* Provide meaningful error messages that help users diagnose console/hardware issues.

## Imports

* Group imports in this order:
    1. React and external libraries
    2. Application state (Zustand stores)
    3. Components
    4. Utilities and helpers
    5. Types
    6. Styles
* Use absolute imports for shared modules, relative for local files.

## Virtual console integration

* Use the `useVirtualConsole` hook to access the virtual console instance (it can be found in src/consoleIntegration/virtualConsole.tsx).
* Avoid making changes to the virtual console source files without approval (those files in ../console/src)
