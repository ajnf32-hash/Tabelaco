/* Escudos dos clubes que a fonte principal nao devolve.
 *
 * A ESPN traz o escudo dos clubes grandes e deixa em branco o dos pequenos. Na
 * Copa do Brasil isso e a maioria: 67 dos 218 times ficavam sem escudo nenhum na
 * tela, e o Annibal reclamou com razao, escudo de clube existe sempre.
 *
 * Este script procura cada um desses clubes no Fotmob, confere se o nome bate de
 * verdade, testa se a imagem responde, e grava o resultado em dados/escudos.json.
 * O app le esse arquivo como ultima carta antes de desistir e nao mostrar nada.
 *
 * Roda sozinho:  node scripts/buscar-escudos.mjs
 * E de proposito que ele NAO baixa imagem nenhuma: o app aponta para o endereco,
 * igual ja faz com os escudos que vem da ESPN. Assim nao hospedamos escudo de
 * ninguem e o desenho continua sendo o do dono.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = path.join(RAIZ, 'dados');
const SAIDA = path.join(DADOS, 'escudos.json');
const LOGO = id => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;

const dorme = ms => new Promise(r => setTimeout(r, ms));

/* mesma normalizacao do app: sem acento, sem pontuacao, minusculo */
function normaliza(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* palavras que nao ajudam a identificar clube nenhum */
const RUIDO = new Set(['fc','ec','sc','ac','cr','se','ca','af','ad','esporte','esportivo',
  'clube','club','futebol','football','regatas','associacao','sociedade','de','do','da',
  'dos','das','e','u20','sub20']);

function fichas(nome) {
  const t = normaliza(nome).split(' ').filter(x => x && !RUIDO.has(x));
  return t.length ? t : normaliza(nome).split(' ').filter(Boolean);
}

/* quanto dois nomes se parecem, de 0 a 1 */
function parecenca(a, b) {
  const A = fichas(a), B = fichas(b);
  if (!A.length || !B.length) return 0;
  let acertos = 0;
  for (const x of A) {
    if (B.some(y => y === x || (x.length >= 4 && y.length >= 4 && (y.startsWith(x) || x.startsWith(y))))) acertos++;
  }
  return acertos / Math.max(A.length, B.length);
}

/* ---------------------------------------------------- quem esta sem escudo */

function timesSemEscudo() {
  const tem = new Map();          // nome -> tem escudo?
  for (const f of fs.readdirSync(DADOS)) {
    if (!f.endsWith('.json') || f === 'escudos.json') continue;
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DADOS, f), 'utf8')); } catch { continue; }
    for (const t of (d.classificacao || [])) {
      if (!t.time) continue;
      tem.set(t.time, tem.get(t.time) || !!t.escudo);
    }
    for (const j of (d.jogos || [])) {
      if (j.mandante) tem.set(j.mandante, tem.get(j.mandante) || !!j.escudoMandante);
      if (j.visitante) tem.set(j.visitante, tem.get(j.visitante) || !!j.escudoVisitante);
    }
  }
  return [...tem].filter(([, ok]) => !ok).map(([nome]) => nome).sort();
}

/* ---------------------------------------------------------------- fotmob */

/* Siglas de estado. Elas existem justamente para separar dois clubes de mesmo
   nome: "Vasco da Gama AC" e do Acre e nao tem nada a ver com o do Rio. Se o nosso
   nome traz a sigla e a resposta nao traz, a resposta e de outro clube. */
const ESTADOS = new Set(['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt',
  'pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to']);

function estadoDoNome(nome) {
  const t = normaliza(nome).split(' ');
  const fim = t[t.length - 1];
  return ESTADOS.has(fim) ? fim : null;
}

/* A busca do Fotmob nao encontra nada com o nome completo de clube pequeno:
   "Sociedade Imperatriz de Desportos" da zero, "Imperatriz" acha. Entao, se o nome
   inteiro nao achar, tenta de novo com o nome enxuto. */
function versaoEnxuta(nome) {
  const t = fichas(nome).filter(x => !ESTADOS.has(x));
  return t.join(' ');
}

async function consultar(termo) {
  const u = 'https://apigw.fotmob.com/searchapi/suggest?term=' +
            encodeURIComponent(termo) + '&lang=pt';
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    return await r.json();
  } catch { return null; }
}

async function procurarNoFotmob(nome) {
  let j = await consultar(nome);
  let opcoes = (j?.teamSuggest || []).flatMap(s => s.options || []);
  if (!opcoes.length) {
    const enxuto = versaoEnxuta(nome);
    if (enxuto && enxuto !== normaliza(nome)) {
      await dorme(350);
      j = await consultar(enxuto);
      opcoes = (j?.teamSuggest || []).flatMap(s => s.options || []);
    }
  }

  let melhor = null, melhorNota = 0;
  for (const o of opcoes) {
    /* o texto vem como "Retrô|1116984" */
    const [texto, id] = String(o.text || '').split('|');
    if (!id) continue;
    const nota = parecenca(nome, texto);
    if (nota > melhorNota) { melhorNota = nota; melhor = { id, texto, nota }; }
  }
  /* Regra do Annibal para o Tabelaco: na duvida, nao mostra. Escudo errado no
     lugar do certo e pior do que escudo nenhum, porque o torcedor acredita. */
  if (!melhor || melhor.nota < 0.6) return null;
  /* guarda do estado: com sigla do nosso lado e sem sigla do outro, e outro clube */
  const uf = estadoDoNome(nome);
  if (uf && !normaliza(melhor.texto).split(' ').includes(uf)) return null;
  return melhor;
}

async function imagemResponde(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(12000) });
    return r.ok;
  } catch { return false; }
}

/* -------------------------------------------------------------------- rodar */

const jaTinha = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : {};
const faltando = timesSemEscudo();
console.log(`times sem escudo: ${faltando.length}`);

const achados = { ...jaTinha };
let novos = 0, semSorte = [];

for (const nome of faltando) {
  if (achados[nome]) continue;                      // ja resolvido numa rodada anterior
  const r = await procurarNoFotmob(nome);
  await dorme(400);                                 // educacao com o servidor alheio
  if (!r) { semSorte.push(nome); continue; }
  const url = LOGO(r.id);
  if (!(await imagemResponde(url))) { semSorte.push(nome); continue; }
  achados[nome] = url;
  novos++;
  console.log(`  ok   ${nome}  ->  ${r.texto}  (parecenca ${r.nota.toFixed(2)})`);
  await dorme(200);
}

const ordenado = Object.fromEntries(Object.entries(achados).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
fs.writeFileSync(SAIDA, JSON.stringify(ordenado, null, 1) + '\n');

console.log(`\nencontrados agora: ${novos}`);
console.log(`no arquivo, ao todo: ${Object.keys(ordenado).length}`);
if (semSorte.length) {
  console.log(`\nsem escudo ainda (${semSorte.length}):`);
  for (const n of semSorte) console.log('   ' + n);
}
