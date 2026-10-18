const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function setup() {
  const hooks = new Map();
  const cards = [];
  const context = vm.createContext({
    FormApplication: class {},
    Hooks: {
      once() {},
      on(name, callback) { hooks.set(name, callback); },
    },
    game: {
      user: { id: 'player', name: 'Player' },
      settings: { get: () => false },
    },
    ChatMessage: { async create(data) { cards.push(data); } },
  });
  vm.runInContext(readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8'), context);
  const primer = { name: 'Ancient Language Primer', getFlag: () => undefined };
  return { hooks, cards, primer };
}

test('check card follows the completed native item card', async () => {
  const { hooks, cards, primer } = setup();
  await hooks.get('dnd5e.preItemUsageConsumption')(primer, { consumeUsage: true });
  assert.equal(cards.length, 0, 'pre-consumption must not post the check');
  cards.push({ content: 'Native item card' });
  await hooks.get('dnd5e.useItem')(primer, { consumeUsage: true });
  assert.equal(cards.length, 2);
  assert.equal(cards[0].content, 'Native item card');
  assert.match(cards[1].content, /data-primer-action="roll-check"/);
});

test('cancelled consumption posts no check card', async () => {
  const { hooks, cards, primer } = setup();
  await hooks.get('dnd5e.preItemUsageConsumption')(primer, { consumeUsage: true });
  // Aborted workflows never reach dnd5e.useItem.
  assert.equal(cards.length, 0);
});

test('non-consuming uses and unrelated items post no check card', async () => {
  const { hooks, cards, primer } = setup();
  await hooks.get('dnd5e.useItem')(primer, { consumeUsage: false });
  await hooks.get('dnd5e.useItem')({ ...primer, name: 'Healing Potion' }, { consumeUsage: true });
  assert.equal(cards.length, 0);
});

test('letter-specific legacy primers do not also post a check card', async () => {
  const { hooks, cards, primer } = setup();
  await hooks.get('dnd5e.useItem')({ ...primer, name: 'Primer: A' }, { consumeUsage: true });
  await hooks.get('dnd5e.useItem')({
    ...primer, getFlag: (_module, key) => key === 'letter' ? 'B' : undefined,
  }, { consumeUsage: true });
  assert.equal(cards.length, 0);
});
