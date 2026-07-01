/* Robô de resultados — roda no GitHub Actions (não no PC de ninguém).
   Busca os placares confronto a confronto (searchevents, o único endpoint da
   chave grátis que NÃO é cortado) e grava tudo em resultados.json. O app só lê
   esse arquivo pronto — assim nenhum celular chama a API direto e o limite de
   requisições (429) deixa de existir do lado do usuário.

   As constantes de chaveamento abaixo são um espelho das que estão no index.html.
   Se mudar o bracket lá, atualize aqui também. */

const fs = require('fs');
const path = require('path');

const KEY = process.env.TSDB_KEY || '3';           // '3' = chave pública grátis
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;
const OUT = path.join(__dirname, '..', 'resultados.json');
const LEAGUE = '4429', SEASON = '2026';

/* ---------- dados fixos (espelho do index.html) ---------- */
const GROUPS = [
  {name:'A',teams:['México','África do Sul','Coreia do Sul','República Tcheca']},
  {name:'B',teams:['Canadá','Bósnia e Herzegovina','Catar','Suíça']},
  {name:'C',teams:['Brasil','Marrocos','Haiti','Escócia']},
  {name:'D',teams:['Estados Unidos','Paraguai','Austrália','Turquia']},
  {name:'E',teams:['Alemanha','Curaçao','Costa do Marfim','Equador']},
  {name:'F',teams:['Holanda','Japão','Suécia','Tunísia']},
  {name:'G',teams:['Bélgica','Egito','Irã','Nova Zelândia']},
  {name:'H',teams:['Espanha','Cabo Verde','Arábia Saudita','Uruguai']},
  {name:'I',teams:['França','Senegal','Iraque','Noruega']},
  {name:'J',teams:['Argentina','Argélia','Áustria','Jordânia']},
  {name:'K',teams:['Portugal','RD Congo','Uzbequistão','Colômbia']},
  {name:'L',teams:['Inglaterra','Croácia','Gana','Panamá']},
];
const PAIRS = [[0,1],[2,3],[0,2],[3,1],[0,3],[1,2]];
const EN = {'México':'Mexico','África do Sul':'South Africa','Coreia do Sul':'South Korea','República Tcheca':'Czech Republic','Canadá':'Canada','Bósnia e Herzegovina':'Bosnia and Herzegovina','Catar':'Qatar','Suíça':'Switzerland','Brasil':'Brazil','Marrocos':'Morocco','Haiti':'Haiti','Escócia':'Scotland','Estados Unidos':'United States','Paraguai':'Paraguay','Austrália':'Australia','Turquia':'Turkey','Alemanha':'Germany','Curaçao':'Curacao','Costa do Marfim':'Ivory Coast','Equador':'Ecuador','Holanda':'Netherlands','Japão':'Japan','Suécia':'Sweden','Tunísia':'Tunisia','Bélgica':'Belgium','Egito':'Egypt','Irã':'Iran','Nova Zelândia':'New Zealand','Espanha':'Spain','Cabo Verde':'Cape Verde','Arábia Saudita':'Saudi Arabia','Uruguai':'Uruguay','França':'France','Senegal':'Senegal','Iraque':'Iraq','Noruega':'Norway','Argentina':'Argentina','Argélia':'Algeria','Áustria':'Austria','Jordânia':'Jordan','Portugal':'Portugal','RD Congo':'DR Congo','Uzbequistão':'Uzbekistan','Colômbia':'Colombia','Inglaterra':'England','Croácia':'Croatia','Gana':'Ghana','Panamá':'Panama'};
const SYN = {usa:'unitedstates',turkiye:'turkey',iriran:'iran',congodr:'drcongo',czechia:'czechrepublic',cotedivoire:'ivorycoast'};
const BRACKET = [
 {m:73,A:{t:'gr',g:'A'},B:{t:'gr',g:'B'}},{m:74,A:{t:'gw',g:'E'},B:{t:'g3',m:74}},
 {m:75,A:{t:'gw',g:'F'},B:{t:'gr',g:'C'}},{m:76,A:{t:'gw',g:'C'},B:{t:'gr',g:'F'}},
 {m:77,A:{t:'gw',g:'I'},B:{t:'g3',m:77}},{m:78,A:{t:'gr',g:'E'},B:{t:'gr',g:'I'}},
 {m:79,A:{t:'gw',g:'A'},B:{t:'g3',m:79}},{m:80,A:{t:'gw',g:'L'},B:{t:'g3',m:80}},
 {m:81,A:{t:'gw',g:'D'},B:{t:'g3',m:81}},{m:82,A:{t:'gw',g:'G'},B:{t:'g3',m:82}},
 {m:83,A:{t:'gr',g:'K'},B:{t:'gr',g:'L'}},{m:84,A:{t:'gw',g:'H'},B:{t:'gr',g:'J'}},
 {m:85,A:{t:'gw',g:'B'},B:{t:'g3',m:85}},{m:86,A:{t:'gw',g:'J'},B:{t:'gr',g:'H'}},
 {m:87,A:{t:'gw',g:'K'},B:{t:'g3',m:87}},{m:88,A:{t:'gr',g:'D'},B:{t:'gr',g:'G'}},
 {m:89,A:{t:'w',m:74},B:{t:'w',m:77}},{m:90,A:{t:'w',m:73},B:{t:'w',m:75}},
 {m:91,A:{t:'w',m:76},B:{t:'w',m:78}},{m:92,A:{t:'w',m:79},B:{t:'w',m:80}},
 {m:93,A:{t:'w',m:83},B:{t:'w',m:84}},{m:94,A:{t:'w',m:81},B:{t:'w',m:82}},
 {m:95,A:{t:'w',m:86},B:{t:'w',m:88}},{m:96,A:{t:'w',m:85},B:{t:'w',m:87}},
 {m:97,A:{t:'w',m:89},B:{t:'w',m:90}},{m:98,A:{t:'w',m:93},B:{t:'w',m:94}},
 {m:99,A:{t:'w',m:91},B:{t:'w',m:92}},{m:100,A:{t:'w',m:95},B:{t:'w',m:96}},
 {m:101,A:{t:'w',m:97},B:{t:'w',m:98}},{m:102,A:{t:'w',m:99},B:{t:'w',m:100}},
 {m:103,A:{t:'l',m:101},B:{t:'l',m:102}},{m:104,A:{t:'w',m:101},B:{t:'w',m:102}},
];
const BM = {}; BRACKET.forEach(b => BM[b.m] = b);
const THIRD_SLOTS = [[74,['A','B','C','D','F']],[77,['C','D','F','G','H']],[79,['C','E','F','H','I']],
  [80,['E','H','I','J','K']],[81,['B','E','F','I','J']],[82,['A','E','H','I','J']],
  [85,['E','F','G','I','J']],[87,['D','E','I','J','L']]];

/* ---------- helpers (espelho do index.html) ---------- */
function chave(s){let x=(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  x=x.replace(/&/g,' ').replace(/\band\b/g,' ').replace(/[^a-z]/g,'');return SYN[x]||x;}
function temPlacar(e){return e&&e.intHomeScore!=null&&e.intHomeScore!==''&&e.intAwayScore!=null&&e.intAwayScore!=='';}
function enxuga(e){return {strHomeTeam:e.strHomeTeam,strAwayTeam:e.strAwayTeam,
  intHomeScore:e.intHomeScore,intAwayScore:e.intAwayScore,
  intHomeScoreExtra:e.intHomeScoreExtra,intAwayScoreExtra:e.intAwayScoreExtra,dateEvent:e.dateEvent};}

/* estado do torneio, montado a partir dos placares encontrados */
let DATA = GROUPS.map(g => ({name:g.name, teams:[...g.teams], scores:PAIRS.map(()=>({h:null,a:null}))}));
let KO = {}, TER = null;
function grupoCompleto(g){return g.scores.every(s=>s.h!=null&&s.a!=null);}
function tabela(g){
  const T=g.teams.map((name,i)=>({i,name,V:0,E:0,D:0,GP:0,GC:0}));
  g.scores.forEach((s,m)=>{if(s.h==null||s.a==null)return;
    const[hi,ai]=PAIRS[m],H=T[hi],A=T[ai];
    H.GP+=s.h;H.GC+=s.a;A.GP+=s.a;A.GC+=s.h;
    if(s.h>s.a){H.V++;A.D++;}else if(s.h<s.a){A.V++;H.D++;}else{H.E++;A.E++;}});
  T.forEach(t=>{t.J=t.V+t.E+t.D;t.Pts=t.V*3+t.E;t.SG=t.GP-t.GC;});
  T.sort((a,b)=>b.Pts-a.Pts||b.SG-a.SG||b.GP-a.GP||a.name.localeCompare(b.name));
  return T;
}
function ranking3os(){
  if(!DATA.every(grupoCompleto))return null;
  const ter=DATA.map(g=>{const t=tabela(g)[2];return{g:g.name,name:t.name,Pts:t.Pts,SG:t.SG,GP:t.GP};});
  ter.sort((a,b)=>b.Pts-a.Pts||b.SG-a.SG||b.GP-a.GP||a.g.localeCompare(b.g));
  const top=ter.slice(0,8),qG=top.map(o=>o.g),used=new Set(),res={};
  (function bt(i){if(i===THIRD_SLOTS.length)return true;const[m,el]=THIRD_SLOTS[i];
    for(const grp of qG){if(used.has(grp)||!el.includes(grp))continue;
      used.add(grp);res[m]=grp;if(bt(i+1))return true;used.delete(grp);delete res[m];}
    return false;})(0);
  const byG={};top.forEach(o=>byG[o.g]=o.name);return{assign:res,byG};
}
function resolve(src){
  if(src.t==='gw'){const g=DATA.find(x=>x.name===src.g);return grupoCompleto(g)?tabela(g)[0].name:null;}
  if(src.t==='gr'){const g=DATA.find(x=>x.name===src.g);return grupoCompleto(g)?tabela(g)[1].name:null;}
  if(src.t==='g3'){if(!TER)return null;const grp=TER.assign[src.m];return grp?TER.byG[grp]:null;}
  if(src.t==='w')return venc(src.m);
  if(src.t==='l')return perd(src.m);
  return null;
}
function venc(m){const k=KO[m];if(!k||k.h==null||k.a==null)return null;
  if(k.h>k.a)return resolve(BM[m].A);if(k.a>k.h)return resolve(BM[m].B);
  if(k.ph!=null&&k.pa!=null&&k.ph!==k.pa)return k.ph>k.pa?resolve(BM[m].A):resolve(BM[m].B);return null;}
function perd(m){const k=KO[m];if(!k||k.h==null||k.a==null)return null;
  if(k.h>k.a)return resolve(BM[m].B);if(k.a>k.h)return resolve(BM[m].A);
  if(k.ph!=null&&k.pa!=null&&k.ph!==k.pa)return k.ph>k.pa?resolve(BM[m].B):resolve(BM[m].A);return null;}
function preencheKO(m,e,ka){
  const homeIsA=chave(e.strHomeTeam)===ka, hs=+e.intHomeScore, as=+e.intAwayScore;
  if(!KO[m])KO[m]={};
  KO[m].h=homeIsA?hs:as; KO[m].a=homeIsA?as:hs;
  const phs=e.intHomeScoreExtra, pas=e.intAwayScoreExtra;
  if(hs===as && phs!=null && phs!=='' && pas!=null && pas!=='' && +phs!==+pas){
    KO[m].ph=homeIsA?+phs:+pas; KO[m].pa=homeIsA?+pas:+phs;
  }
}

/* ---------- rede ---------- */
const delay = ms => new Promise(r => setTimeout(r, ms));
let CANON = {};
function aprendeCanon(e){CANON[chave(e.strHomeTeam)]=e.strHomeTeam;CANON[chave(e.strAwayTeam)]=e.strAwayTeam;}
function nomeAPI(t){return CANON[chave(EN[t]||t)]||EN[t]||t;}

async function fetchJSON(url){
  for(let tent=0; tent<4; tent++){
    try{
      const r = await fetch(url);
      if(r.status===429){await delay(2500*(tent+1)); continue;}  // limite ativo: espera mais
      if(!r.ok) return null;
      return await r.json();
    }catch{ await delay(1500*(tent+1)); }
  }
  return null;
}
/* datas do torneio: 11/06 a 19/07/2026 (todas as rodadas cabem nessa janela) */
function datasTorneio(){
  const ini=new Date(Date.UTC(2026,5,11)), fim=new Date(Date.UTC(2026,6,19)), out=[];
  for(let d=new Date(ini); d<=fim; d.setUTCDate(d.getUTCDate()+1)){
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}
/* eventsday: jogos de um dia. Corta em 3/dia no plano grátis, MAS casa por nome
   flexível (tolera "USA", "Ivory Coast"...) e ensina a grafia oficial das seleções. */
async function fetchDia(day){
  const j = await fetchJSON(`${BASE}/eventsday.php?d=${day}&l=${LEAGUE}`);
  if(j===null) return null;
  return Array.isArray(j.events) ? j.events.filter(temPlacar).map(enxuga) : [];
}
/* procura um jogo específico entre duas seleções (tenta as duas ordens) */
async function buscaConfronto(tA,tB){
  const kA=chave(EN[tA]||tA), kB=chave(EN[tB]||tB);
  const a=nomeAPI(tA).replace(/ /g,'_'), b=nomeAPI(tB).replace(/ /g,'_');
  for(const q of [a+'_vs_'+b, b+'_vs_'+a]){
    const j = await fetchJSON(`${BASE}/searchevents.php?e=${encodeURIComponent(q)}`);
    await delay(400);
    if(j===null) continue;
    for(const e of (j.event||[])){
      if(e.idLeague!==LEAGUE||e.strSeason!==SEASON||!temPlacar(e))continue;
      const s=[chave(e.strHomeTeam),chave(e.strAwayTeam)];
      if(s.includes(kA)&&s.includes(kB)){aprendeCanon(e);return enxuga(e);}
    }
  }
  return null;
}

/* ---------- programa ---------- */
async function main(){
  // cache: jogos já encontrados em execuções anteriores (não rebusca placar final)
  const cache = new Map();   // chaveConfronto -> evento
  let prev = {events:[]};
  try{ prev = JSON.parse(fs.readFileSync(OUT,'utf8')); }catch{}
  (prev.events||[]).forEach(e=>{
    aprendeCanon(e);
    const k=[chave(e.strHomeTeam),chave(e.strAwayTeam)].sort().join('|');
    cache.set(k, e);
  });

  const eventsOut = [];
  const vistos = new Set();
  function registra(e){
    const k=[chave(e.strHomeTeam),chave(e.strAwayTeam)].sort().join('|');
    if(vistos.has(k))return; vistos.add(k); eventsOut.push(e);
  }
  // grava o estado atual em disco (checkpoint) — assim, se o job for cortado por
  // timeout, o que já foi buscado não se perde e vira cache do próximo ciclo.
  function flush(){
    const out={atualizado:new Date().toISOString(), total:eventsOut.length, events:eventsOut};
    fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  }
  // ----- passo 1: eventsday (por data) — casa por nome flexível e ensina a
  //        grafia oficial das seleções, que o searchevents do passo 2 vai usar.
  const evIndex = new Map();   // chavePar -> evento vindo do eventsday
  for(const day of datasTorneio()){
    const evs = await fetchDia(day);
    if(evs) for(const e of evs){
      aprendeCanon(e);
      evIndex.set([chave(e.strHomeTeam),chave(e.strAwayTeam)].sort().join('|'), e);
    }
    await delay(200);
  }
  process.stderr.write(`eventsday: ${evIndex.size} jogos indexados\n`);

  // busca com cache: eventsday primeiro (nome flexível), depois searchevents
  async function obtem(tA,tB){
    const k=[chave(EN[tA]||tA),chave(EN[tB]||tB)].sort().join('|');
    if(cache.has(k))return cache.get(k);
    if(evIndex.has(k)){const e=evIndex.get(k); cache.set(k,e); return e;}  // veio do eventsday
    const e=await buscaConfronto(tA,tB);
    if(e){cache.set(k,e);}
    return e;
  }

  let achados=0, buscas=0;
  // ----- fase de grupos (confrontos fixos e conhecidos) -----
  for(let gi=0; gi<DATA.length; gi++){
    for(let mi=0; mi<PAIRS.length; mi++){
      const tA=GROUPS[gi].teams[PAIRS[mi][0]], tB=GROUPS[gi].teams[PAIRS[mi][1]];
      buscas++;
      const e=await obtem(tA,tB);
      if(e&&temPlacar(e)){
        const homeIsA=chave(e.strHomeTeam)===chave(EN[tA]||tA);
        DATA[gi].scores[mi]={h:homeIsA?+e.intHomeScore:+e.intAwayScore,
                             a:homeIsA?+e.intAwayScore:+e.intHomeScore};
        registra(e); achados++;
      }
    }
    flush();   // checkpoint a cada grupo
    process.stderr.write(`grupo ${GROUPS[gi].name} ok (${achados} jogos)\n`);
  }

  // ----- mata-mata (confrontos resolvidos a partir dos resultados) -----
  TER = ranking3os();
  for(const b of BRACKET){
    const ta=resolve(b.A), tb=resolve(b.B);
    if(!ta||!tb)continue;                       // ainda não dá pra saber quem joga
    buscas++;
    const e=await obtem(ta,tb);
    if(e&&temPlacar(e)){
      preencheKO(b.m, e, chave(EN[ta]||ta));
      registra(e); achados++; flush();          // checkpoint a cada jogo de mata-mata
    }
  }

  flush();
  process.stderr.write(`\nFeito: ${achados} jogos com placar, ${buscas} confrontos avaliados, ${eventsOut.length} gravados.\n`);
}

main().catch(e=>{console.error(e); process.exit(1);});
