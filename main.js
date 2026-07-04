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
	const known = user.getFlag(MODULE_ID, 'knownLetters') || '';
	return new Set([...known.toUpperCase()].filter((letter) => ALPHABET.includes(letter)));
}

function allKnownLetters() {
	const letters = new Set();
	for (const user of game.users.players) {
		for (const letter of userKnownLetters(user)) letters.add(letter);
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

function renderEncryptedGroups(text, knownLetters, mode) {
	let groups = '';
	let encrypted = null;

	const parts = text.split(/(\s+|[,.!?;:()[\]{}"'])/);
	for (const part of parts) {
		if (!part || /^(\s+|[,.!?;:()[\]{}"'])$/.test(part)) {
			if (encrypted !== null) groups += '</span>';
			groups += part;
			encrypted = null;
			continue;
		}

		for (let i = 0; i < part.length; i++) {
			const letter = part[i];
			const known = knownLetters.has(letter.toUpperCase());
			if (known) {
				if (encrypted === true) groups += '</span>';
				if (encrypted !== false) groups += '<span class="decrypted">';
				groups += letter;
				encrypted = false;
			} else {
				if (encrypted === false) groups += '</span>';
				if (encrypted !== true) groups += '<span class="encrypted-chunk">';
				groups += mode === 'advanced' ? advancedSubstitute(letter, i, part.length) : encodeLetter(letter);
				encrypted = true;
			}
		}
	}

	if (encrypted !== null) groups += '</span>';
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

async function processPrimer(item, options) {
	const letter = getPrimerLetter(item);
	if (!options.consumeUsage || !letter) return;

	const known = userKnownLetters(game.user);
	const upper = letter.toUpperCase();
	if (known.has(upper)) {
		ui.notifications.error(`You have already learned to decrypt ${upper}.`);
		return false;
	}

	known.add(upper);
	await game.user.setFlag(MODULE_ID, 'knownLetters', [...known].sort().join(''));
	ChatMessage.create({ content: `You have learned to decrypt the letter <b>${upper}</b>.` });
}

async function resetAllPrimers() {
	if (!game.user.isGM) return ui.notifications.error('Only the gamemaster can reset primer knowledge.');

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
		const duplicateLetters = duplicateCipherLetters(cipher);
		return {
			method,
			cipher,
			isGM: game.user.isGM,
			rows: [...ALPHABET].map((plain, index) => ({
				plain,
				cipher: cipher[index] || '',
				duplicate: duplicateLetters.has(cipher[index]),
				players: game.users.players.map((player) => ({
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
					<p>Simple uses the saved cipher every time. Advanced redraws every unknown letter for players each time encrypted text is rendered, while learned primer letters remain readable.</p>
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
					<div class="primerencrypt-knowledge">
						<table>
							<thead>
								<tr>
									<th>Letter</th>
									<th>Cipher</th>
									${game.users.players.map((player) => `<th>${player.name}</th>`).join('')}
								</tr>
							</thead>
							<tbody>
								${data.rows
									.map(
										(row) => `
											<tr>
												<td>${row.plain}</td>
												<td class="${row.duplicate ? 'duplicate' : ''}">${row.cipher}</td>
												${row.players.map((player) => `<td>${player.known ? 'Known' : '-'}</td>`).join('')}
											</tr>
										`,
									)
									.join('')}
							</tbody>
						</table>
					</div>
				</section>
				<footer class="sheet-footer flexrow">
					${data.isGM ? '<button type="button" data-action="reset">Reset Learned Letters</button><button type="submit">Save</button>' : '<button type="button" data-action="close">Close</button>'}
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

		const cipher = [...Array(26)].map((_, index) => formData[`cipher-${index}`] || '').join('');
		const normalized = normalizeCipher(cipher);
		if (normalized.length !== 26 || new Set([...normalized]).size !== 26) {
			ui.notifications.error('Primer Encrypt needs a complete cipher using every letter A-Z exactly once.');
			this.render();
			return;
		}

		await game.settings.set(MODULE_ID, 'method', formData.method);
		await game.settings.set(MODULE_ID, 'cipher', normalized);
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

	game.settings.registerMenu(MODULE_ID, 'menu', {
		name: 'Primer Encrypt',
		label: 'Open Primer Encrypt',
		hint: 'Choose Simple or Advanced encryption, edit the cipher, and review which primer letters players know.',
		icon: 'fas fa-key',
		type: PrimerEncryptMenu,
		restricted: false,
	});
}

Hooks.once('init', registerSettings);
Hooks.once('setup', registerEnricher);
Hooks.once('ready', activateListeners);
Hooks.on('dnd5e.preItemUsageConsumption', processPrimer);
Hooks.on('updateUser', (_user, changes) => {
	if (foundry.utils.getProperty(changes, `flags.${MODULE_ID}`)) refreshEncryptions();
});
