const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {ESLint}=require('eslint');
const lint=new ESLint({cwd:path.resolve(__dirname,'..')});

test('lint rejects conditional hooks, stale effect dependencies and inaccessible JSX',async()=>{
 const source=`import {useEffect,useState} from 'react';export function Broken({flag}:{flag:boolean}){if(flag)useState(0);useEffect(()=>{document.title=String(flag)},[]);return <img src="/test.png"/>}`;
 const [result]=await lint.lintText(source,{filePath:'src/lint-contract.tsx'});
 for(const rule of ['react-hooks/rules-of-hooks','react-hooks/exhaustive-deps','jsx-a11y/alt-text'])assert.ok(result.messages.some(message=>message.ruleId===rule),rule);
});

test('lint permits a labelled scroll region to remain keyboard reachable',async()=>{
 const [result]=await lint.lintText('export function TableScroll(){return <div role="region" aria-label="Report squadra" tabIndex={0}><table><caption>Report</caption></table></div>}',{filePath:'src/lint-contract.tsx'});
 assert.deepEqual(result.messages,[]);
});
