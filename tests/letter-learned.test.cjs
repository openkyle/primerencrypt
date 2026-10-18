const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
function setup(shared = false) {
  let letters = '';
  const cards = [], warnings = [];
  const user = {
    id: 'player', name: 'Jim <Mage>',
    getFlag: () => letters,
    async setFlag(_module, _key, value) { letters = value; },
  };
  const context = vm.createContext({
    FormApplication: class {}, Hooks: { once() {}, on() {} },
    game: { user, users: { players: [user] }, settings: { get: () => shared } },
    ui: { notifications: { warn: text => warnings.push(text), info() { throw Error('Unexpected overlay'); } } },
    ChatMessage: { async create(data) { cards.push({ ...data, savedLetters: letters }); } },
  });
  vm.runInContext(readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8'), context);
  return { cards, warnings, grant: letter => context.grantLetterToUser(user, letter) };
}
test('shared grant posts a persistent card after saving knowledge', async () => {
  const { cards, grant } = setup(true);
  assert.equal(await grant('x'), true);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].savedLetters, 'X');
  assert.match(cards[0].content, /Players have learned to decrypt the letter/);
  assert.match(cards[0].content, />X<\/strong>/);
});
test('individual grant escapes the player name', async () => {
  const { cards, grant } = setup();
  await grant('A');
  assert.match(cards[0].content, /Jim &lt;Mage&gt; has learned/);
});
test('duplicate grants do not post a second learned-letter card', async () => {
  const { cards, warnings, grant } = setup();
  await grant('X');
  assert.equal(await grant('X'), false);
  assert.equal(cards.length, 1);
  assert.equal(warnings.length, 1);
});
