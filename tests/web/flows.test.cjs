const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { once } = require('node:events');
const { chromium } = require('playwright');
const { createPreviewServer } = require('../../scripts/serve-web.cjs');
const { setup, capture, LIST_ID, DRAFT_KEY } = require('./fixture.cjs');
let browser, server, origin;
before(async () => {
  server = createPreviewServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve=>server.close(resolve)); });

for (const width of [1440,390]) {
  test(`Guest scores unlock at 10 and relock after removal (${width}px)`, {timeout:60000}, async t => {
    const f = await setup(browser,origin,{width}); t.after(()=>f.close()); const p=f.page;
    await p.goto(origin+'/try'); await p.getByRole('button',{name:'Add your first favorite',exact:true}).click();
    await p.getByText('10 more favorites to unlock scores',{exact:true}).waitFor(); await capture(p,`guest-zero-${width}`);
    for (let i=1;i<=9;i++) { await p.getByLabel('Favorite title',{exact:true}).fill(`Favorite ${i}`); await p.getByRole('button',{name:'Add favorite',exact:true}).click(); }
    await p.getByText('1 more favorite to unlock scores',{exact:true}).waitFor(); assert.equal(await p.getByLabel(/Score .* out of 10/).count(),0);
    await capture(p,`guest-nine-${width}`);
    await p.getByLabel('Favorite title',{exact:true}).fill('Favorite 10'); await p.getByRole('button',{name:'Add favorite',exact:true}).click();
    await p.getByText('Scores unlocked',{exact:true}).waitFor(); assert.equal(await p.getByLabel(/Score .* out of 10/).count(),10); await capture(p,`guest-ten-${width}`);
    await p.getByRole('button',{name:'Remove Favorite 10',exact:true}).click(); await p.getByText('1 more favorite to unlock scores',{exact:true}).waitFor();
    assert.equal(await p.getByLabel(/Score .* out of 10/).count(),0); assert.equal(f.state.requests.length,0,'No backend requests for guest list building');
  });
  test(`Guest ordering, undo, reload and signup handoff (${width}px)`, {timeout:60000}, async t => {
    const f = await setup(browser,origin,{width}); t.after(()=>f.close()); const p=f.page;
    await p.goto(origin+'/try'); await p.getByLabel('List name',{exact:true}).fill('Movie nights'); await p.getByRole('button',{name:'Add your first favorite',exact:true}).click();
    for(const title of ['Arrival','Spirited Away','Sintel']) { await p.getByLabel('Favorite title',{exact:true}).fill(title); await p.getByRole('button',{name:'Add favorite',exact:true}).click(); }
    await p.getByRole('button',{name:'Compare your top two'}).click(); await p.getByRole('button',{name:'Choose Spirited Away'}).click();
    assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0].title,DRAFT_KEY),'Spirited Away');
    await p.getByRole('button',{name:'Undo last comparison'}).click();
    await p.getByRole('button',{name:'Move Sintel up'}).focus(); await p.keyboard.press('Enter');
    await p.reload(); await p.getByText('Movie nights',{exact:true}).waitFor();
    assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[1].title,DRAFT_KEY),'Sintel');
    assert.equal(f.state.requests.length,0);
    await p.getByRole('button',{name:'Save my list',exact:true}).click(); await p.getByRole('heading',{name:'Keep your first list'}).waitFor();
    await capture(p,`signup-${width}`);
    if(width===1440) {
      await p.getByLabel('Username',{exact:true}).fill('alex'); await p.getByLabel('Email address',{exact:true}).fill('alex@example.test');
      await p.getByLabel('Password',{exact:true}).fill('ExamplePass123'); await p.getByLabel('Confirm password',{exact:true}).fill('ExamplePass123');
      await p.getByRole('checkbox').check(); await p.getByRole('button',{name:'Create Account',exact:true}).click();
      await p.getByRole('button',{name:'Save my list privately'}).waitFor();
      f.state.failImport=true; await p.getByRole('button',{name:'Save my list privately'}).click(); await p.getByRole('alert').waitFor();
      assert.ok(await p.evaluate(k=>localStorage.getItem(k),DRAFT_KEY));
      f.state.failImport=false; await p.getByRole('button',{name:'Save my list privately'}).click();
      await p.getByRole('heading',{name:'Make the list yours.'}).waitFor();
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),DRAFT_KEY),null);
      assert.equal(f.state.imports.length,2); assert.equal(f.state.imports[0].id,f.state.imports[1].id,'Retry same draft ID');
      await p.getByRole('button',{name:'Skip introduction'}).click(); await p.waitForURL(/\/lists\//);
    }
  });
  test(`Full/short introduction, skip and replay (${width}px)`, {timeout:60000}, async t => {
    const f=await setup(browser,origin,{width,auth:true,newAccount:true}); t.after(()=>f.close()); const p=f.page;
    await p.goto(origin+'/'); await p.getByRole('heading',{name:'Give your favorites a home.'}).waitFor();
    await capture(p,`full-tour-${width}`); await p.getByRole('button',{name:'Build my first list'}).click(); await p.getByLabel('List name',{exact:true}).waitFor();
    await p.goto(origin+'/walkthrough?variant=full'); await p.getByRole('button',{name:'Skip introduction'}).click(); await p.waitForURL(/\/lists/);
    assert.equal(f.state.updates,1); await p.goto(origin+'/walkthrough?variant=full&replay=1');
    await p.getByRole('heading',{name:'Give your favorites a home.'}).waitFor(); await p.getByRole('button',{name:'Skip introduction'}).click(); await p.waitForURL(/\/lists/); assert.equal(f.state.updates,1);
    const short=await setup(browser,origin,{width,auth:true,newAccount:true,existingList:true}); t.after(()=>short.close());
    await short.page.goto(origin+'/'); await short.page.getByRole('heading',{name:'Make the list yours.'}).waitFor(); await capture(short.page,`short-tour-${width}`);
  });
  test(`Delete list confirms, handles errors, and removes only on success (${width}px)`, {timeout:60000}, async t => {
    const f=await setup(browser,origin,{width,auth:true,existingList:true}); t.after(()=>f.close()); const p=f.page;
    await p.goto(`${origin}/lists/${LIST_ID}`); const del=p.getByRole('button',{name:'Delete list',exact:true}); await del.waitFor();
    await p.getByText('1 more favorite to unlock scores',{exact:true}).waitFor();
    // Existing third-party BottomSheet slider ARIA omissions are documented;
    // guest, auth, tour and list-index accessibility remain enforced above.
    await capture(p,`saved-nine-${width}`,{accessibility:false});
    f.state.itemCount=10; await p.reload(); await p.getByText('Scores unlocked',{exact:true}).waitFor(); await capture(p,`saved-ten-${width}`,{accessibility:false});
    p.once('dialog',d=>{assert.match(d.message(),/Existing favorites/);d.dismiss();}); await del.click(); assert.equal(f.state.deleteCalls,0);
    f.state.failDelete=true; p.once('dialog',d=>d.accept()); await del.click(); await p.getByText('Could not delete your list. Please try again.',{exact:true}).waitFor(); assert.match(p.url(),new RegExp(LIST_ID));
    f.state.failDelete=false; f.state.emptyDelete=true; p.once('dialog',d=>d.accept()); await del.click();
    await p.getByText('This list could not be deleted. Refresh and check that you own it.',{exact:true}).waitFor(); assert.equal(f.state.deleted,false);
    f.state.emptyDelete=false; p.once('dialog',d=>d.accept()); await del.click(); await p.waitForURL(/\/lists\/?$/); await p.getByRole('heading',{name:'My Lists'}).waitFor();
    assert.equal(f.state.deleted,true); assert.equal(await p.getByText('Existing favorites',{exact:true}).count(),0);
  });
}

test('My Lists offers keyboard deletion and removes the confirmed list', {timeout:30000}, async t => {
  const f=await setup(browser,origin,{auth:true,existingList:true}); t.after(()=>f.close()); const p=f.page;
  await p.goto(origin+'/lists'); await p.getByText('Existing favorites',{exact:true}).waitFor(); await capture(p,'list-index');
  const del=p.getByRole('button',{name:'Delete Existing favorites',exact:true}).last();
  p.once('dialog',d=>d.dismiss()); await del.focus(); await p.keyboard.press('Enter'); assert.equal(f.state.deleteCalls,0);
  p.once('dialog',d=>d.accept()); await del.click(); await p.getByText('List deleted.',{exact:true}).waitFor(); assert.equal(await p.getByText('Existing favorites',{exact:true}).count(),0);
});
