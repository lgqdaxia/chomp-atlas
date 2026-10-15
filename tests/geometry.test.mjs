import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simplifyCuts, canonicalize, canonicalKey, isPresent, biteCuts,
  boxesFromCuts, equivalentBoxes, applyBite, permuteBoxes, mountShape,
} from '../src/geometry.js';

const omega = null;
const full = [[omega, omega, omega]];

test('N³ → T111 is the exact union of three coordinate planes', () => {
  const cuts = biteCuts([], [1, 1, 1]);
  assert.ok(equivalentBoxes(boxesFromCuts(cuts), [[1, omega, omega], [omega, 1, omega], [omega, omega, 1]]));
  assert.ok(equivalentBoxes(applyBite(full, [1, 1, 1]), boxesFromCuts(cuts)));
  assert.equal(isPresent([9000000, 0, 9000000], { cuts }), true);
  assert.equal(isPresent([1, 1, 1], { cuts }), false);
});

test('U3, C11 and C12 retain their exact infinite fibers', () => {
  const corner = [1, 2, 2];
  const U3 = [[3, omega, 1], [3, 1, omega], corner];
  const C11 = [[1, omega, 1], [3, 1, omega], corner];
  const C12 = [[1, omega, 1], [3, 2, 1], [3, 1, omega], corner];
  const U3cuts = [[3, 0, 0], [0, 1, 2], [0, 2, 1], [1, 1, 1]];
  assert.ok(equivalentBoxes(boxesFromCuts(U3cuts), U3));
  assert.ok(equivalentBoxes(applyBite(U3, [1, 1, 0]), C11));
  assert.ok(equivalentBoxes(applyBite(U3, [1, 2, 0]), C12));
  assert.ok(equivalentBoxes(boxesFromCuts(biteCuts(U3cuts, [1, 1, 0])), C11));
  assert.equal(isPresent([0, 500000, 0], { boxes: C11 }), true);
  assert.equal(isPresent([1, 1, 0], { boxes: C11 }), false);
  assert.equal(isPresent([1, 1, 0], { boxes: C12 }), true);
  assert.equal(isPresent([0, 1, 1], { boxes: C11 }), true);
  assert.equal(isPresent([1, 1, 1], { boxes: C11 }), false);
});

test('J ground bites give Y7 and Y8 without any finite z truncation', () => {
  const J = [[3, 3, omega]];
  const Y7 = [[3, 2, omega], [1, 3, omega]];
  const Y8 = [[3, 2, omega], [2, 3, omega]];
  assert.ok(equivalentBoxes(applyBite(J, [1, 2, 0]), Y7));
  assert.ok(equivalentBoxes(applyBite(J, [2, 2, 0]), Y8));
  assert.equal(isPresent([2, 1, 1000000000], { boxes: Y7 }), true);
  assert.equal(isPresent([1, 2, 1000000000], { boxes: Y7 }), false);
  assert.equal(isPresent([1, 2, 1000000000], { boxes: Y8 }), true);
});

test('W25 → Pstar removes exactly the two specified side points', () => {
  const W25 = [[2, 1, omega], [2, 3, 5], [3, 1, 2]];
  const Pstar = [[2, 1, omega], [2, 2, 5], [1, 3, 5], [2, 3, 3], [3, 1, 2]];
  const result = applyBite(W25, [1, 2, 3]);
  assert.ok(equivalentBoxes(result, Pstar));
  const deleted = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 20; z++) {
    const p = [x, y, z];
    if (isPresent(p, { boxes: W25 }) && !isPresent(p, { boxes: result })) deleted.push(p);
  }
  assert.deepEqual(deleted, [[1, 2, 3], [1, 2, 4]]);
  assert.equal(isPresent([1, 0, 999999999], { boxes: result }), true);
});

test('cut antichains, permutation canonicalization and input immutability', () => {
  const cuts = [[4, 1, 2], [2, 4, 1], [5, 2, 4], [4, 1, 2]];
  const before = JSON.stringify(cuts);
  assert.deepEqual(simplifyCuts(cuts), [[2, 4, 1], [4, 1, 2]]);
  const permuted = cuts.map(p => [p[2], p[0], p[1]]);
  assert.equal(canonicalKey(cuts), canonicalKey(permuted));
  assert.deepEqual(canonicalize(canonicalize(cuts)), canonicalize(cuts));
  assert.equal(JSON.stringify(cuts), before);
  const boxes = [[2, 3, omega], [3, 1, 4]];
  assert.ok(equivalentBoxes(permuteBoxes(permuteBoxes(boxes, [2, 0, 1]), [1, 2, 0]), boxes));
  assert.ok(equivalentBoxes(boxesFromCuts(permuted), permuteBoxes(boxesFromCuts(cuts), [2, 0, 1])));
});

test('boundary-grid equality checks distant finite boundaries and infinite tails', () => {
  assert.equal(equivalentBoxes([[3, 2, 1000000]], [[3, 2, 1000001]]), false);
  assert.equal(equivalentBoxes([[3, 2, 1000000]], [[3, 2, omega]]), false);
  assert.equal(equivalentBoxes([[3, 2, omega], [1, 1, 2]], [[3, 2, omega]]), true);
  assert.equal(equivalentBoxes([], [[0, omega, omega]]), true);
  assert.deepEqual(boxesFromCuts([]), full);
  assert.deepEqual(boxesFromCuts([[0, 0, 0]]), []);
  const cuts = [[1000000, 0, 0], [0, 2, 0], [0, 0, 3]];
  assert.ok(equivalentBoxes(boxesFromCuts(cuts), [[1000000, 2, 3]]));
});

test('several exact bites agree between orthant and box representations', () => {
  const sequence = [[4, 0, 0], [0, 5, 0], [0, 0, 6], [2, 2, 3], [1, 4, 1]];
  let cuts = [];
  let boxes = full;
  for (const p of sequence) {
    cuts = biteCuts(cuts, p);
    boxes = applyBite(boxes, p);
    assert.ok(equivalentBoxes(boxes, boxesFromCuts(cuts)));
  }
  for (let x = 0; x <= 5; x++) for (let y = 0; y <= 6; y++) for (let z = 0; z <= 7; z++) {
    assert.equal(isPresent([x, y, z], { cuts }), isPresent([x, y, z], { boxes }));
  }
});

test('poison, removed points, non-natural coordinates and invalid permutations are rejected', () => {
  assert.throws(() => biteCuts([], [0, 0, 0]), /毒块/);
  assert.throws(() => applyBite(full, [0, 0, 0]), /毒块/);
  assert.throws(() => biteCuts([[1, 1, 1]], [2, 2, 2]), /已经删除/);
  assert.throws(() => applyBite([[2, 2, 2]], [2, 0, 0]), /不属于/);
  for (const point of [[null, 1, 1], [Infinity, 0, 1], [-1, 0, 0], [0.5, 1, 1], [1, 2], [Number.MAX_SAFE_INTEGER + 1, 0, 0]]) {
    assert.throws(() => biteCuts([], point), TypeError);
    assert.throws(() => isPresent(point), TypeError);
  }
  assert.throws(() => permuteBoxes(full, [0, 0, 1]), TypeError);
  assert.throws(() => equivalentBoxes([[Infinity, 1, 1]], full), TypeError);
});

test('Node import has no DOM requirement; mount validates the browser container', () => {
  assert.equal(typeof mountShape, 'function');
  assert.throws(() => mountShape(null), /容器/);
});
