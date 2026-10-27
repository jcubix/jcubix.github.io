const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('React exclusively owns the frontend: no legacy HTML renderer or event binder remains',()=>{
 for(const file of fs.readdirSync(root).filter(file=>/^app-.*\.js$/.test(file))){const code=fs.readFileSync(path.join(root,file),'utf8');assert.doesNotMatch(code,/innerHTML|insertAdjacentHTML|registerExtension|registerBinder|bindDialog|\.onclick\s*=|\.onsubmit\s*=/,file);}
 for(const file of fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(file=>/\.tsx?$/.test(file))){const code=fs.readFileSync(path.join(root,'src',file),'utf8');assert.doesNotMatch(code,/FeatureSurface|dangerouslySetInnerHTML|featureHtml|bindFeature|mountTrainingReplies/,file);}
 for(const file of ['app-hooks.js','app-icons.js'])assert.equal(fs.existsSync(path.join(root,file)),false);
});
