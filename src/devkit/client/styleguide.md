# Virtual Console DevKit Style Guide

This style guide establishes visual consistency across the Virtual Console DevKit application using Tailwind CSS. Typography and padding are the primary tools for communicating importance and structure.

---

## Color Palette

### Background Colors

- **Primary Background**: `bg-zinc-800` - Main application background
- **Secondary Background**: `bg-zinc-900` - Deep background for contrast
- **Elevated Background**: `bg-zinc-700` - Elevated surfaces (active tabs, selected items)
- **Hover Background**: `bg-zinc-600` - Hover states for interactive elements

### Border Colors

- **Primary Border**: `border-zinc-700` - Standard borders throughout the application
- **Subtle Border**: `border-zinc-800` - Very subtle divisions

### Text Colors

- **Primary Text**: `text-zinc-200` - Main text content
- **Secondary Text**: `text-zinc-400` - Labels, less important text
- **Tertiary Text**: `text-zinc-500` - Hints, metadata
- **Muted Text**: `text-zinc-600` - Very subtle text
- **Monospace Primary**: `text-zinc-300` - Primary monospace content (hex values, code)
- **Monospace Secondary**: `text-zinc-500` - Secondary monospace content (addresses, labels)
- **Monospace Muted**: `text-zinc-600` - Muted monospace content (non-printable chars)

### Accent Colors

- **Success/Active**: `text-green-400` - Active states, success indicators
- **Danger**: `text-red-400`, `text-red-600` - Destructive actions, errors, important markers
- **Warning**: `text-amber-500` - Warnings, unsaved changes

---

## Typography

### Hierarchy

Typography establishes visual hierarchy and importance. Use size and weight together:

1. **Page Title** (highest importance)
   - `text-xl font-semibold text-zinc-100`
   - Usage: Dialog titles, major section headers

2. **Section Header** (high importance)
   - `text-sm font-semibold text-zinc-200`
   - Usage: Panel headers, toolbar titles

3. **Subsection Header** (medium importance)
   - `text-sm font-medium text-zinc-200`
   - Usage: Group labels, tree headers

4. **Body Text** (standard)
   - `text-sm text-zinc-200`
   - Usage: Standard content, button labels

5. **Secondary Text** (low importance)
   - `text-xs text-zinc-400` or `text-sm text-zinc-400`
   - Usage: Metadata, hints, helper text

6. **Tertiary Text** (very low importance)
   - `text-xs text-zinc-500`
   - Usage: Status indicators, subtle metadata

### Monospace Text

For code, hex values, and technical content:

- **Standard Monospace**: `font-mono text-sm`
- **Small Monospace**: `font-mono text-xs`

---

## Spacing System

Consistent spacing creates visual rhythm. Use the scale below based on the relationship between elements:

### Internal Spacing (Padding)

Padding suggests the importance of content within a container:

1. **Large Container** (p-6): `p-6`
   - Usage: Dialog content, major panels with high-importance content

2. **Standard Container** (p-4): `p-4`
   - Usage: Default panels, toolbars, most containers

3. **Compact Container** (p-3): `px-3 py-2` or `p-3`
   - Usage: Headers, compact panels, tree nodes

4. **Tight Container** (p-2): `p-2`
   - Usage: Dense information displays (memory view controls)

5. **Minimal Container** (p-1): `px-2 py-1`
   - Usage: Icon buttons, very compact controls

### External Spacing (Margins & Gaps)

Use consistent gaps between related elements:

- **Large Gap** (gap-6): `gap-6` - Between major UI sections
- **Standard Gap** (gap-4): `gap-4` - Between related groups
- **Compact Gap** (gap-3): `gap-3` - Between UI controls in a toolbar
- **Small Gap** (gap-2): `gap-2` - Between tightly related elements
- **Tight Gap** (gap-1): `gap-1` - Between label and value, icon and text
- **Minimal Gap** (gap-0.5): `gap-1.5` - Between very tightly coupled items

### Vertical Rhythm

For stacked content, use consistent bottom margins:

- **Section Spacing**: `mb-4` - Between major sections
- **Group Spacing**: `mb-3` - Between groups within a section
- **Item Spacing**: `mb-2` - Between items in a list
- **Inline Spacing**: `mb-1` - Between tightly related inline elements

---

## Component Patterns

### Buttons

#### Primary Action Button
```
className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-700 text-white text-sm font-medium rounded transition-colors"
```
- Usage: Main actions (Run, Stop, Create)

#### Secondary Action Button
```
className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm rounded transition-colors"
```
- Usage: Less important actions

#### Icon Button
```
className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 rounded text-sm transition-colors"
```
- Usage: Icon-only buttons in toolbars

#### Danger Button
```
className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
```
- Usage: Destructive actions (Delete)

#### Text Button
```
className="text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
```
- Usage: Inline links, subtle actions

#### Disabled State
Add to any button:
```
disabled:bg-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-600
```

### Panels

#### Standard Panel
```tsx
<div className="p-4 bg-zinc-800">
  {/* content */}
</div>
```

#### Panel with Border (Top)
```tsx
<div className="p-4 bg-zinc-800 border-t border-zinc-700">
  {/* content */}
</div>
```

#### Panel with Border (Bottom)
```tsx
<div className="p-4 bg-zinc-800 border-b border-zinc-700">
  {/* content */}
</div>
```

#### Compact Panel
```tsx
<div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700">
  {/* content */}
</div>
```

### Toolbars

#### App Toolbar (Primary)
```tsx
<div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
  <div className="flex items-center gap-4">
    {/* left content */}
  </div>
  <div className="flex items-center gap-3">
    {/* right content */}
  </div>
</div>
```

#### Section Toolbar
```tsx
<div className="flex items-center gap-3 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
  {/* toolbar content */}
</div>
```

#### Debug Toolbar (Bottom)
```tsx
<div className="flex justify-between items-center p-4 bg-zinc-800 border-t border-zinc-700">
  {/* toolbar content */}
</div>
```

### Tabs

#### Tab Container
```tsx
<div className="flex border-b border-zinc-700 bg-zinc-800 overflow-x-auto">
  {/* tabs */}
</div>
```

#### Active Tab
```tsx
<button className="px-3 py-2 text-sm font-medium text-white bg-zinc-700 border-r border-zinc-700">
  {label}
</button>
```

#### Inactive Tab
```tsx
<button className="px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border-r border-zinc-700 transition-colors">
  {label}
</button>
```

### Forms

#### Text Input
```tsx
<input className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500" />
```

#### Input Label
```tsx
<label className="text-sm text-zinc-400">
  {label}
</label>
```

#### Input Group (Label + Input)
```tsx
<div className="flex items-center gap-2">
  <label className="text-sm text-zinc-400">{label}:</label>
  <input className="..." />
</div>
```

### Dialogs

#### Dialog Backdrop
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
```

#### Dialog Container
```tsx
<div className="bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
```

#### Dialog Header
```tsx
<div className="flex items-center justify-between p-6 border-b border-zinc-700">
  <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
  {/* close button */}
</div>
```

#### Dialog Content
```tsx
<div className="p-6 overflow-y-auto flex-1">
  {/* content */}
</div>
```

### Context Menus

#### Menu Container
```tsx
<div className="bg-zinc-700 border border-zinc-600 rounded shadow-lg py-1 z-50">
```

#### Menu Item
```tsx
<button className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-600 flex items-center gap-2 transition-colors">
```

#### Danger Menu Item
```tsx
<button className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-600 flex items-center gap-2 transition-colors">
```

### Tree Views

#### Tree Node (Default)
```tsx
<div className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-zinc-700 transition-colors">
```

#### Tree Node (Selected)
```tsx
<div className="flex items-center gap-2 px-2 py-1 cursor-pointer bg-zinc-600">
```

---

## Layout Patterns

### Full-Height Containers

For containers that should fill available height:

```tsx
<div className="h-full flex flex-col">
  {/* header - fixed height */}
  <div className="...">Header</div>

  {/* content - grows to fill */}
  <div className="flex-1 min-h-0 overflow-auto">
    Content
  </div>

  {/* footer - fixed height */}
  <div className="...">Footer</div>
</div>
```

### Split Layouts

Use consistent patterns with Allotment for split views:

```tsx
<Allotment>
  <Allotment.Pane minSize={200} preferredSize={250}>
    {/* sidebar */}
  </Allotment.Pane>
  <Allotment.Pane>
    {/* main content */}
  </Allotment.Pane>
</Allotment>
```

---

## Common Patterns

### Header with Title and Action

```tsx
<div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
  <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
  <button className="text-zinc-400 hover:text-zinc-200 text-xs transition-colors">
    {action}
  </button>
</div>
```

### Info Display (Label + Value)

#### Horizontal Layout
```tsx
<div className="flex gap-1">
  <span className="text-zinc-500">{label}:</span>
  <span className="text-zinc-300">{value}</span>
</div>
```

#### With Multiple Items
```tsx
<div className="flex gap-4">
  <div className="flex gap-1">
    <span className="text-zinc-500">Label 1:</span>
    <span className="text-zinc-300">{value1}</span>
  </div>
  <div className="flex gap-1">
    <span className="text-zinc-500">Label 2:</span>
    <span className="text-zinc-300">{value2}</span>
  </div>
</div>
```

### Icon with Text

```tsx
<div className="flex items-center gap-1.5">
  <FontAwesomeIcon icon={icon} className="text-xs" />
  <span>{text}</span>
</div>
```

---

## Transition Effects

Always include smooth transitions for interactive elements:

```
transition-colors
```

Use this on:
- Buttons (background, text color changes)
- Tabs (background, text color changes)
- Links (text color changes)
- Menu items (background changes)
- Tree nodes (background changes)

---

## Accessibility

### Focus States

Always include visible focus states for keyboard navigation:

```
focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-800
```

For inputs:
```
focus:outline-none focus:border-zinc-500
```

### Disabled States

Clearly indicate disabled states:
```
disabled:bg-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-600
```

---

## Migration Checklist

When updating existing components:

- [ ] Replace `gray-*` colors with `zinc-*` equivalents
- [ ] Standardize `border-zinc-300` to `border-zinc-700`
- [ ] Use padding scale: p-6 (dialogs) > p-4 (panels) > px-3 py-2 (headers) > p-2 (compact)
- [ ] Use gap scale: gap-6 > gap-4 > gap-3 > gap-2 > gap-1.5 > gap-1
- [ ] Apply typography hierarchy: font-semibold for headers, font-medium for subsections
- [ ] Add `transition-colors` to all interactive elements
- [ ] Verify button padding: Primary actions `px-3 py-1.5`, Icon buttons `px-2 py-1`
- [ ] Check text colors: Primary `zinc-200`, Secondary `zinc-400`, Tertiary `zinc-500`

---

## Examples from Codebase

### Before (Inconsistent)

```tsx
// Multiple padding styles
<Panel padding="p-2" />  // MemoryView
<Panel padding="p-4" />  // Default
<div className="p-4 border-t border-zinc-300">  // DebugToolbar
<div className="px-3 py-1">  // AppToolbar

// Mixed color systems
<span className="text-gray-500">  // MemoryView
<span className="text-zinc-500">  // AppToolbar

// Mixed border colors
<div className="border-zinc-300">  // Panel
<div className="border-zinc-700">  // TabStrip
```

### After (Consistent)

```tsx
// Standardized padding based on importance
<div className="p-6">  // High importance (dialogs)
<div className="p-4">  // Standard importance (panels, toolbars)
<div className="px-3 py-2">  // Compact (headers, tight areas)
<div className="p-2">  // Dense information (controls)

// Unified color system (zinc only)
<span className="text-zinc-500">  // Labels everywhere
<span className="text-zinc-300">  // Values in monospace
<span className="text-zinc-200">  // Primary text

// Consistent borders
<div className="border-zinc-700">  // Standard border
<div className="border-b border-zinc-700">  // Bottom border
```

---

## Notes

- **Importance through hierarchy**: Larger padding and bolder typography = more important
- **Structure through spacing**: Consistent gaps create clear visual relationships
- **Zinc everywhere**: Avoid gray-* colors, use zinc-* for consistency
- **Transitions always**: Add `transition-colors` to interactive elements for polish
- **Font weights matter**: Use semibold sparingly for maximum impact on important headers
