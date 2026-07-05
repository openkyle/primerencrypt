# Primer Encrypt

Primer Encrypt is a Foundry VTT module for DnD5e games that lets a GM hide text behind primer-based letter knowledge.

Use `@encrypt[secret text]` in supported rich text. Players see encrypted text until their character uses primer items to learn letters. GMs can click encrypted text to cycle between the player view, the hard cipher view, and the plain text.

Prefix a word with `#` inside encrypted text to keep the original fixed-cipher behavior for that word. The `#` marker is hidden in the rendered text, and learned primer letters still show plainly in green.

## Settings

Open **Configure Settings > Module Settings > Primer Encrypt**.

- **Simple** uses the saved A-Z cipher every time.
- **Advanced** redraws unknown letters each time encrypted text renders, while learned primer letters stay readable in green.
- **Custom Cipher** lets the GM set a full substitution alphabet. The cipher must include all 26 letters exactly once; reused letters are highlighted in red and cannot be saved.
- **Primer knowledge is the same for all players** is enabled by default and shows one shared Players column. Turn it off to manage letters per player.
- **Primer Knowledge** lets the GM check or uncheck which primer letters players have learned.
- **Post Grant Card** creates a chat card with only missing letter buttons so the GM can grant primer knowledge directly from chat.

## Compendiums

The module supports an **Ancient Language Primer** item. When used, it posts the primer text and DC14 INT / REL / HIS / CUL check buttons to chat. On success, the missing-letter picker appears; on failure, a random missing letter is learned. Learned primer letters can be reset from the Primer Encrypt settings menu.
