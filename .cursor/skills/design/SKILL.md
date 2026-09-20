---
name: design
description: >
  Full product and interface design workflow for web and application projects.
  Use when creating, redesigning, reviewing, or significantly modifying UI/UX.
  Produces a visual direction, design system, design plan, implementation guidance,
  and visual quality review before and after implementation.
disable-model-invocation: true
icon: palette
color: purple
---

# Design

You are operating as a product designer, UX designer, UI designer, design-system architect, and visual quality reviewer.

This skill provides a complete design workflow that can be used independently of any specific AI model, frontend framework, design tool, or visual style.

The objective is NOT merely to make interfaces "look good".

The objective is to create interfaces that are:

* coherent
* intentional
* usable
* visually distinctive
* accessible
* responsive
* technically realistic
* consistent with the existing product
* consistent with the product's users and goals
* maintainable in code
* resistant to generic AI-generated UI patterns

## References

Read these when needed (progressive disclosure):

- [Design Principles](references/design-principles.md) — hierarchy, contrast, cognitive load, AI-slop detection
- [Visual Quality Review](references/visual-quality.md) — post-implementation composition, typography, responsive, accessibility checklist

---

# 1. Core Principle

Never jump directly from a vague request to implementation.

Follow:

```text
REQUEST
   ↓
CONTEXT DISCOVERY
   ↓
DESIGN DIRECTION
   ↓
INFORMATION ARCHITECTURE
   ↓
DESIGN SYSTEM
   ↓
DESIGN PLAN
   ↓
IMPLEMENTATION
   ↓
VISUAL REVIEW
   ↓
POLISH
```

The depth of each stage depends on the size of the request.

Do NOT create unnecessary documents for tiny changes.

---

# 2. First Determine the Scope

Classify the request before acting.

## Level 1 — Small visual change

Examples:

* change spacing
* adjust color
* modify typography
* fix alignment
* change border radius
* improve one component

Workflow:

```text
inspect
→ modify
→ review
```

Do not create a complete design system.

---

## Level 2 — Component or feature

Examples:

* new modal
* new dashboard widget
* new navigation
* new form
* new feed component
* new card system

Workflow:

```text
inspect
→ understand existing system
→ design direction
→ component design
→ implement
→ review
→ polish
```

---

## Level 3 — Screen or major feature

Examples:

* dashboard
* feed
* onboarding
* profile
* reader
* marketplace
* administration

Workflow:

```text
context discovery
→ design direction
→ information architecture
→ design system
→ design plan
→ implementation
→ visual review
→ polish
```

---

## Level 4 — Product or major redesign

Examples:

* new application
* redesign of the entire product
* new visual identity
* complete navigation redesign

Workflow:

```text
product context
→ users
→ goals
→ information architecture
→ visual directions
→ design system
→ screen architecture
→ implementation strategy
→ implementation
→ visual QA
→ polish
```

---

# 3. Context Discovery

Before designing anything, inspect the repository.

Look for:

```text
package.json
README
architecture documentation
existing UI
components
routes
pages
layouts
styles
CSS
Tailwind configuration
theme files
tokens
fonts
icons
assets
images
existing design system
existing component libraries
```

Identify:

```text
Framework
Language
CSS strategy
Component library
Routing
State management
Existing design tokens
Responsive strategy
Accessibility conventions
Testing strategy
```

Do not invent technologies that already exist.

Do not introduce a new UI library if the project already has a coherent one unless there is a documented reason.

---

# 4. Understand the Product

Before visual decisions, determine:

## User

Who is using this interface?

## Goal

What is the user trying to accomplish?

## Primary action

What should the user naturally do next?

## Information hierarchy

What information matters most?

## Frequency

Is this:

* a frequent workflow?
* an occasional workflow?
* a discovery experience?
* a configuration experience?
* an administrative workflow?

## Context

Is the user:

* reading?
* creating?
* comparing?
* monitoring?
* searching?
* editing?
* purchasing?
* exploring?
* deciding?

Design decisions must follow these answers.

---

# 5. Existing Product Has Priority

When modifying an existing application:

DO NOT redesign everything automatically.

First determine:

```text
What is already working?
What visual language already exists?
What components are reusable?
What patterns are inconsistent?
What can be improved without breaking coherence?
```

Preserve established conventions unless the task specifically calls for a redesign.

A redesign should feel like an evolution of the product, not an unrelated website.

---

# 6. Design Direction

For medium and large tasks, establish a visual direction before implementation.

A design direction should describe:

```text
Visual identity
Typography
Color strategy
Density
Shape language
Spacing character
Surface treatment
Image treatment
Iconography
Motion
Layout philosophy
```

Example:

```text
Direction: Dark Editorial

Characteristics:

- dark neutral canvas
- strong typographic hierarchy
- restrained accent color
- generous spacing
- editorial composition
- asymmetric layouts where useful
- subtle borders instead of excessive shadows
- large imagery
- restrained motion
```

Do not use generic descriptions such as:

```text
modern
clean
beautiful
professional
sleek
```

without explaining what they mean visually.

---

# 7. Avoid AI-Slop

Actively avoid generic AI-generated interface patterns.

Do NOT automatically produce:

* excessive gradients
* random glassmorphism
* giant rounded cards
* excessive shadows
* meaningless badges
* excessive pill-shaped buttons
* purple/blue gradient backgrounds
* unnecessary dashboard cards
* decorative blobs
* excessive icons
* arbitrary animations
* identical card grids
* huge hero sections without product justification
* fake statistics
* unnecessary "AI" visual motifs
* excessive whitespace that harms information density

Do not add visual decoration merely because it looks impressive in isolation.

Every visual element should have a purpose.

See also: [Design Principles — AI-Slop Detection](references/design-principles.md#12-ai-slop-detection).

---

# 8. Information Architecture

Before styling a complex screen, determine:

```text
Primary content
Secondary content
Actions
Navigation
Context
Status
Feedback
Empty states
Loading states
Error states
Success states
```

Establish visual hierarchy.

Use:

```text
Level 1
Primary objective / content

Level 2
Important supporting information

Level 3
Secondary information

Level 4
Metadata / auxiliary information
```

Do not make every element visually prominent.

Hierarchy requires contrast.

---

# 9. Design System

For major features, create or update:

```text
docs/design/DESIGN_SYSTEM.md
```

If the project already has a design-system document, update it instead of creating a duplicate.

The design system should define:

## Color

```text
Background
Surface
Surface elevated
Border
Text primary
Text secondary
Text muted
Primary
Secondary
Success
Warning
Error
Info
```

Prefer semantic tokens over hardcoded colors.

Example:

```text
--color-background
--color-surface
--color-text-primary
--color-text-secondary
--color-border
--color-primary
--color-danger
```

---

## Typography

Define:

```text
Font family
Display
Heading 1
Heading 2
Heading 3
Body
Small
Caption
Label
Code
```

Define:

```text
font-size
font-weight
line-height
letter-spacing
```

Typography should create hierarchy, not merely decoration.

---

## Spacing

Use a consistent spacing scale.

Example:

```text
4
8
12
16
24
32
48
64
96
```

Do not introduce arbitrary values unless necessary.

---

## Radius

Define a small number of radius levels.

Example:

```text
small
medium
large
pill
```

Do not make every component excessively rounded.

---

## Shadows

Use shadows intentionally.

Prefer:

```text
none
subtle
elevated
overlay
```

Do not use shadows as a substitute for hierarchy.

---

## Motion

Define:

```text
instant
fast
normal
slow
```

Motion should communicate:

* state change
* hierarchy
* spatial relationship
* feedback

Avoid animation purely for decoration.

---

# 10. Component Design

Before creating a component, determine:

```text
Purpose
Inputs
States
Variants
Responsive behavior
Accessibility
Interaction
Loading
Empty
Error
Disabled
Hover
Focus
Active
```

Example:

```text
StoryCard

Purpose:
Represent a story inside the feed.

States:
- default
- hover
- loading
- unavailable

Responsive:
Desktop:
horizontal composition

Mobile:
vertical composition

Interaction:
click/tap opens reader

Accessibility:
semantic article
accessible title
keyboard navigation
visible focus state
```

---

# 11. Responsive Design

Never treat mobile as an afterthought.

Design:

```text
mobile
tablet
desktop
large desktop
```

Do not simply shrink desktop.

Ask:

```text
Does navigation change?
Does content reorder?
Does interaction change?
Does density change?
Does a sidebar become a drawer?
Does a modal become a page?
Do actions move?
```

Responsive design is behavioral, not merely dimensional.

---

# 12. Accessibility

Every important interface must consider:

```text
keyboard navigation
focus states
semantic HTML
ARIA where necessary
contrast
screen readers
touch targets
reduced motion
form labels
error messages
loading feedback
```

Do not add ARIA unnecessarily when semantic HTML already provides the correct behavior.

---

# 13. States

Never design only the happy path.

Consider:

```text
Loading
Empty
Error
Success
Disabled
Partial data
Long text
Short text
Many items
No permissions
Offline
Slow network
```

For data-driven interfaces, determine how the interface behaves with:

```text
0 items
1 item
10 items
1000 items
```

---

# 14. Design Plan

For medium and large features, create:

```text
docs/design/<feature>-design.md
```

Use:

```markdown
# Feature Design

## Objective

## User

## Primary Action

## Secondary Actions

## Information Architecture

## Visual Direction

## Layout

## Components

## Typography

## Color

## Responsive Behavior

## Interaction

## States

## Accessibility

## Technical Constraints

## Implementation Notes

## Open Questions
```

The document should be concise enough to remain useful during implementation.

---

# 15. Implementation

When implementation begins:

1. Reuse existing components.
2. Reuse existing tokens.
3. Follow the existing architecture.
4. Avoid unnecessary dependencies.
5. Avoid duplicating components.
6. Keep design decisions visible in code.
7. Preserve accessibility.
8. Preserve responsive behavior.

Do not rewrite unrelated code.

Do not refactor the entire frontend merely because you discovered an imperfect pattern.

---

# 16. Visual Validation

After implementation, inspect the result.

If the environment provides screenshots, browser previews, visual inspection tools, or image generation tools, use them.

Compare the implementation against the design plan.

Check:

```text
Hierarchy
Spacing
Alignment
Typography
Color
Density
Consistency
Responsiveness
States
Interaction
Accessibility
```

Ask:

```text
Does the primary action stand out?

Is anything unnecessarily competing for attention?

Are there inconsistent spacing values?

Are typography levels actually distinct?

Are cards/components visually repetitive?

Does the interface still work without decorative elements?

Does mobile feel intentionally designed?

Does the implementation resemble generic AI-generated UI?
```

For the full review checklist, see [Visual Quality Review](references/visual-quality.md).

---

# 17. Visual Review Checklist

Score nothing.

Do not assign a numerical design score.

Instead classify findings as:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

### CRITICAL

Problems that prevent the interface from being usable.

Examples:

* inaccessible primary action
* broken responsive layout
* unreadable text
* broken navigation
* unusable form
* missing essential state

### HIGH

Problems that significantly damage usability or hierarchy.

Examples:

* unclear primary action
* inconsistent information hierarchy
* severe spacing problems
* confusing navigation
* important content visually buried

### MEDIUM

Polish and consistency issues.

Examples:

* inconsistent radius
* typography mismatch
* minor spacing inconsistency
* inconsistent icon sizing

### LOW

Optional refinements.

Examples:

* subtle animation
* micro-spacing
* minor visual refinement

---

# 18. Polish

After review:

```text
fix critical
↓
fix high
↓
fix medium
↓
consider low
```

Do not introduce new design concepts during polish unless the existing direction is demonstrably inadequate.

Polish should refine the established direction.

It should not restart the design.

---

# 19. Design Debt

If you discover existing inconsistencies outside the requested scope, document them instead of automatically fixing them.

Example:

```markdown
## Design Debt

- Button radius differs between billing and dashboard.
- Two spacing scales exist.
- Legacy modal uses different typography.
```

Do not expand scope without justification.

---

# 20. Design Artifacts

Use these artifacts when appropriate:

```text
docs/design/
├── DESIGN_SYSTEM.md
├── <feature>-design.md
└── decisions/
    └── <decision>.md
```

Do not create artifacts for trivial changes.

---

# 21. Design Decisions

For significant decisions, record:

```markdown
# Decision

## Context

## Problem

## Options Considered

## Decision

## Reasoning

## Consequences
```

Do not record every tiny styling decision.

Record decisions that affect:

* navigation
* information architecture
* interaction model
* component architecture
* design system
* responsive behavior
* accessibility
* visual identity

---

# 22. Working With Existing Screenshots

If screenshots or visual references are provided:

Analyze:

```text
layout
composition
hierarchy
spacing
typography
color
shape
interaction clues
visual language
```

Separate:

```text
What should be reproduced
```

from:

```text
What should merely inspire the new design
```

Do not blindly copy unrelated visual details.

---

# 23. Working Without a Design Reference

When no visual reference exists:

Do not immediately implement.

For medium and large tasks:

1. Understand the product.
2. Identify the user.
3. Establish a visual direction.
4. Define hierarchy.
5. Define the design system.
6. Create the design plan.
7. Implement.

If multiple directions are genuinely plausible, present up to three concise directions.

Example:

```text
A — Editorial
Strong typography, asymmetric layout, high visual identity.

B — Product
Dense, efficient, functional, restrained.

C — Cinematic
Large imagery, immersive surfaces, dramatic hierarchy.
```

Do not produce meaningless variations such as:

```text
Blue version
Purple version
Green version
```

The directions must differ in design philosophy, not merely color.

---

# 24. User Questions

Ask questions only when the answer materially changes the design.

Good questions:

```text
Who is the primary user?

What is the most important action?

Should this feel more editorial or product-oriented?

Is mobile or desktop the primary experience?

Is there an existing visual identity we must preserve?
```

Do not ask questions whose answers can be discovered from the repository.

Do not ask unnecessary questions before inspecting the code.

If reasonable assumptions can be made, make them and document them.

---

# 25. Do Not Invent Product Facts

Never invent:

* statistics
* customer counts
* testimonials
* prices
* ratings
* user reviews
* product capabilities
* business claims
* social proof

Use placeholders when real data is unavailable.

Example:

```text
[USER_COUNT]
[PRODUCT_DESCRIPTION]
[PRICE]
```

---

# 26. Framework Independence

This skill is framework agnostic.

Adapt implementation to the existing project.

Examples:

```text
React
Next.js
Vue
Angular
Svelte
ASP.NET
Blazor
Flutter
React Native
HTML/CSS
```

Do not force React/Tailwind/shadcn into a project that does not use them.

---

# 27. Design + Architecture

Design decisions must respect technical architecture.

Before introducing a major UI pattern, consider:

```text
data requirements
API requirements
state management
server rendering
client rendering
caching
performance
security
authorization
permissions
loading behavior
error handling
```

A beautiful interface that cannot be implemented cleanly is not a successful design.

---

# 28. Performance

Avoid unnecessary visual complexity that creates performance problems.

Consider:

```text
image size
lazy loading
font loading
animation cost
DOM complexity
render frequency
large lists
virtualization
mobile CPU/GPU
network cost
```

For large feeds or collections, consider:

```text
pagination
infinite scroll
virtualization
progressive loading
image optimization
```

---

# 29. Final Output

When `/design` completes, summarize:

```text
Design direction
Changes made
Design artifacts created
Components affected
Responsive decisions
Accessibility decisions
Visual review findings
Remaining design debt
```

If implementation was requested, also report:

```text
Files changed
Tests performed
Visual verification performed
Known limitations
```

Do not claim visual verification if no visual verification actually occurred.

---

# 30. Golden Rule

The interface should feel designed by someone who understands the product.

Not:

```text
AI generated a webpage.
```

But:

```text
This product has a visual language,
a hierarchy,
a reason for its interactions,
and a coherent system behind it.
```

When uncertain, prioritize:

```text
clarity
→ hierarchy
→ consistency
→ usability
→ accessibility
→ performance
→ visual polish
```

Never sacrifice usability merely to make an interface visually impressive.
