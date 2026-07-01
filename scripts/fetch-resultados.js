/* Robô de resultados — roda no GitHub Actions (não no PC de ninguém).
   Filosofia: ser BURRO e robusto. Ele NÃO recalcula chaveamento nem tenta
   adivinhar quem joga contra quem. Só colhe da API todos os jogos do torneio
   (com o número da rodada) e grava em resultados.json. Quem monta a tabela e o
   mata-mata é o app, a partir dos confrontos REAIS — nunca de uma previsão.

   Fontes na chave grátis (todas verificadas):
   - eventsday: jogos por dia. Corta em 3/dia, mas casa por nome flexível
     ("USA", "Ivory Coast"...) e ensina a grafia oficial das seleções.
   - searchevents: um confronto específico, sem o corte de 3/dia. Usado só para
     completar os jogos de fase de grupos (confrontos fixos e conhecidos) que o
     eventsday cortou. */

const fs = require('fs');
const path = require('path');

const KEY = process.env.TSDB_KEY || '3';           // '3' = chave pública grátis
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;
const OUT = path.join(__dirname, '..', 'resultados.json');
const LEAGUE = '4429', SEASON = '2026';

/* seleções por grupo — só para completar jogos de grupo que o eventsday cortou */
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

/* ---------- helpers ---------- */
function chave(s){let x=(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  x=x.replace(/&/g,' ').replace(/\band\b/g,' ').replace(/[^a-z]/g,'');return SYN[x]||x;}
function temPlacar(e){return e&&e.intHomeScore!=null&&e.intHomeScore!==''&&e.intAwayScore!=null&&e.intAwayScore!=='';}
/* guarda só os campos usados. intRound = rodada (1-3 grupo; 32/16/8/4/2/1 mata-mata);
   ...Extra = placar dos pênaltis quando o jogo empata e vai à disputa. */
function enxuga(e){return {strHomeTeam:e.strHomeTeam,strAwayTeam:e.strAwayTeam,
  intHomeScore:e.intHomeScore,intAwayScore:e.intAwayScore,
  intHomeScoreExtra:e.intHomeScoreExtra,intAwayScoreExtra:e.intAwayScoreExtra,
  intRound:e.intRound,dateEvent:e.dateEvent};}
const delay = ms => new Promise(r => setTimeout(r, ms));
const parKey = e => [chave(e.strHomeTeam),chave(e.strAwayTeam)].sort().join('|');

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
/* datas do torneio: 11/06 a 19/07/2026 */
function datasTorneio(){
  const ini=new Date(Date.UTC(2026,5,11)), fim=new Date(Date.UTC(2026,6,19)), out=[];
  for(let d=new Date(ini); d<=fim; d.setUTCDate(d.getUTCDate()+1)) out.push(d.toISOString().slice(0,10));
  return out;
}
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
  // cache dos jogos já capturados antes (não rebusca) + saída anterior p/ comparar
  let prev = {events:[]};
  try{ prev = JSON.parse(fs.readFileSync(OUT,'utf8')); }catch{}
  const capturados = new Map();   // parKey -> evento
  (prev.events||[]).forEach(e=>{ aprendeCanon(e); capturados.set(parKey(e), e); });

  const serie = arr => JSON.stringify([...arr].sort((a,b)=>parKey(a).localeCompare(parKey(b))));
  const prevSerie = serie(prev.events||[]);
  const prevData = prev.atualizado;
  function flush(){
    const eventos=[...capturados.values()].sort((a,b)=>parKey(a).localeCompare(parKey(b)));
    const mudou=serie(eventos)!==prevSerie;
    const out={atualizado:(mudou||!prevData)?new Date().toISOString():prevData,
               total:eventos.length, events:eventos};
    fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  }

  // ----- passo 1: eventsday — colhe TODO jogo com placar (grupo E mata-mata) -----
  let novos=0;
  for(const day of datasTorneio()){
    const evs = await fetchDia(day);
    if(evs) for(const e of evs){
      aprendeCanon(e);
      const k=parKey(e);
      if(!capturados.has(k)) novos++;
      capturados.set(k, e);          // eventsday é a verdade; sobrescreve cache antigo
    }
    await delay(200);
  }
  flush();
  process.stderr.write(`eventsday: ${capturados.size} jogos (${novos} novos)\n`);

  // ----- passo 2: completa jogos de GRUPO que o eventsday cortou (3/dia) -----
  let buscas=0;
  for(const g of GROUPS){
    for(const p of PAIRS){
      const tA=g.teams[p[0]], tB=g.teams[p[1]];
      const k=[chave(EN[tA]||tA),chave(EN[tB]||tB)].sort().join('|');
      if(capturados.has(k)) continue;        // já veio do eventsday
      buscas++;
      const e=await buscaConfronto(tA,tB);
      if(e&&temPlacar(e)){ capturados.set(parKey(e), e); flush(); }
    }
    process.stderr.write(`grupo ${g.name} ok\n`);
  }

  flush();
  process.stderr.write(`\nFeito: ${capturados.size} jogos gravados (${buscas} buscas de grupo).\n`);
}

main().catch(e=>{console.error(e); process.exit(1);});
