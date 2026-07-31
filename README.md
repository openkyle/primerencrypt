# Primer Encrypt

Primer Encrypt is a Foundry VTT module for DnD5e games that lets a GM hide writing behind an ancient-language cipher. Players gradually learn the alphabet through primer items, and known letters render in cleartext while the rest remains encrypted.

The module is built for table use: GMs write encrypted text once, players see only what their primer knowledge allows, and the GM can manage learned letters from a compact settings menu or from chat cards.

## Features

- Enrich journals, item descriptions, and chat with `@encrypt[secret text]`.
- Use the item editor **Encrypt** control to wrap highlighted text in `@encrypt[...]`.
- Use **Simple** encryption for a stable substitution cipher.
- Use **Advanced** encryption to redraw unknown letters each time text renders for a player.
- Mark individual words with `#` to force the fixed cipher path while hiding the `#` marker.
- Show learned letters in green so players can see their progress.
- Use a custom A-Z cipher, with duplicate letters highlighted before saving.
- Track primer knowledge as one shared player alphabet or separately per player.
- Ship one **Ancient Language Primer** consumable in the **Primers** compendium.
- Consume the primer to post the DC14 INT / REL / HIS / CUL learning card to chat.

## Installation

Use this manifest URL in Foundry:

```text
https://github.com/openkyle/primerencrypt/releases/latest/download/module.json
```

After installing, enable **Primer Encrypt** in your world module list.

## Quick Start

1. Open **Configure Settings > Module Settings > Primer Encrypt**.
2. Choose **Simple** or **Advanced**.
3. Leave the default cipher or enter a full custom cipher using every letter A-Z exactly once.
4. Drag **Ancient Language Primer** from the **Primers** compendium to a character.
5. Add encrypted text with `@encrypt[the old door speaks in silver fire]`.
6. Have a player consume the primer item to roll the DC14 primer check.

## Writing Encrypted Text

Shortcode:

```text
@encrypt[ ]
```

Use this syntax anywhere Foundry supports text enrichers:

```text
@encrypt[The Muf vault opens at moonrise.]
```

Players see encrypted text based on the current mode and their learned letters. GMs can click encrypted text to cycle between the player view, the hard cipher view, and the plain text.

To force one word through the fixed cipher, prefix it with `#`:

```text
@encrypt[The #Muf vault opens at moonrise.]
```

The `#` marker is hidden in rendered text. Any learned letters inside that word still show plainly in green.

When editing an item description, highlight text and click **Encrypt** in the editor toolbar or dropdown menu. The highlighted text will be wrapped as `@encrypt[highlighted text]`. Hovering the control explains that encrypted text requires primers from the compendium to un-encrypt.

## Primer Knowledge

Open **Configure Settings > Module Settings > Primer Encrypt**.

- **Primer knowledge is the same for all players** is enabled by default and shows one shared **Players** column.
- Turn that setting off to manage known letters per player.
- Check a letter to mark it learned.
- Click **Save** to store the changes and close the menu.
- Click **Reset Learned Letters** to clear all learned letters.
- Click **Post Grant Card** to post a chat card containing only letters the players still do not know.

Letter grants are stored on player user flags. The module does not rewrite live encrypted text or mutate compendium packs during play.

## Primer Item

The **Primers** compendium contains one item:

**Ancient Language Primer**

- Type: Consumable
- Uses: 1 charge
- Consume behavior: deletes on consume
- On use: posts the primer chat card

When the primer is consumed, the player chooses an INT / REL / HIS / CUL DC14 check. On success, the player chooses a missing letter to learn. On failure, a random missing letter can be granted instead.

## Testing Notes

This release is ready for userbase testing on Foundry VTT v11 with DnD5e. Please test:

- Dragging **Ancient Language Primer** from the compendium to a character.
- Consuming the item and confirming it deletes after use.
- Success and failure paths for the DC14 primer card.
- Shared primer knowledge and per-player primer knowledge.
- Saving checked letters from the settings menu.
- Rendering `@encrypt[...]` in journals, item descriptions, and chat.
- Wrapping highlighted item text with the editor **Encrypt** control.
- The `#word` fixed-cipher behavior.

## Compatibility

- Foundry VTT: v11, verified on 11.315
- System: DnD5e, verified on 3.0.3

## Support

Open issues on GitHub with:

- Foundry version
- DnD5e system version
- Primer Encrypt version
- A screenshot or console error if one appears
- Steps to reproduce the issue
