# Layer UI concepts

Open each HTML file directly in a browser. Colours are Catppuccin Mocha tokens on `:root`, so a theme is a token swap.

**A · Stack** (`a-stack.html`). Layers are a vertical stack in a side column: Default is the base at the bottom and overlays rise above it, with elbow connectors showing what each one hangs off. Add, rename and delete happen inline in the stack, and the delete state lists the keys that break. Better than now because the reach relationship is the layout itself, not a label. Trade-off: the stack takes a 360px column, and it gets long past about 8 layers.

**B · Map** (`b-map.html`). A horizontal graph of layer nodes above the board, with hold and toggle edges drawn between them and an unreachable layer shown as a dashed amber node. Better than now because "how do I get to Windows" is answered by following one arrow, and Mod's problem is visible at a glance. Trade-off: the graph needs a fixed-width canvas, so it is desktop-only, and reordering on a graph is less natural than in a list.

**C · Keyboardy** (`c-keyboardy.html`). Layers are keycaps on a plate, like a function row. The active layer is a latched, depressed cap, and the reach readout shows two mini keyboards with the physical key that opens each step. Better than now because it feels like part of the keyboard and explains reach with the hardware. Trade-off: it is the most playful of the three and the least dense, and the physical metaphor breaks down with many layers.
