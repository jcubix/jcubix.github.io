const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path');
async function open(page,route,role='admin'){
 await page.route(url=>url.origin==='http://127.0.0.1:4202'&&url.pathname==='/browser-entry',async r=>r.fulfill({response:await r.fetch({url:'http://127.0.0.1:4202/tests/fixtures/browser.html'})}));
 await page.route(url=>['http:','https:'].includes(url.protocol)&&url.origin!=='http://127.0.0.1:4202',r=>r.abort());
 await page.clock.setFixedTime(new Date('2026-10-25T12:00:00+01:00'));
 await page.goto('/browser-entry?role='+role+'#/'+route);
 await page.locator('.app-header').waitFor();await page.evaluate(()=>document.fonts.ready);
}
for(const route of ['dashboard','training','matches','communications','finance','reports'])test(route+' layout and WCAG checks',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,route);
 const main=page.locator('#mainContent');await expect(main).not.toBeEmpty();
 if(route==='reports'){await page.locator('#rp').selectOption('player-1');}
 if(route==='finance')await page.locator('.finance-summary').waitFor();
 await expect(page.locator('.app-mobile-nav a[aria-current=page]')).toHaveCount(1);
 const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('.header-actions > button,.header-actions > a,.header-settings > summary')].map(el=>({name:el.getAttribute('aria-label'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))}));
 expect(geometry.overflow).toBe(false);for(const target of geometry.targets){expect(target.width,target.name).toBeGreaterThanOrEqual(44);expect(target.height,target.name).toBeGreaterThanOrEqual(44);}
 const layout=await page.evaluate(()=>{
  const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.round(r[k])]));};
  const main=document.querySelector('#mainContent'),style=getComputedStyle(main),root=getComputedStyle(document.documentElement);
  return {header:box('.app-header'),navigation:box('.app-mobile-nav'),main:{x:Math.round(main.getBoundingClientRect().x),width:Math.round(main.getBoundingClientRect().width),paddingTop:parseFloat(style.paddingTop),paddingBottom:parseFloat(style.paddingBottom)},palette:Object.fromEntries(['--bg','--surface','--ink','--primary','--primary-foreground'].map(k=>[k,root.getPropertyValue(k).trim()]))};
 });
 const baseline=path.join(__dirname,'baselines',info.project.name+'-'+route+'.json');
 if(process.env.EBURUM_UPDATE_LAYOUT==='1'){if(process.env.CI)throw Error('Layout baselines cannot be updated in CI');fs.mkdirSync(path.dirname(baseline),{recursive:true});fs.writeFileSync(baseline,JSON.stringify(layout,null,2)+'\n');}
 const expected=JSON.parse(fs.readFileSync(baseline,'utf8'));
 for(const group of ['header','navigation','main'])for(const key of Object.keys(expected[group]))expect(Math.abs(layout[group][key]-expected[group][key]),group+'.'+key).toBeLessThanOrEqual(2);
 expect(layout.palette).toEqual(expected.palette);
 const search=page.locator('.sc-search input');if(await search.count())expect(await search.first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 await info.attach('accessibility',{body:JSON.stringify(a11y.violations,null,2),contentType:'application/json'});
 await info.attach('layout',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
 await info.attach('screen',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(a11y.violations).toEqual([]);expect(errors).toEqual([]);
});
test('notched phone header and account are reachable',async({page},info)=>{
 test.skip(!info.project.name.startsWith('phone'));
 await open(page,'dashboard');await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-top','59px');document.documentElement.style.setProperty('--safe-area-bottom','34px')});
 const account=page.locator('.header-settings > summary');const box=await account.boundingBox();expect(box.y).toBeGreaterThanOrEqual(59);await account.tap();await expect(page.locator('.header-settings-panel .app-season select')).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Guida all’app',exact:true}).tap();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Chiudi',exact:true}).tap();await expect(page.getByRole('dialog')).toBeHidden();
});
test('meeting composer retains a failed draft and then publishes once',async({page})=>{
 await open(page,'communications');await page.getByRole('button',{name:'Nuova comunicazione',exact:true}).click();await page.getByRole('button',{name:'Riunione',exact:true}).click();
 await page.locator('#communication-title').fill('Riunione di prova');await page.locator('#communication-body').fill('Contenuto sintetico per il test.');await page.locator('#meeting-date').fill('2026-11-02');await page.locator('#meeting-time').fill('20:30');await page.locator('#meeting-location').fill('Sede di prova');
 await page.evaluate(()=>window.fixtureCommunicationError={message:'Offline'});const submit=page.locator('#communication-title').locator('xpath=ancestor::form').getByRole('button',{name:/Pubblica/});await submit.click();await expect(page.getByText(/Pubblicazione non riuscita/)).toBeVisible();await expect(page.locator('#meeting-location')).toHaveValue('Sede di prova');await page.evaluate(()=>delete window.fixtureCommunicationError);await submit.click();await expect(page.locator('#communication-title')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Riunione di prova'})).toBeVisible();
 expect(await page.evaluate(()=>window.fixtureData.staff_communications.filter(m=>m.title==='Riunione di prova').length)).toBe(1);
});


test('dialogs finish their CSS exit and honor reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await open(page,'communications');
 await page.evaluate(()=>{window.recordedMotion=[];document.addEventListener('animationstart',e=>window.recordedMotion.push(e.animationName))});
 await page.getByRole('button',{name:'Guida all’app',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Chiudi',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const names=await page.evaluate(()=>window.recordedMotion);expect(names).toContain('club-overlay-in');expect(names).toContain('club-overlay-out');expect(names).toContain('club-dialog-leave');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.recordedMotion=[]);await page.getByRole('button',{name:'Guida all’app',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.locator('.modern-dialog').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.getByRole('button',{name:'Chiudi',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('styled deletion cancels safely before removing a shared message',async({page})=>{
 await open(page,'communications');const remove=page.getByRole('button',{name:'Elimina comunicazione: Ritrovo per la prossima gara',exact:true});
 await remove.click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.locator('.confirm-actions [data-confirm-cancel]').click();await expect(remove).toBeVisible();
 await remove.click();await page.locator('[data-confirm-accept]').click();await expect(remove).toHaveCount(0);expect(await page.evaluate(()=>window.fixtureData.staff_communications.some(m=>m.id==='review-message'))).toBe(false);
});
