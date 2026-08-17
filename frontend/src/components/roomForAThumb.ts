// Padding a finger lands on, given straight back to the layout, so a control drawn as text on a line can be hit without anything on that line moving.

// The padding grows the box a finger lands on to 44 in both directions; the negative margin takes the same amount back out, so no row changes height and no row changes width. The floor is about **tappable area, not visible size** -- said out loud because a rule read as "44px tall" is one somebody argues an exemption out of the first time it would double a dense table, and this needs no exemption at all.

// Written here rather than beside one of its users, which is the whole reason it exists. It was in `WayOut`, with the reasoning above it, and the sibling two files away -- the same shape pointing the other way, drawn as text on a line in exactly the same manner -- did not have it. `Add a line`, `Change` and `Split payment` were 20px high, and four row expanders on `What it went on` with them. **A principle written in a comment beside one implementation is a principle with one user.**

// The horizontal half came from `Cancel`, which was 44 high and 43 wide: a text-drawn control is exactly as wide as its own word, and WCAG 2.5.5 asks for 44 in both directions. `min-width` cannot do it -- these are inline, and `min-width` does not apply to a non-replaced inline box -- so the padding grows it sideways too.

// **The give-back does not.** `-mx-2` took the sixteen pixels back out of the line, and a line is shared: on `sure-you-want-to` the confirmation and its cancel sit in a row with a 12px gap, each pulled 8px toward the other, so their hit areas **overlapped by four pixels** -- on the pair where a mis-tap removes a row somebody has to re-enter. The vertical give-back is safe for the opposite reason: a row owns its own height, and taking 24px back out of it costs nothing anybody else is standing on.

// So the horizontal room is grown and kept. A text control is now sixteen pixels wider in its row than the word in it, which is a real change to the layout and the honest price of the target -- rather than a target that overlaps its neighbour and looks free.
export const ROOM_FOR_A_THUMB = 'px-2 py-3 -my-3 has-[>svg]:px-2'

// The same trick at the other bar, for a link rather than a control.

// A link inside a line of text or at the start of a table row answers WCAG 2.5.8 instead of 2.5.5: twenty-four across, and a twenty-four-pixel circle no other target's circle may enter. That is the AA rule written for exactly this case, and the reason it is the right one here is that holding a house name in a table to forty-four doubles the table -- while what actually costs somebody something is a thumb aimed at one house opening the house below it, which is what the spacing half measures.

// Four pixels, and it is the difference between a row of house names at twenty and a row at twenty-four. Given back to the layout the same way, so no table changes height.

/** What a link sitting in a line needs to clear WCAG 2.5.8, at no cost to the row it is in. */
export const ROOM_FOR_A_LINK = 'py-0.5 -my-0.5'

// Where neither of these belongs, which matters as much as where they do.

// **Both only work while growing the box is invisible.** They grow what a finger lands on and give the same back to the layout, and what a person sees is unchanged because there is nothing to see: no border, no background, no shadow. Put either on a control that has one and the padding grows the *drawn* box as well -- a bordered card's `Open` becomes a bordered card's much taller `Open`, and the negative margin then pulls it over whatever is beside it.

// A control with a box of its own is sized rather than padded: give it 44 and let the row it is in be 44. That is not a worse answer, it is the answer for that case -- the trick exists because a run of words has no box, not because growing a box is wrong.

// And where the size comes from a `size-*` rather than from padding, padding cannot reach it at all: `box-sizing: border-box` means `size-6` is 24 including whatever padding is added. Those are grown and pulled back with a margin instead, written where they are because there is one of them.
