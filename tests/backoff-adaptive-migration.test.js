const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeBackoffWithJitter,
  nextAdaptiveThrottleState,
  migrateStateSnapshotToV2,
  extractSnapshotFromImport,
} = require('../pbinfo-get-unsolved-enhanced.js');

test('backoff: exponential growth with cap and deterministic jitter bounds', () => {
  const noJitterA = computeBackoffWithJitter(0, {
    baseMs: 500,
    capMs: 15000,
    jitter: false,
  });
  const noJitterB = computeBackoffWithJitter(3, {
    baseMs: 500,
    capMs: 15000,
    jitter: false,
  });
  const capped = computeBackoffWithJitter(10, {
    baseMs: 500,
    capMs: 15000,
    jitter: false,
  });

  assert.equal(noJitterA, 500);
  assert.equal(noJitterB, 4000);
  assert.equal(capped, 15000);

  const jitterZero = computeBackoffWithJitter(2, {
    baseMs: 500,
    capMs: 15000,
    jitter: true,
    random: () => 0,
  });
  const jitterHalf = computeBackoffWithJitter(2, {
    baseMs: 500,
    capMs: 15000,
    jitter: true,
    random: () => 0.5,
  });
  const jitterOne = computeBackoffWithJitter(2, {
    baseMs: 500,
    capMs: 15000,
    jitter: true,
    random: () => 1,
  });

  assert.equal(jitterZero, 0);
  assert.equal(jitterHalf, 1000);
  assert.equal(jitterOne, 2000);
});

test('adaptive throttle: blocked/error/healthy transitions', () => {
  const initial = {
    enabled: true,
    baseDelayMs: 100,
    baseConcurrency: 3,
    delayMs: 100,
    concurrency: 3,
    cleanStreak: 0,
  };

  const blocked = nextAdaptiveThrottleState(initial, 'blocked', { capMs: 5000 });
  assert.equal(blocked.concurrency, 1);
  assert.ok(blocked.delayMs >= 1100);

  const network = nextAdaptiveThrottleState(blocked, 'network', { capMs: 5000 });
  assert.equal(network.concurrency, 1);
  assert.ok(network.delayMs >= blocked.delayMs);

  let current = {
    ...network,
    cleanStreak: 19,
  };
  current = nextAdaptiveThrottleState(current, 'success', { capMs: 5000 });
  assert.equal(current.cleanStreak, 0);
  assert.ok(current.delayMs >= current.baseDelayMs);
  assert.ok(current.concurrency <= current.baseConcurrency);
});

test('migration: v1 snapshot is accepted and upgraded to v2', () => {
  const v1 = {
    version: 1,
    storageLevel: 'minimal',
    pageLink: 'https://www.pbinfo.ro/?pagina=probleme-lista',
    stats: { solved: 1, tried: 2, unattempted: 3, total: 6, pages: 2 },
    pageQueue: [3, 4],
    deferred: [[5, 1]],
    inFlightPages: [6],
    problems: [{ id: 42, name: 'x', link: '/probleme/42' }],
  };

  const migrated = migrateStateSnapshotToV2(v1);
  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.storageLevel, 'minimal');
  assert.deepEqual(migrated.pageQueue, [3, 4]);
  assert.deepEqual(migrated.deferred, [[5, 1]]);
  assert.deepEqual(migrated.inFlightPages, [6]);
  assert.equal(migrated.stats.total, 6);
  assert.ok(Array.isArray(migrated.problems));
});

test('import extractor: supports wrapped payload and rejects invalid values', () => {
  const wrapped = {
    type: 'pbinfo-get-unsolved-snapshot',
    state: {
      version: 1,
      storageLevel: 'progress',
      pageLink: 'https://www.pbinfo.ro/?pagina=probleme-lista',
      seenProblemIds: [1, '2'],
    },
  };

  const extracted = extractSnapshotFromImport(wrapped);
  assert.ok(extracted);
  assert.equal(extracted.version, 2);
  assert.equal(extracted.storageLevel, 'progress');
  assert.deepEqual(extracted.seenProblemIds, [1, 2]);

  assert.equal(extractSnapshotFromImport(null), null);
  assert.equal(extractSnapshotFromImport('abc'), null);
});
