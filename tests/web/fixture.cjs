const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AxeBuilder } = require('@axe-core/playwright');
const UID = '11111111-1111-4111-8111-111111111111';
const LIST_ID = '22222222-2222-4222-8222-222222222222';
const DRAFT_KEY = 'rankr.guest-draft.v1';
const AUTH_KEY = 'sb-ysfpyglqbndphhvcqzep-auth-token';
const baseUser = { id: UID, email: 'alex@example.test', aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z', user_metadata: { terms_version: '2026-09-29' } };
const token = user => ({ access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user });
async function setup(browser, origin, { width=1440, auth=false, newAccount=false, draft=null, existingList=false, itemCount=9 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const user = structuredClone(baseUser);
  if (newAccount) user.user_metadata.rankr_walkthrough_required = true;
  let profile = { id: UID, username: 'alex', display_name: 'Alex', is_public: true };
  const state = { requests: [], imports: [], failImport: false, updates: 0, deleted: false, failDelete: false, emptyDelete: false, deleteCalls: 0, itemCount };
  const errors = [];
  await context.addInitScript(({ auth, session, draft, draftKey, authKey }) => {
    if (auth && !localStorage.getItem(authKey)) localStorage.setItem(authKey, JSON.stringify(session));
    if (draft && !localStorage.getItem(draftKey)) localStorage.setItem(draftKey, JSON.stringify(draft));
  }, { auth, session: token(user), draft, draftKey: DRAFT_KEY, authKey: AUTH_KEY });
  // Fail closed: only the local build reaches the network. All backend/provider
  // calls are mocked or aborted, including attempts to use the live project.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== 'ysfpyglqbndphhvcqzep.supabase.co') return route.abort();
    state.requests.push({ method: request.method(), path: url.pathname });
    let body = {}; try { body = request.postDataJSON() || {}; } catch {}
    let data = [], status = 200;
    if (url.pathname === '/auth/v1/signup') { user.user_metadata = { ...user.user_metadata, ...body.data }; data = token(user); }
    else if (url.pathname === '/auth/v1/token') data = token(user);
    else if (url.pathname === '/auth/v1/user') { if (request.method() === 'PUT') { user.user_metadata = { ...user.user_metadata, ...body.data }; state.updates++; } data = user; }
    else if (url.pathname === '/rest/v1/profiles') { if (request.method() === 'GET') data = url.searchParams.has('username') ? [] : [profile]; else { profile = { ...profile, ...body }; data = profile; } }
    else if (url.pathname.endsWith('/rpc/rankr_import_guest_list')) { state.imports.push(body.p_draft); if (state.failImport) { status = 500; data = { message: 'Simulated save failure' }; } else { state.imported = body.p_draft; data = [{ id: body.p_draft.id, title: body.p_draft.title, category: body.p_draft.category }]; } }
    else if (url.pathname === '/rest/v1/list_items') data = Array.from({ length: state.itemCount }, (_, i) => ({ id: `item-${i}`, list_id: LIST_ID, title: `Favorite ${i+1}`, rank: 10-i, bookmarked: false, category: 'movies' }));
    else if (url.pathname === '/rest/v1/lists' && request.method() === 'DELETE') {
      state.deleteCalls++; assert.equal(url.searchParams.get('user_id'), 'eq.' + UID);
      if (state.failDelete) { status=500; data={message:'Simulated deletion failure'}; }
      else if (state.emptyDelete) data=[];
      else { state.deleted=true; data=[{id:LIST_ID}]; }
    } else if (url.pathname === '/rest/v1/lists') {
      const imported = state.imported;
      data = state.deleted ? [] : imported ? [{ id: imported.id, user_id: UID, title: imported.title, category: imported.category, visibility: 'private', list_items: [{ count: imported.items.length }] }] : existingList ? [{ id: LIST_ID, user_id: UID, title: 'Existing favorites', category: 'movies', visibility: 'private', list_items:[{count:state.itemCount}] }] : [];
    }
    await route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data), headers:{ 'content-range': `0-${Math.max((data.length||0)-1,0)}/${data.length||0}` } });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  return { context, page, state, async close() { await context.close(); assert.deepEqual(errors, [], 'No browser runtime errors'); } };
}
async function capture(page, name, { accessibility = true } = {}) {
  await page.waitForTimeout(500); // Let incumbent entrance animations settle.
  const dir = path.resolve('test-results'); await fs.mkdir(dir, {recursive:true});
  await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), false, 'No horizontal overflow');
  if (accessibility) {
    const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
    assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})), [], 'No WCAG A/AA violations');
  }
}
module.exports = { setup, capture, UID, LIST_ID, DRAFT_KEY };
