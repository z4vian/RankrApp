import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOnboardingState, WALKTHROUGH_VERSION } from '../../lib/onboardingState.ts';
test('new signup usernames do not suppress walkthrough and legacy accounts stay uninterrupted', () => {
 assert.equal(resolveOnboardingState({rankr_walkthrough_required:true}, 'alex'), 'full');
 assert.equal(resolveOnboardingState({}, 'existing'), 'done');
 assert.equal(resolveOnboardingState({rankr_walkthrough_required:true,rankr_walkthrough_version:WALKTHROUGH_VERSION}, 'alex'), 'done');
 assert.equal(resolveOnboardingState({rankr_walkthrough_version:WALKTHROUGH_VERSION}, null), 'profile');
 assert.equal(resolveOnboardingState({}, ''), 'profile');
 assert.equal(resolveOnboardingState({rankr_walkthrough_required:true}, 'alex', true), 'short');
});
