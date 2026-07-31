# Changelog

## 1.0.14

- Added an item editor **Encrypt** control for wrapping highlighted text in `@encrypt[...]`.
- Added a dropdown/menu **Encrypt** option where Foundry exposes editor dropdown menus.
- Expanded shortcode documentation with the explicit `@encrypt[ ]` format.

## 1.0.13

- Expanded user-facing documentation for installation, quick start, encryption syntax, primer knowledge, and testing.
- Clarified the single-primer compendium workflow for userbase testing.
- Updated module metadata for the public test build.

## 1.0.12

- Restored the **Primers** compendium with one **Ancient Language Primer** item.
- Removed the old A-Z primer item pile.
- Ensured the primer item is a one-use consumable that deletes on consume.
- Restored settings **Save** behavior so it closes the Primer Encrypt menu after saving.

## 1.0.11

- Moved settings save behavior away from Foundry's form submit lifecycle.
- Added direct save handling for primer knowledge to avoid unnecessary menu churn.

## 1.0.10

- Reduced unnecessary player flag writes when saving or granting primer knowledge.
- Stopped menu-only buttons from bubbling into form handling.
- Removed unnecessary rerendering on invalid cipher input.
