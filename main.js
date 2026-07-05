const MODULE_ID = 'primerencrypt';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_CIPHER = 'YPLTAVKREZGMSHUBXNCDIJFQOW';

function setting(key) {
	return game.settings.get(MODULE_ID, key);
}

function normalizeCipher(value) {
	return String(value || '')
		.toUpperCase()
		.replace(/[^A-Z]/g, '')
		.slice(0, 26);
}

function cipherMap() {
	const cipher = normalizeCipher(setting('cipher')) || DEFAULT_CIPHER;
	return Object.fromEntries([...ALPHABET].map((letter, index) => [letter, cipher[index] || letter]));
}

function encodeLetter(letter) {
	if (!/[a-z]/i.test(letter)) return letter;
	const encoded = cipherMap()[letter.toUpperCase()] || letter;
	return letter === letter.toUpperCase() ? encoded : encoded.toLowerCase();
}

function userKnownLetters(user = game.user) {
	if (setting('sharedKnowledge')) return sharedKnownLetters();
	return rawUserKnownLetters(user);
}

function rawUserKnownLetters(user = game.user) {
	const known = user.getFlag(MODULE_ID, 'knownLetters') || '';
	return new Set([...known.toUpperCase()].filter((letter) => ALPHABET.includes(letter)));
}

function sharedKnownLetters() {
	const known = setting('sharedKnownLetters') || '';
	return new Set([...known.toUpperCase()].filter((letter) => ALPHABET.includes(letter)));
}

async function setUserKnownLetters(user, letters) {
	if (setting('sharedKnowledge')) {
		await setSharedKnownLetters(letters);
		return;
	}

	const known = [...new Set([...letters.toUpperCase()].filter((letter) => ALPHABET.includes(letter)))].sort().join('');
	if (known) await user.setFlag(MODULE_ID, 'knownLetters', known);
	else await user.unsetFlag(MODULE_ID, 'knownLetters');
	refreshEncryptions();
}

async function setSharedKnownLetters(letters) {
	const known = [...new Set([...letters.toUpperCase()].filter((letter) => ALPHABET.includes(letter)))].sort().join('');
	await game.settings.set(MODULE_ID, 'sharedKnownLetters', known);
	refreshEncryptions();
}

async function grantLetterToUser(user, letter) {
	const upper = letter.toUpperCase();
	if (!ALPHABET.includes(upper)) return false;

	const known = userKnownLetters(user);
	if (known.has(upper)) {
		ui.notifications.warn(setting('sharedKnowledge') ? `Players already understand ${upper}.` : `${user.name} already understands ${upper}.`);
		return false;
	}

	known.add(upper);
	await setUserKnownLetters(user, [...known].join(''));
	ChatMessage.create({ content: `${setting('sharedKnowledge') ? 'Players have' : `${user.name} has`} learned to decrypt the letter <b>${upper}</b>.` });
	return true;
}

function allKnownLetters() {
	if (setting('sharedKnowledge')) return sharedKnownLetters();
	const letters = new Set();
	for (const user of game.users.players) {
		for (const letter of rawUserKnownLetters(user)) letters.add(letter);
	}
	return letters;
}

function randomFrom(text) {
	return text[Math.floor(Math.random() * text.length)];
}

function advancedSubstitute(letter, position, wordLength) {
	if (!/[a-z]/i.test(letter)) return letter;

	const upper = letter === letter.toUpperCase();
	const vowels = upper ? 'AEIOU' : 'aeiou';
	const consonants = upper ? 'BCDFGHJKLMNPQRSTVWXYZ' : 'bcdfghjklmnpqrstvwxyz';

	if (wordLength === 1) return randomFrom(vowels);
	if (wordLength === 2) return randomFrom(position === 0 ? consonants : vowels);
	return randomFrom(position % 2 === 0 ? consonants : vowels);
}

function renderKnownLetter(letter) {
	return `<span class="decrypted">${letter}</span>`;
}

function encodeHashtagWord(word, knownLetters) {
	let result = '';
	for (const letter of word) {
		if (knownLetters.has(letter.toUpperCase())) result += renderKnownLetter(letter);
		else result += encodeLetter(letter);
	}
	return result;
}

function renderWord(word, knownLetters, mode) {
	let groups = '';
	let encrypted = null;

	for (let i = 0; i < word.length; i++) {
		const letter = word[i];
		const known = knownLetters.has(letter.toUpperCase());
		if (known) {
			if (encrypted === true) groups += '</span>';
			if (encrypted !== false) groups += '<span class="decrypted">';
			groups += letter;
			encrypted = false;
		} else {
			if (encrypted === false) groups += '</span>';
			if (encrypted !== true) groups += '<span class="encrypted-chunk">';
			groups += mode === 'advanced' ? advancedSubstitute(letter, i, word.length) : encodeLetter(letter);
			encrypted = true;
		}
	}

	if (encrypted !== null) groups += '</span>';
	return groups;
}

function renderEncryptedGroups(text, knownLetters, mode) {
	let groups = '';
	const parts = text.split(/(\s+|[,.!?;:()[\]{}"'])/);
	for (const part of parts) {
		if (!part || /^(\s+|[,.!?;:()[\]{}"'])$/.test(part)) {
			groups += part;
			continue;
		}

		groups += part.startsWith('#') ? encodeHashtagWord(part.slice(1), knownLetters) : renderWord(part, knownLetters, mode);
	}

	return groups;
}

function encodeForDisplay(text) {
	return [...text].map(encodeLetter).join('');
}

function makeEncryption(text) {
	const b64 = btoa(unescape(encodeURIComponent(text)));
	const mode = setting('method');
	const knownLetters = game.user.isGM ? allKnownLetters() : userKnownLetters(game.user);
	const playerView = renderEncryptedGroups(text, knownLetters, mode);

	if (game.user.isGM) {
		const hardCipher = encodeForDisplay(text);
		const element = $(`<a class="encryption gamemaster" data-show="players" data-content="${b64}">
			<span class="encrypted">${hardCipher}</span>
			<span class="players">${playerView}</span>
			<span class="plain">${text}</span>
		</a>`)[0];
		return element;
	}

	return $(`<span class="encryption" data-content="${b64}">${playerView}</span>`)[0];
}

function refreshEncryptions() {
	for (const element of document.querySelectorAll('.encryption')) {
		const text = decodeURIComponent(escape(atob(element.dataset.content)));
		element.outerHTML = makeEncryption(text).outerHTML;
	}
}

function registerEnricher() {
	CONFIG.TextEditor.enrichers.push({
		pattern: /@encrypt\[(?<text>[^\]]+)]/gi,
		enricher: (match) => makeEncryption(match.groups.text),
	});
}

function activateListeners() {
	document.body.addEventListener('click', (event) => {
		if (!game.user.isGM) return;
		const parent = event.target.closest('.encryption.gamemaster');
		if (!parent) return;
		const states = ['players', 'encrypted', 'plain'];
		parent.dataset.show = states[(states.indexOf(parent.dataset.show) + 1) % states.length];
	});
}

function getPrimerLetter(item) {
	const flagLetter = item.getFlag(MODULE_ID, 'letter');
	const namedLetter = item.name.match(/\bPrimer:\s*([A-Z])\b/i)?.[1];
	return flagLetter || namedLetter;
}

function isPrimerItem(item) {
	return Boolean(item?.name?.toLowerCase().includes('primer'));
}

async function processPrimer(item, options) {
	const letter = getPrimerLetter(item);
	if (!options.consumeUsage || !isPrimerItem(item)) return;

	if (!letter) {
		await postPrimerChoiceCard(game.user, item.name);
		return;
	}

	const granted = await grantLetterToUser(game.user, letter);
	if (!granted) return false;
}

function primerCardButton(user, letter) {
	const userId = user?.id || '';
	return `<button type="button" data-primer-action="grant-letter" data-user-id="${userId}" data-letter="${letter}">${letter}</button>`;
}

function primerChoiceCardContent(users, title = 'Primer Letter') {
	const grantTargets = setting('sharedKnowledge') ? [{ id: '', name: 'Players', shared: true }] : users;
	const sections = grantTargets
		.map((user) => {
			const known = user.shared ? sharedKnownLetters() : userKnownLetters(user);
			const missing = [...ALPHABET].filter((letter) => !known.has(letter));
			const buttons = missing.map((letter) => primerCardButton(user, letter)).join('');
			const knownText = known.size ? [...known].sort().join(' ') : 'None';
			return `
				<section class="primerencrypt-card-player">
					<h4>${user.name}</h4>
					<p>Known: <span class="decrypted">${knownText}</span></p>
					<div class="primerencrypt-card-grid">
						${buttons || '<em>All letters known.</em>'}
					</div>
					<button type="button" data-primer-action="grant-random" data-user-id="${user.id}">Grant Random Unknown Letter</button>
				</section>`;
		})
		.join('');
	return `<div class="primerencrypt-chat-card"><h3>${title}</h3>${sections}</div>`;
}

async function postPrimerChoiceCard(user = game.user, itemName = 'Ancient Language Primer') {
	const whisper = ChatMessage.getWhisperRecipients('GM').map((gm) => gm.id);
	await ChatMessage.create({
		content: primerChoiceCardContent([user], `${itemName}: which letter should ${setting('sharedKnowledge') ? 'players' : user.name} understand?`),
		whisper,
	});
}

async function postMenuPrimerCard() {
	if (!game.user.isGM) return ui.notifications.error('Only the gamemaster can grant primer letters.');
	await ChatMessage.create({
		content: primerChoiceCardContent(game.users.players, 'Primer Encrypt: grant a letter'),
	});
}

async function handlePrimerCardClick(event) {
	if (!game.user.isGM) return ui.notifications.error('Only the gamemaster can grant primer letters.');

	const button = event.currentTarget;
	const user = setting('sharedKnowledge') ? game.user : game.users.get(button.dataset.userId);
	if (!user) return;

	if (button.dataset.primerAction === 'grant-random') {
		const known = userKnownLetters(user);
		const missing = [...ALPHABET].filter((letter) => !known.has(letter));
		if (!missing.length) return ui.notifications.warn(`${setting('sharedKnowledge') ? 'Players already understand' : `${user.name} already understands`} every letter.`);
		await grantLetterToUser(user, randomFrom(missing));
		return;
	}

	await grantLetterToUser(user, button.dataset.letter);
}

function genericPrimerData() {
	return {
		name: 'Ancient Language Primer',
		type: 'consumable',
		img: 'icons/magic/symbols/chevron-elipse-circle-blue.webp',
		system: {
			description: {
				value:
					'<p>A primer contains a translation cypher for understanding the ancient language of the Muf. A character who has a primer can read it and attempt to learn a single letter.</p><p>On an INT / REL / HIS / CUL DC14 success, the character learns and is granted the ability to select which letter they would learn, which will always render it in cleartext from that point.</p><p>On a fail, the character learns a random letter instead.</p>',
				chat: '',
			},
			source: {},
			identified: true,
			unidentified: { description: '' },
			container: null,
			quantity: 1,
			weight: 0,
			price: { value: 0, denomination: 'gp' },
			rarity: 'artifact',
			attunement: 0,
			activation: { type: 'special', cost: null, condition: '' },
			duration: { value: '', units: '' },
			cover: null,
			crewed: false,
			target: { value: null, width: null, units: '', type: 'self', prompt: true },
			range: { value: null, long: null, units: '' },
			uses: { value: 1, max: '1', per: 'charges', recovery: '', prompt: true, autoDestroy: true },
			consume: { type: '', target: null, amount: null, scale: false },
			ability: '',
			actionType: '',
			attackBonus: '',
			chatFlavor: '',
			critical: { threshold: null, damage: '' },
			damage: { parts: [], versatile: '' },
			formula: '',
			save: { ability: '', dc: null, scaling: 'spell' },
			type: { value: 'potion', subtype: '' },
			properties: [],
			equipped: false,
		},
		effects: [],
		flags: {
			[MODULE_ID]: { genericPrimer: true },
		},
		ownership: {
			default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
		},
	};
}

async function ensureGenericPrimerCompendiumItem() {
	if (!game.user.isGM) return;

	const pack = game.packs.get(`${MODULE_ID}.primers`);
	if (!pack) return;

	await pack.getIndex({ fields: ['name'] });
	if (pack.index.some((entry) => entry.name === 'Ancient Language Primer')) return;

	const wasLocked = pack.locked;
	if (wasLocked) await pack.configure({ locked: false });
	await Item.create(genericPrimerData(), { pack: pack.collection });
	if (wasLocked) await pack.configure({ locked: true });
}

async function resetAllPrimers() {
	if (!game.user.isGM) return ui.notifications.error('Only the gamemaster can reset primer knowledge.');

	await setSharedKnownLetters('');
	await Promise.all(
		game.users.players.map(async (player) => {
			await player.unsetFlag(MODULE_ID, 'knownLetters');
		}),
	);
	ui.notifications.info('All Primer Encrypt letters have been unlearned.');
}

class PrimerEncryptMenu extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: 'primerencrypt-menu',
			title: 'Primer Encrypt',
			template: null,
			width: 620,
			height: 'auto',
			closeOnSubmit: false,
			submitOnChange: false,
		});
	}

	getData() {
		const cipher = normalizeCipher(setting('cipher')) || DEFAULT_CIPHER;
		const method = setting('method');
		const sharedKnowledge = setting('sharedKnowledge');
		const sharedLetters = sharedKnownLetters();
		const duplicateLetters = duplicateCipherLetters(cipher);
		return {
			method,
			cipher,
			sharedKnowledge,
			isGM: game.user.isGM,
			players: game.users.players.map((player) => ({
				id: player.id,
				name: player.name,
			})),
			rows: [...ALPHABET].map((plain, index) => ({
				plain,
				cipher: cipher[index] || '',
				duplicate: duplicateLetters.has(cipher[index]),
				sharedKnown: sharedLetters.has(plain),
				players: game.users.players.map((player) => ({
					id: player.id,
					name: player.name,
					known: userKnownLetters(player).has(plain),
				})),
			})),
		};
	}

	async _renderInner(data) {
		const html = `
			<form class="primerencrypt-settings">
				<section class="primerencrypt-section">
					<label>Encryption Method</label>
					<select name="method" ${data.isGM ? '' : 'disabled'}>
						<option value="simple" ${data.method === 'simple' ? 'selected' : ''}>Simple</option>
						<option value="advanced" ${data.method === 'advanced' ? 'selected' : ''}>Advanced</option>
					</select>
					<p>Simple uses the saved cipher every time. Advanced redraws every unknown letter for players each time encrypted text is rendered. Learned primer letters render as the real character in green. Prefix a word with # to force the fixed cipher path and hide the # marker.</p>
				</section>
				<section class="primerencrypt-section">
					<label>Custom Cipher</label>
					<div class="primerencrypt-cipher-grid">
						${[...ALPHABET]
							.map(
								(plain, index) => `
									<div class="cipher-cell">
										<span>${plain}</span>
										<input name="cipher-${index}" value="${data.cipher[index] || ''}" maxlength="1" ${data.isGM ? '' : 'disabled'} class="${data.rows[index].duplicate ? 'invalid' : ''}">
									</div>
								`,
							)
							.join('')}
					</div>
					<p class="cipher-warning" hidden>The cipher must use every letter A-Z exactly once.</p>
				</section>
				<section class="primerencrypt-section">
					<label>Primer Knowledge</label>
					<label class="primerencrypt-toggle">
						<input type="checkbox" name="sharedKnowledge" ${data.sharedKnowledge ? 'checked' : ''} ${data.isGM ? '' : 'disabled'}>
						<span>Primer knowledge is the same for all players</span>
					</label>
					<div class="primerencrypt-knowledge">
						<table>
							<thead>
								<tr>
									<th>Letter</th>
									<th>Cipher</th>
									${data.sharedKnowledge ? '<th>Players</th>' : data.players.map((player) => `<th>${player.name}</th>`).join('')}
								</tr>
							</thead>
							<tbody>
								${data.rows
									.map(
										(row) => `
											<tr>
												<td>${row.plain}</td>
												<td class="${row.duplicate ? 'duplicate' : ''}">${row.cipher}</td>
												${
													data.sharedKnowledge
														? `<td><input type="checkbox" name="known-shared-${row.plain}" ${row.sharedKnown ? 'checked' : ''} ${data.isGM ? '' : 'disabled'}></td>`
														: row.players
																.map(
																	(player) => `
																		<td>
																			<input type="checkbox" name="known-${player.id}-${row.plain}" ${player.known ? 'checked' : ''} ${data.isGM ? '' : 'disabled'}>
																		</td>
																	`,
																)
																.join('')
												}
											</tr>
										`,
									)
									.join('')}
							</tbody>
						</table>
					</div>
				</section>
				<footer class="sheet-footer flexrow">
					${data.isGM ? '<button type="button" data-action="chat-card">Post Grant Card</button><button type="button" data-action="reset">Reset Learned Letters</button><button type="submit">Save</button>' : '<button type="button" data-action="close">Close</button>'}
				</footer>
			</form>`;
		return $(html);
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find('[name^="cipher-"]').on('input', (event) => {
			event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
			this.validateCipherInputs(html);
		});
		html.find('[data-action="reset"]').on('click', async () => {
			await resetAllPrimers();
			this.render();
		});
		html.find('[data-action="chat-card"]').on('click', () => postMenuPrimerCard());
		html.find('[data-action="close"]').on('click', () => this.close());
	}

	validateCipherInputs(html) {
		const values = html
			.find('[name^="cipher-"]')
			.toArray()
			.map((input) => input.value);
		const duplicates = duplicateCipherLetters(values.join(''));
		html.find('[name^="cipher-"]').each((index, input) => {
			input.classList.toggle('invalid', duplicates.has(input.value));
		});
		html.find('.cipher-warning').prop('hidden', values.length === 26 && values.every(Boolean) && duplicates.size === 0);
	}

	async _updateObject(_event, formData) {
		if (!game.user.isGM) return;

		const wasSharedKnowledge = setting('sharedKnowledge');
		const previousSharedLetters = [...sharedKnownLetters()].join('');
		const previousPlayerLetters = Object.fromEntries(game.users.players.map((player) => [player.id, [...rawUserKnownLetters(player)].join('')]));
		const previousPlayerUnion = [...new Set(Object.values(previousPlayerLetters).join('').split('').filter(Boolean))].sort().join('');
		const cipher = [...Array(26)].map((_, index) => formData[`cipher-${index}`] || '').join('');
		const normalized = normalizeCipher(cipher);
		if (normalized.length !== 26 || new Set([...normalized]).size !== 26) {
			ui.notifications.error('Primer Encrypt needs a complete cipher using every letter A-Z exactly once.');
			this.render();
			return;
		}

		await game.settings.set(MODULE_ID, 'method', formData.method);
		await game.settings.set(MODULE_ID, 'cipher', normalized);
		await game.settings.set(MODULE_ID, 'sharedKnowledge', Boolean(formData.sharedKnowledge));

		if (formData.sharedKnowledge) {
			const hasSharedInputs = [...ALPHABET].some((letter) => Object.prototype.hasOwnProperty.call(formData, `known-shared-${letter}`));
			const letters = hasSharedInputs ? [...ALPHABET].filter((letter) => formData[`known-shared-${letter}`]).join('') : previousPlayerUnion;
			await setSharedKnownLetters(letters);
		} else {
			const hasPlayerInputs = game.users.players.some((player) => [...ALPHABET].some((letter) => Object.prototype.hasOwnProperty.call(formData, `known-${player.id}-${letter}`)));
			await Promise.all(
				game.users.players.map((player) => {
					const letters = hasPlayerInputs ? [...ALPHABET].filter((letter) => formData[`known-${player.id}-${letter}`]).join('') : wasSharedKnowledge ? previousSharedLetters : previousPlayerLetters[player.id];
					return setUserKnownLetters(player, letters);
				}),
			);
		}

		ui.notifications.info('Primer Encrypt settings saved.');
		refreshEncryptions();
		this.render();
	}
}

function duplicateCipherLetters(cipher) {
	const seen = new Set();
	const duplicates = new Set();
	for (const letter of normalizeCipher(cipher)) {
		if (seen.has(letter)) duplicates.add(letter);
		seen.add(letter);
	}
	return duplicates;
}

function registerSettings() {
	game.settings.register(MODULE_ID, 'method', {
		name: 'Encryption Method',
		scope: 'world',
		config: false,
		type: String,
		default: 'simple',
		choices: {
			simple: 'Simple',
			advanced: 'Advanced',
		},
		onChange: refreshEncryptions,
	});

	game.settings.register(MODULE_ID, 'cipher', {
		name: 'Cipher Alphabet',
		scope: 'world',
		config: false,
		type: String,
		default: DEFAULT_CIPHER,
		onChange: refreshEncryptions,
	});

	game.settings.register(MODULE_ID, 'sharedKnowledge', {
		name: 'Primer knowledge is the same for all players',
		scope: 'world',
		config: false,
		type: Boolean,
		default: true,
		onChange: refreshEncryptions,
	});

	game.settings.register(MODULE_ID, 'sharedKnownLetters', {
		name: 'Shared Known Letters',
		scope: 'world',
		config: false,
		type: String,
		default: '',
		onChange: refreshEncryptions,
	});

	game.settings.registerMenu(MODULE_ID, 'menu', {
		name: 'Primer Encrypt',
		label: 'Open Primer Encrypt',
		hint: 'Choose Simple or Advanced encryption, edit the cipher, grant primer letters, and review which letters players know.',
		icon: 'fas fa-key',
		type: PrimerEncryptMenu,
		restricted: false,
	});
}

Hooks.once('init', registerSettings);
Hooks.once('setup', registerEnricher);
Hooks.once('ready', () => {
	activateListeners();
	ensureGenericPrimerCompendiumItem();
});
Hooks.on('dnd5e.preItemUsageConsumption', processPrimer);
Hooks.on('renderChatMessage', (_message, html) => {
	html.find('[data-primer-action]').on('click', handlePrimerCardClick);
});
Hooks.on('updateUser', (_user, changes) => {
	if (foundry.utils.getProperty(changes, `flags.${MODULE_ID}`)) refreshEncryptions();
});
