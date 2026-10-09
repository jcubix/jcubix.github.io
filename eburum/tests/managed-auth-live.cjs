/* Optional real API test. Only temporary synthetic accounts/records; never log credentials. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../config.js','utf8'),scope);
const {supabaseUrl:base,supabaseAnonKey:key}=scope.window.CONFIG;
const email=process.env.AUTH_TEST_EMAIL,password=process.env.AUTH_TEST_PASSWORD;
if(!email?.startsWith('codex-auth-e2e-')||!email.endsWith('@example.invalid')||!password)throw Error('Temporary test administrator credentials required');
const cleanup={users:[],players:[]},checks=[];let adminToken;
async function request(path,token,body,method='POST'){const response=await fetch(base+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;try{data=await response.json()}catch{data=null}return {status:response.status,data}}
const login=(mail,pw)=>request('/auth/v1/token?grant_type=password',null,{email:mail,password:pw});
const staff=(token,body)=>request('/functions/v1/manage-users',token,body);
(async()=>{
 const session=await login(email,password);assert.equal(session.status,200,'temporary admin login');adminToken=session.data.access_token;
 const context=await request('/rest/v1/rpc/team_context',adminToken,{});assert.equal(context.status,200);assert.equal(context.data.role,'admin');const owner=context.data.owner_id;
 assert.equal((await staff(adminToken,{action:'list'})).status,200);checks.push('administrator login and staff list');
 const person=await request('/rest/v1/players',adminToken,{user_id:owner,surname:'Synthetic API verification',name:'Temporary',role:'Difensore',active:false});assert.equal(person.status,201);const pid=person.data[0].id;cleanup.players.push(pid);
 assert.equal((await request('/rest/v1/player_administration',adminToken,{user_id:owner,player_id:pid,registration_status:'Da verificare',certificate_until:'2300-01-01'})).status,201);
 const accounts=[];
 for(const role of ['admin','manager','coach','secretary']){
  const mail=`codex-auth-e2e-${crypto.randomUUID()}@example.invalid`,pw=crypto.randomBytes(32).toString('hex');
  const created=await staff(adminToken,{action:'create',email:mail,password:pw,role});assert.equal(created.status,201,role+' real Auth creation');cleanup.users.push(created.data.user.id);
  const signed=await login(mail,pw);assert.equal(signed.status,200,role+' login');const token=signed.data.access_token;
  const ctx=await request('/rest/v1/rpc/team_context',token,{});assert.equal(ctx.status,200);assert.equal(ctx.data.role,role);assert.equal(ctx.data.owner_id,owner);
  accounts.push({role,mail,pw,token,id:created.data.user.id});checks.push(role+': create, login, shared team context');
  if(role!=='admin')for(const action of ['list','create','role','password'])assert.equal((await staff(token,{action,userId:session.data.user.id,email:'forbidden@example.invalid',password:pw,role:'admin'})).status,403,role+' cannot '+action+' staff');
  const docs=await request('/rest/v1/player_administration?select=player_id&player_id=eq.'+pid,token,undefined,'GET');assert.equal(docs.status,200);assert.equal(docs.data.length,role==='coach'?0:1);
  const technical=await request('/rest/v1/activity_technical?select=activity_id&limit=1',token,undefined,'GET');assert.equal(technical.status,200);if(['manager','secretary'].includes(role))assert.equal(technical.data.length,0);
  if(role==='secretary'){
   const changed=await request('/rest/v1/player_administration?player_id=eq.'+pid,token,{registration_status:'In regola'},'PATCH');assert.equal(changed.status,200);assert.equal(changed.data.length,1);
   const prohibited=await request('/rest/v1/matches',token,{user_id:owner,match_date:'2300-01-01',opponent:'Forbidden synthetic match',venue:'Casa'});assert.equal(prohibited.status,403);
   assert.equal((await request('/rest/v1/team_members?user_id=eq.'+created.data.user.id,token,{role:'admin'},'PATCH')).status,403);
  }
 }
 assert.equal((await staff(adminToken,{action:'create',email:accounts[0].mail,password:accounts[0].pw,role:'coach'})).status,409,'duplicate email is explicit');checks.push('duplicate email, non-admin account management denial, administrative and technical RLS');
 assert.equal((await staff('invalid-token',{action:'list'})).status,401);
 const target=accounts.find(a=>a.role==='manager'),replacement=crypto.randomBytes(32).toString('hex');
 assert.equal((await staff(adminToken,{action:'password',userId:target.id,password:replacement})).status,200);const renewed=await login(target.mail,replacement);assert.equal(renewed.status,200);target.token=renewed.data.access_token;assert.equal((await login(target.mail,target.pw)).status,400);
 assert.equal((await staff(adminToken,{action:'role',userId:target.id,role:'secretary'})).status,200);assert.equal((await request('/rest/v1/rpc/team_context',target.token,{})).data.role,'secretary');assert.equal((await staff(target.token,{action:'list'})).status,403);checks.push('password reset and login, old password rejection, live role change on existing token');
 console.log(JSON.stringify({passed:true,checks,cleanup}));
})().catch(error=>{console.error(JSON.stringify({passed:false,error:error.message,cleanup}));process.exitCode=1}).finally(async()=>{
 if(adminToken)for(const id of cleanup.players){const result=await request('/rest/v1/players?id=eq.'+id,adminToken,undefined,'DELETE');if(result.status!==200){console.error(JSON.stringify({cleanupFailure:'synthetic player',id,status:result.status}));process.exitCode=1}}
});
