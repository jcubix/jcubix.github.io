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


test('searches have one focus ring and message filters keep a quiet, reachable selection',async({page})=>{
 const searches=[];
 for(const [route,selector] of [['players','.sc-search'],['communications','.communication-search']]){
  await open(page,route);const search=page.locator(selector),input=search.locator('input');await input.focus();
  const style=await search.evaluate(el=>{const outer=getComputedStyle(el),field=getComputedStyle(el.querySelector('input'));return {radius:outer.borderRadius,background:outer.backgroundColor,outerFocus:outer.outlineStyle,innerFocus:field.outlineStyle,innerBorder:field.borderWidth,innerBackground:field.backgroundColor,font:field.fontFamily};});
  expect(style.outerFocus).toBe('solid');expect(style.innerFocus).toBe('none');expect(style.innerBorder).toBe('0px');expect(style.innerBackground).toBe('rgba(0, 0, 0, 0)');searches.push(style);
  if(route==='players'){
   await input.fill('nessun-giocatore-con-questo-nome');await expect(page.locator('.sc-directory-row')).toHaveCount(0);
  }
 }
 expect(searches[0]).toEqual(searches[1]);
 const filters=page.getByRole('group',{name:'Filtra comunicazioni'}),buttons=filters.getByRole('button');
 await expect(buttons).toHaveCount(6);
 const geometry=await buttons.evaluateAll(elements=>elements.map(el=>Math.round(el.getBoundingClientRect().top)));
 expect(new Set(geometry).size).toBe(1);
 if(page.viewportSize().width<768)expect(await filters.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await buttons.last().focus();await expect(buttons.last()).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await buttons.filter({hasText:'Riunioni'}).click();await expect(buttons.filter({hasText:'Riunioni'})).toHaveAttribute('aria-pressed','true');
 const selected=await filters.locator('[aria-pressed=true]').evaluate(el=>{const style=getComputedStyle(el),probe=document.createElement('span');probe.style.color='var(--ink)';probe.style.background='var(--surface)';document.body.append(probe);const expected=getComputedStyle(probe),result={color:style.color,background:style.backgroundColor,radius:style.borderRadius,expectedColor:expected.color,expectedBackground:expected.backgroundColor};probe.remove();return result;});
 expect(selected.color).toBe(selected.expectedColor);expect(selected.background).toBe(selected.expectedBackground);expect(selected.radius).toBe('999px');
});

test('dashboard cards share surfaces, compact badges and consistent header actions',async({page})=>{
 await open(page,'dashboard');
 const styles=await page.evaluate(()=>{
  const sample=document.createElement('span');sample.style.background='var(--surface)';document.body.append(sample);const surface=getComputedStyle(sample).backgroundColor;sample.remove();
  return {surface,cards:[...document.querySelectorAll('.sc-home-tasks .sc-rows,.sc-last-training,.sc-communication-preview,.sc-home-availability')].map(el=>({background:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius})),badges:[...document.querySelectorAll('.sc-home-tasks .sc-small-count')].map(el=>({width:el.getBoundingClientRect().width,parentWidth:el.parentElement.getBoundingClientRect().width})),icons:[...document.querySelectorAll('.header-actions>button,.header-settings>summary')].map(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {radius:s.borderRadius,width:r.width,height:r.height};})};
 });
 expect(styles.cards.length).toBeGreaterThan(2);
 for(const card of styles.cards){expect(card.background).toBe(styles.surface);expect(card.radius).toBe('16px');}
 for(const badge of styles.badges){expect(badge.width).toBeLessThan(130);expect(badge.width).toBeLessThan(badge.parentWidth);}
 for(const icon of styles.icons){expect(icon.radius).toBe('999px');expect(icon.width).toBe(44);expect(icon.height).toBe(44);}
});

test('visual handoff keeps home stats readable and match reports formatted without changing exports',async({page},info)=>{
 await open(page,'dashboard');
 const stats=page.locator('.home-stat-grid');await expect(stats).toHaveCount(2);
 for(const grid of await stats.all()){
  await expect(grid.locator('dd')).toHaveCount(3);
  const boxes=await grid.locator('dd').evaluateAll(es=>es.map(e=>({top:Math.round(e.getBoundingClientRect().top),font:parseFloat(getComputedStyle(e).fontSize)})));
  expect(new Set(boxes.map(b=>b.top)).size).toBe(1);expect(boxes.every(b=>b.font>=24)).toBe(true);
 }
 await info.attach('home-uplift',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.getByRole('link',{name:/Messaggi/}).click();await expect(page.locator('.communication-overview dd').nth(1)).toHaveText('1');
 if(page.viewportSize().width>=1024){await page.getByRole('button',{name:'Mostra da confermare'}).click();await expect(page.getByRole('button',{name:'Da confermare',exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.getByRole('link',{name:/Partite/}).click();await page.locator('.sc-match-preview').filter({hasText:'Squadra ospite'}).click();await page.locator('[data-activity-tab=results]').click();
 const edits=page.locator('.match-timeline .event-edit');await expect(edits.first()).toBeVisible();
 if(page.viewportSize().width>=1024){const timeline=await page.locator('#matchEventList').boundingBox(),notes=await page.locator('.match-game-notes').boundingBox();expect(notes.x).toBeGreaterThanOrEqual(timeline.x+timeline.width);}
 const target=await edits.first().boundingBox();expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);
 await edits.first().click();await expect(page.locator('#eventForm')).toBeVisible();await page.getByRole('button',{name:'Chiudi evento',exact:true}).click();
 await page.locator('.match-report-trigger').click();const preview=page.locator('#matchReportPreview');await expect(preview).toBeVisible();await expect(page.locator('#matchReportText')).toBeHidden();
 await expect(preview.locator('.match-report-score b').first()).toHaveText('2');await expect(preview).toContainText('Conclusione dal limite');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 const a11y=await new AxeBuilder({page}).include('.match-report-modal').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
 await info.attach('formatted-match-report',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.getByRole('button',{name:'Chiudi tabellino',exact:true}).click();await page.getByRole('button',{name:'Chiudi attività',exact:true}).click();
 await page.getByRole('link',{name:'Altro',exact:true}).click();
 const email='allenatore.'+'squadra.'.repeat(20)+'prova@example.test';
 await page.evaluate(email=>{const db=window.fixtureMount.runtime.db,invoke=db.functions.invoke;db.functions.invoke=async(fn,options)=>{const result=await invoke(fn,options);if(options.body.action==='list')result.data.users[0].email=email;return result}},email);
 await page.getByRole('button',{name:/Gestione utenti/}).click();const address=page.locator('.user-email').first();await expect(address).toHaveAttribute('title',email);
 expect(await address.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});


test('registered meetings use one disclosure icon and unboxed list rows; refresh is a direct icon action',async({page})=>{
 await open(page,'communications');await page.waitForFunction(()=>window.fixtureMount?.runtime);
 await page.evaluate(()=>{
  const meeting={id:'legacy-ui-meeting',user_id:fixtureUser.id,activity_type:'Riunione',title:'Riunione precedente di prova',activity_date:'2026-10-20',start_time:'19:00',status:'Programmato',revision:0};
  fixtureData.activities.push(meeting);window.fixtureMount.runtime.state.activities.push(meeting);window.fixtureMount.runtime.render();
 });
 await expect(page.locator('.communication-refresh-menu')).toHaveCount(0);
 const refresh=page.getByRole('button',{name:'Aggiorna comunicazioni',exact:true});await expect(refresh).toBeVisible();await expect(refresh).toHaveText('');
 await page.evaluate(()=>window.fixtureCommunicationError={message:'Offline di prova'});await refresh.click();await expect(page.getByRole('alert')).toContainText('Aggiornamento non riuscito');
 await page.evaluate(()=>delete window.fixtureCommunicationError);await refresh.click();await expect(page.getByRole('alert')).toHaveCount(0);
 const history=page.locator('.communication-legacy-meetings');await history.locator('summary').click();const row=history.getByRole('button',{name:/Riunione precedente di prova/});await expect(row).toBeVisible();
 expect(await history.locator('summary').evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
 const style=await row.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderWidth,radius:s.borderRadius,background:s.backgroundColor};});
 expect(style).toEqual({border:'0px',radius:'0px',background:'rgba(0, 0, 0, 0)'});
 await row.click();await expect(page.locator('#planningForm')).toBeVisible();
});

test('match notes are visible without opening a disclosure and save with the result',async({page})=>{
 await open(page,'matches');await page.locator('.sc-match-preview').filter({hasText:'Atletico Battipaglia 2018'}).click();
 await page.locator('[data-activity-tab=results]').click();const note=page.locator('#matchNote');await expect(note).toBeVisible();
 expect(await note.evaluate(el=>el.closest('details')===null)).toBe(true);await note.fill('Nota gara sintetica sempre visibile');
 await page.locator('#saveMatchResult').click();await expect(page.locator('#saveMatchResult')).toBeEnabled();
 await expect.poll(()=>page.evaluate(()=>fixtureData.matches.find(m=>m.id==='future-match').note)).toBe('Nota gara sintetica sempre visibile');
});

test('training replies keep save and a reversible pending counter in one floating bar',async({page})=>{
 await open(page,'training');
 const bar=page.locator('.planning-save'),save=bar.locator('#savePlanning'),counter=bar.locator('#planningChanges');
 await expect(save).toBeVisible();await expect(save).toHaveText('Salva');await expect(save).toBeDisabled();await expect(counter).toBeHidden();
 expect(await page.locator('.sc-training-aside #savePlanning').count()).toBe(0);
 const reply=(player,value)=>page.locator(`[data-training-player="${player}"][data-training-reply="${value}"]`);
 await reply('player-1','Disponibile').click();await expect(counter).toHaveText('1');await expect(counter).toHaveAccessibleName('1 risposta da salvare');await expect(save).toBeEnabled();
 await reply('player-1','Indisponibile').click();await expect(counter).toHaveText('1');
 await reply('player-2','Disponibile').click();await expect(counter).toHaveText('2');
 await reply('player-1','In attesa').click();await expect(counter).toHaveText('1');
 await reply('player-2','In attesa').click();await expect(counter).toBeHidden();await expect(save).toBeDisabled();
 await reply('player-1','Disponibile').click();
 await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-bottom','34px')});
 await page.locator('.sc-training-aside').scrollIntoViewIfNeeded();
 const geometry=await bar.evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('.app-mobile-nav'),n=nav.getBoundingClientRect();return {position:getComputedStyle(el).position,x:r.x,right:r.right,bottom:r.bottom,top:r.top,height:r.height,navVisible:n.height>0&&getComputedStyle(nav).display!=='none',navTop:n.top,navRight:n.right,overflow:document.documentElement.scrollWidth>innerWidth}});
 expect(geometry.position).toBe('fixed');expect(geometry.x).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(page.viewportSize().width);expect(geometry.bottom).toBeLessThanOrEqual(page.viewportSize().height-24);expect(geometry.height).toBeLessThan(100);expect(geometry.overflow).toBe(false);
 if(geometry.navVisible&&geometry.navRight>geometry.x)expect(geometry.bottom).toBeLessThanOrEqual(geometry.navTop);
 await expect(page.locator('#planningFeedback')).toBeEmpty();
 await page.evaluate(()=>window.fixtureSaveError={message:'Connessione interrotta. Riprova.'});await save.click();await expect(bar.locator('#planningFeedback')).toContainText('Connessione interrotta');await expect(counter).toHaveText('1');await expect(save).toBeEnabled();expect(await bar.locator('#planningFeedback').evaluate(el=>getComputedStyle(el).position)).toBe('static');
 await page.evaluate(()=>delete window.fixtureSaveError);await save.click();await expect(save).toBeDisabled();await expect(counter).toBeHidden();
 expect(await page.evaluate(()=>fixtureData.activity_roster.find(r=>r.activity_id==='review-training'&&r.player_id==='player-1').availability)).toBe('Disponibile');
 await page.locator('[data-training-phase=actual]').click();await expect(bar).toBeHidden();await page.locator('[data-training-phase=replies]').click();await expect(save).toBeVisible();
});

test('whiteboard tools stay compact and the field can draw, undo, save and export',async({page},info)=>{
 await open(page,'whiteboard');await page.getByRole('button',{name:'Nuova lavagna',exact:true}).click();
 const controls=page.locator('.wb-controls'),toolbar=page.getByRole('group',{name:'Strumenti di disegno'}),stage=page.locator('.wb-stage'),svg=stage.locator('svg').first(),actions=controls.locator('.wb-save');
 if(page.viewportSize().width>=1024)await expect(page.locator('.app-mobile-nav')).toBeVisible();else await expect(page.locator('.app-mobile-nav')).toBeHidden();
 await expect(toolbar.getByRole('button')).toHaveCount(8);await expect(actions.getByRole('button',{name:'Salva lavagna',exact:true})).toBeVisible();
 const geometry=await toolbar.evaluate(el=>({height:el.getBoundingClientRect().height,rows:new Set([...el.children].map(b=>Math.round(b.getBoundingClientRect().top))).size,targets:[...el.children].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),overflow:document.documentElement.scrollWidth>innerWidth}));
 expect(geometry.overflow).toBe(false);for(const target of geometry.targets){expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);}
 if(page.viewportSize().width<=1023){expect(geometry.rows).toBe(2);expect(geometry.height).toBeLessThanOrEqual(120);expect(await controls.evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(300);}
 expect(await actions.evaluate(e=>getComputedStyle(e).position)).toBe('static');
 expect(await actions.evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('.wb-stage').getBoundingClientRect().top)).toBe(true);
 await info.attach('whiteboard-editor',{body:await page.screenshot(),contentType:'image/png'});
 await toolbar.getByRole('button',{name:'Freccia',exact:true}).click();await svg.scrollIntoViewIfNeeded();
 const box=await svg.boundingBox(),c=await controls.boundingBox(),y=Math.max(box.y+50,c.y+c.height+24),x=box.x+box.width*.3;
 expect(y+60).toBeLessThan(Math.min(box.y+box.height,page.viewportSize().height));
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y+60,{steps:5});await page.mouse.up();await expect(svg.locator('[data-mark]')).toHaveCount(1);
 await page.getByRole('button',{name:'Annulla ultima modifica',exact:true}).click();await expect(svg.locator('[data-mark]')).toHaveCount(0);await page.getByRole('button',{name:'Ripristina modifica',exact:true}).click();await expect(svg.locator('[data-mark]')).toHaveCount(1);
 await actions.getByRole('button',{name:'Salva lavagna',exact:true}).click();await expect(page.locator('.wb-feedback [role=status]')).toContainText('Lavagna salvata');
 expect(await page.evaluate(()=>fixtureData.tactical_boards[0].document.marks[0].kind)).toBe('arrow');
 const download=page.waitForEvent('download');await actions.getByRole('button',{name:'Esporta immagine',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.png$/);await expect(page.locator('.wb-feedback [role=status]')).toContainText('Immagine esportata');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#17483e';ctx.fillRect(0,0,40,80);return c.toDataURL('image/png').split(',')[1]});
 await page.locator('input[type=file]').setInputFiles({name:'foto-prova.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect(svg.locator('image')).toHaveCount(1);await expect(stage).toHaveAttribute('data-portrait','false');
 await page.getByRole('button',{name:'Usa campo',exact:true}).click();await expect(svg.locator('image')).toHaveCount(0);await expect(svg.locator('[data-mark]')).toHaveCount(1);
});


test('React editors retain rounded controls, readable contrast and accessible form names',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,'matches');await page.locator('.sc-match-preview').filter({hasText:'Atletico Battipaglia 2018'}).click();await expect(page.locator('#activityForm')).toBeVisible();
 const check=async name=>{const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations,name).toEqual([]);const folder=path.resolve(__dirname,'../../output/react-review');fs.mkdirSync(folder,{recursive:true});await info.attach(name,{body:await page.screenshot({path:path.join(folder,info.project.name+'-'+name+'.png'),fullPage:true}),contentType:'image/png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);};
 const saveBar=page.locator('#activityForm .workspace-save');await expect(saveBar).toBeVisible();
 const dock=await saveBar.evaluate(el=>({bar:el.getBoundingClientRect().toJSON(),nav:document.querySelector('.app-mobile-nav').getBoundingClientRect().toJSON()}));if(dock.nav.height>300)expect(dock.bar.x).toBeGreaterThanOrEqual(dock.nav.right);else expect(dock.bar.bottom).toBeLessThanOrEqual(dock.nav.top);expect(dock.bar.x).toBeGreaterThanOrEqual(0);expect(dock.bar.right).toBeLessThanOrEqual(page.viewportSize().width);
 await check('match-roster-react');await page.locator('[data-activity-tab=results]').click();const widths=await page.locator('.match-score-fields input').evaluateAll(inputs=>inputs.map(input=>input.getBoundingClientRect().width));expect(Math.abs(widths[0]-widths[1])).toBeLessThanOrEqual(1);expect(Math.min(...widths)).toBeGreaterThan(100);await page.locator('#addOpponentGoal').click();await check('event-react');await page.locator('#close').click();await page.locator('#closeActivity').click();
 await page.locator('.app-mobile-nav a[href="#/more"]').click();await page.locator('.sc-tool-list a[href="#/players"]').click();await page.locator('.player-directory-entry, .roster-table td button').first().click();await expect(page.locator('#playerSheetTitle')).toBeVisible();await check('player-react');await page.getByRole('button',{name:'Chiudi scheda',exact:true}).click();
 await page.locator('.header-settings > summary').click();await page.getByRole('button',{name:'Gestione utenti',exact:true}).click();await expect(page.locator('#usersTitle')).toBeVisible();await check('users-react');
 expect(errors).toEqual([]);
});


test('React Register correction returns to its selected day after confirming an unsaved draft',async({page})=>{
 await open(page,'register');const date=await page.evaluate(()=>fixtureData.sessions[0].session_date);
 await page.evaluate(day=>{location.hash='/register?date='+day+'&month='+day.slice(0,7)},date);
 await page.locator('[data-edit-session="session-1"]').click();await expect(page.locator('#trainList')).toBeVisible();
 await page.locator('[data-presence-player="player-1"][data-presence="Assente"]').click();await page.locator('#backToTrainings').click();
 const confirmation=page.getByRole('alertdialog');await expect(confirmation).toBeVisible();await confirmation.getByRole('button',{name:'Esci dalle presenze',exact:true}).click();
 await expect(page.locator('#registerDetail')).toHaveAttribute('data-selected',date);await expect(page).toHaveURL(new RegExp('date='+date));
});
