import assert from 'node:assert/strict';
import test from 'node:test';
import { getScoreProgress, guestScore } from '../../lib/scoreProgress.ts';
test('scores unlock at ten, relock on removal, and progress stays bounded', () => {
  for (const count of [0,1,9]) { assert.equal(getScoreProgress(count).unlocked,false);assert.equal(guestScore(0,count),null); }
  assert.deepEqual(getScoreProgress(10),{total:10,remaining:0,unlocked:true,progress:10});
  assert.equal(getScoreProgress(11).progress,10);
  assert.equal(getScoreProgress(9).remaining,1);
  assert.equal(getScoreProgress(-1).total,0);
  assert.equal(guestScore(0,10),10);assert.equal(guestScore(9,10),1);
  assert.equal(guestScore(0,9),null);
});
