# Visual Quality Review

Use this reference after implementation or when reviewing an existing interface.

## Composition

Check:

* alignment
* rhythm
* spacing
* grouping
* density
* balance
* visual flow

Questions:

* Where does the eye go first?
* Is that where it should go?
* Is the primary action obvious?
* Are sections visually related?

---

## Typography

Check:

* hierarchy
* font size
* font weight
* line height
* letter spacing
* text width
* truncation
* wrapping

Look for:

* too many font sizes
* weak heading hierarchy
* unreadable body text
* excessive bold text
* inconsistent labels

---

## Color

Check:

* semantic consistency
* contrast
* emphasis
* states
* dark/light behavior

Ask:

* Does color communicate meaning?
* Is color being used merely as decoration?
* Are important states distinguishable without relying only on color?

---

## Components

Check:

* consistency
* spacing
* states
* variants
* icon sizing
* button hierarchy
* input behavior

Look for:

* duplicated patterns
* unnecessary variants
* inconsistent radius
* inconsistent shadows
* inconsistent spacing

---

## Responsive

Check:

### Mobile

* navigation
* touch targets
* text wrapping
* horizontal overflow
* content order
* sticky elements

### Tablet

* intermediate layout
* navigation behavior
* density

### Desktop

* max width
* whitespace
* multi-column layouts
* sidebars
* large screens

---

## Accessibility

Check:

* keyboard navigation
* visible focus
* semantic HTML
* labels
* contrast
* screen reader meaning
* reduced motion
* touch target size

---

## Interaction

Check:

* hover
* focus
* active
* disabled
* loading
* success
* error
* transitions

Interaction should communicate state.

---

## Content Resilience

Test:

```text
very long title
very short title
missing image
missing description
large number
empty result
large collection
error
loading
```

---

## AI-Slop Review

Check for:

```text
generic gradient
glassmorphism
excessive cards
excessive pills
random shadows
decorative blobs
meaningless badges
unnecessary animation
generic dashboard structure
```

The objective is not to eliminate these techniques.

The objective is to ensure they are intentional.
