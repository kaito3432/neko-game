const assert = require('node:assert/strict');
const test = require('node:test');
const { createController } = require('../in-app-review.js');

const DAY = 86400000;
function harness(initial = {}) {
  const values = new Map([['nyanRoomReviewV1', JSON.stringify(initial)]]);
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  let time = 100 * DAY;
  let calls = 0;
  const controller = createController(storage, { requestReview: async () => { calls++; } }, () => time);
  const finish = (id, result = { winner: 'cat', status: 'finished' }, matchType = 'roomMatch') => {
    controller.matched();
    controller.ended({ matchId: id, matchType }, result);
  };
  return { controller, values, finish, setTime: value => { time = value; }, calls: () => calls };
}

test('3 / 15 / 50 Room completions and 7 / 30 day spacing', async () => {
  const h = harness({ roomCompletedCount: 1 });
  h.finish('room-2');
  assert.equal(await h.controller.resultClosed(), false);
  assert.equal(h.controller.getState().roomCompletedCount, 2);
  h.finish('room-3');
  assert.equal(await h.controller.resultClosed(), true);
  assert.equal(h.controller.getState().reviewRequestStage, 1);
  h.controller.getState();
  for (let i = 4; i <= 15; i++) h.finish(`room-${i}`);
  h.setTime(107 * DAY - 1);
  assert.equal(await h.controller.resultClosed(), false);
  h.finish('room-16');
  h.setTime(107 * DAY);
  assert.equal(await h.controller.resultClosed(), true);
  assert.equal(h.controller.getState().reviewRequestStage, 2);
  for (let i = 17; i <= 50; i++) h.finish(`room-${i}`);
  h.setTime(137 * DAY - 1);
  assert.equal(await h.controller.resultClosed(), false);
  h.finish('room-51');
  h.setTime(137 * DAY);
  assert.equal(await h.controller.resultClosed(), true);
  assert.equal(h.controller.getState().reviewRequestStage, 3);
  h.finish('room-52');
  assert.equal(await h.controller.resultClosed(), false);
  assert.equal(h.calls(), 3);
});

test('abnormal, random, duplicate, and connection-error matches do not request', async () => {
  const h = harness({ roomCompletedCount: 2 });
  h.finish('random', { winner: 'cat' }, 'randomMatch');
  h.finish('cancelled', { status: 'cancelled' });
  h.finish('forfeit', { winner: 'cat', finishReason: 'disconnectForfeit' });
  assert.equal(h.controller.getState().roomCompletedCount, 2);
  h.finish('room-3');
  h.controller.connection('reconnecting');
  assert.equal(await h.controller.resultClosed(), false);
  assert.equal(h.controller.getState().roomCompletedCount, 3);
  h.finish('room-3');
  assert.equal(h.controller.getState().roomCompletedCount, 3);
  assert.equal(await h.controller.resultClosed(), false);
});

test('state survives restart, QA state does not mutate production state', async () => {
  const h = harness({ roomCompletedCount: 2 });
  h.finish('room-3');
  const restored = createController({
    getItem: key => h.values.get(key) || null,
    setItem: (key, value) => h.values.set(key, value),
    removeItem: key => h.values.delete(key)
  }, { requestReview: async () => {} });
  assert.equal(restored.getState().roomCompletedCount, 3);
  assert.equal(await restored.resultClosed(), false); // no prompt immediately after crash/restart
  restored.enableQA();
  restored.setQAState({ roomCompletedCount: 49, reviewRequestStage: 2, lastReviewRequestAt: 1 });
  assert.equal(restored.getState().roomCompletedCount, 49);
  restored.disableQA();
  assert.equal(restored.getState().roomCompletedCount, 3);
});

test('a crash-recovered Room completion counts but does not prompt immediately', async () => {
  const h = harness({ roomCompletedCount: 2 });
  h.controller.recovered('recovered-room');
  h.finish('recovered-room');
  assert.equal(h.controller.getState().roomCompletedCount, 3);
  assert.equal(await h.controller.resultClosed(), false);
  h.finish('fresh-room');
  assert.equal(await h.controller.resultClosed(), true);
});
