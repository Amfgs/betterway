# Design Research Applied To Better Way

## [Open Design](https://github.com/nexu-io/open-design)

Open Design treats a root `DESIGN.md` as a portable brand contract that can be
read by coding agents and design tooling. Better Way adopts that contract while
keeping runtime code independent from the Open Design desktop application.

Applied here:

- Nine documented sections covering atmosphere, tokens, components, layout,
  elevation, guardrails, responsiveness and agent guidance.
- A product-specific system rather than copying a catalog theme.
- Versioned decisions that future frontend changes can follow.

## [shadcn/ui](https://github.com/shadcn-ui/ui)

The strongest principle is ownership: accessible component code belongs to the
application and can be adapted instead of hidden behind a theme package.

Applied here:

- Local components and semantic HTML remain the source of truth.
- Consistent focus-visible, disabled, loading and error states.
- No new runtime component framework or global theme dependency.

## [Material UI](https://github.com/mui/material-ui)

Material UI demonstrates the value of a complete token layer and predictable
component behavior across a large React surface.

Applied here:

- Semantic color, elevation, spacing and motion roles.
- Stable form-control and navigation states in light and dark themes.
- Responsive behavior defined structurally instead of by fluid product type.

## [Ant Design](https://github.com/ant-design/ant-design)

Ant Design is particularly strong at presenting dense operational information
without losing hierarchy.

Applied here:

- Clear page purpose, key state, primary task and secondary detail order.
- Compact tabs, metrics, forms and data visualizations.
- Progressive disclosure for planning specifications and advanced actions.

## Better Way Direction

The resulting interface is not a generic fintech template. Its marketing
surface is confident and image-led; its product surface is a calm personal
workspace. Existing forest green and lime remain recognizable, while lime is
used more selectively and information density is organized around decisions.
