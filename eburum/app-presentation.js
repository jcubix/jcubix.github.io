// Calendar-day comparisons stay stable across daylight-saving changes.
export function dayLabel(value, today) {
 const days=Math.round((Date.parse(value+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
 return days===0?'Oggi':days===1?'Domani':days>1?`Tra ${days} giorni`:'Già disputata';
}
export function matchOutcome(match) {
 return match.goals_for==null||match.goals_against==null?null:match.goals_for>match.goals_against?'V':match.goals_for<match.goals_against?'P':'N';
}
export function relativeTime(value, at=Date.now()) {
 const minutes=Math.max(0,Math.floor((at-Date.parse(value))/60000));
 return minutes<1?'Ora':minutes<60?`${minutes} min fa`:minutes<1440?`${Math.floor(minutes/60)} h fa`:`${Math.floor(minutes/1440)} g fa`;
}

export function routeDetail(page, search) {
 const params=new URLSearchParams(search);
 const fields=page==='reports'?['match','detail']:page==='players'?['player','discipline']:page==='matches'?['match']:page==='training'||page==='meetings'?['session','activity']:page==='register'?['session','activity']:page==='more'?['tool']:[];
 for(const field of fields){const id=params.get(field);if(id)return {key:(page==='reports'?'report-':'')+field+':'+id,page};}
 return null;
}
export function detailPath(page, key, hash) {
 const [path,search='']=hash.replace(/^#/,'').split('?'),params=new URLSearchParams(path==='/'+page?search:'');
 const separator=key.indexOf(':'),field=key.slice(0,separator).replace(/^report-/,''),id=key.slice(separator+1);
 if(page==='reports'&&field==='match')params.delete('detail');
 params.set(field,id);return '/'+page+'?'+params;
}
export function detailListPath(hash) {
 const [path,search='']=hash.replace(/^#/,'').split('?'),params=new URLSearchParams(search);
 for(const field of ['match','activity','session','tool','detail','discipline'])params.delete(field);
 if(path==='/players')params.delete('player');
 return path+(params.size?'?'+params:'');
}

export function newestFirst(rows, dateOf) {
 return [...rows].sort((a,b)=>String(dateOf(b)||'').localeCompare(String(dateOf(a)||''))||String(a.id||'').localeCompare(String(b.id||'')));
}
export function rememberQuery(values) {
 const [path,search='']=window.location.hash.replace(/^#/,'').split('?'),params=new URLSearchParams(search);
 for(const [key,value] of Object.entries(values)){if(value==null||value==='')params.delete(key);else params.set(key,String(value));}
 window.history.replaceState(window.history.state,'','#'+path+(params.size?'?'+params:''));
}

export function validDay(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

// Preview only: the server remains authoritative for retention and Rome DST edges.
export function communicationDeadline(kind, date, time, days, now=Date.now()) {
 if(![1,3,7].includes(Number(days)))return null;
 if(kind!=='meeting')return new Date(now+Number(days)*86400000).toISOString();
 if(!validDay(date)||!/^([01]\d|2[0-3]):[0-5]\d/.test(time||''))return null;
 const wall=Date.parse(date+'T'+time.slice(0,5)+':00Z'),format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const fields=value=>Object.fromEntries(format.formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const candidates=new Set();
 for(const guess of [wall-86400000,wall,wall+86400000]){const p=fields(guess),offset=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))-guess,candidate=wall-offset,q=fields(candidate);if(`${q.year}-${q.month}-${q.day}T${q.hour}:${q.minute}`===date+'T'+time.slice(0,5))candidates.add(candidate);}
 return candidates.size===1?new Date([...candidates][0]+Number(days)*86400000).toISOString():null;
}
