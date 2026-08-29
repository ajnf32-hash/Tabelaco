/* Robô de resultados do Tabelaço — roda no GitHub Actions (não no PC de ninguém).
 *
 * Filosofia herdada do robô da Copa: ser BURRO e robusto. Ele não adivinha
 * chaveamento nem inventa confronto. Só colhe o que as fontes publicam e grava.
 *
 * O que mudou: agora são DUAS fontes independentes, e um placar só é publicado
 * como confirmado quando as duas dizem a mesma coisa.
 *
 *   ESPN    — uma consulta por campeonato. Traz jogos, rodada e classificação.
 *   Fotmob  — uma consulta por DIA, e essa única consulta já traz todos os
 *             campeonatos daquele dia. Serve de conferente.
 *
 * Regra de publicação de cada jogo:
 *   confirmado  → as duas fontes deram o mesmo placar. Pode mostrar.
 *   sozinho     → só uma fonte tem o jogo. Mostra, mas marcado como preliminar.
 *   divergente  → as duas discordam. NÃO mostra placar; entra na lista de avisos.
 *
 * Nenhuma das duas fontes cobra nada nem exige cadastro.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CATALOGO = path.join(RAIZ, 'dados', 'campeonatos.json');
const SAIDA = path.join(RAIZ, 'dados');

/* Quantos dias para trás o robô reconfere a cada rodada. 8 dias cobre uma
   rodada inteira com folga e ainda pega placar que a fonte corrigiu depois. */
const DIAS_ATRAS = 8;
/* Quantos dias à frente ele busca, para saber onde e que horas é o próximo jogo. */
const DIAS_FRENTE = 10;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Tabelaco/1.0';

/* ---------------------------------------------------------------- utilidades */

const dorme = ms => new Promise(r => setTimeout(r, ms));

async function pegaJSON(url, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === tentativas) { console.warn(`   ! falhou ${url} — ${e.message}`); return null; }
      await dorme(600 * i);
    }
  }
}

const iso = d => d.toISOString().slice(0, 10);
const compacta = d => iso(d).replace(/-/g, '');

function janelaDeDatas() {
  const hoje = new Date();
  const dias = [];
  for (let i = -DIAS_ATRAS; i <= DIAS_FRENTE; i++) {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() + i);
    dias.push(d);
  }
  return dias;
}

/* ------------------------------------------------- casamento de nomes de time */

/* As duas fontes escrevem o mesmo time de jeitos diferentes:
   "Atlético-MG" / "Atletico MG"   ·   "Botafogo" / "Botafogo RJ"
   "São Paulo" / "Sao Paulo"       ·   "Athletico Paranaense" / "Athletico PR"
   Em vez de manter uma lista infinita de sinônimos, o robô compara os jogos
   como PAR (mandante + visitante). Dois times errados ao mesmo tempo no mesmo
   dia é praticamente impossível, então o par desempata sozinho. */

const RUIDO = new Set([
  'fc', 'ec', 'sc', 'ac', 'cr', 'se', 'ca', 'af', 'ad', 'esporte', 'esportivo',
  'clube', 'club', 'futebol', 'football', 'regatas', 'atletico', 'atlhetico',
  'associacao', 'sociedade', 'de', 'do', 'da', 'dos', 'das', 'e'
]);

function normaliza(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acento
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')                       // tira hífen, ponto etc
    .replace(/\s+/g, ' ')
    .trim();
}

function fichas(nome) {
  const t = normaliza(nome).split(' ').filter(x => x && !RUIDO.has(x));
  return t.length ? t : normaliza(nome).split(' ').filter(Boolean);
}

/* quanto dois nomes de time se parecem, de 0 a 1 */
function parecenca(a, b) {
  const A = fichas(a), B = fichas(b);
  if (!A.length || !B.length) return 0;
  let acertos = 0;
  for (const x of A) {
    if (B.some(y => y === x || (x.length >= 4 && y.length >= 4 && (y.startsWith(x) || x.startsWith(y))))) acertos++;
  }
  return acertos / Math.max(A.length, B.length);
}

/* ------------------------------------------------------------- fonte 1: ESPN */

/* Atenção: os dois endereços abaixo são DIFERENTES de propósito. Jogos saem em
   /apis/site/v2 e classificação em /apis/v2. Os dois respondem 200 nos dois
   caminhos, mas o caminho errado devolve um objeto vazio em vez de erro — foi
   assim que a tabela veio zerada na primeira tentativa. */
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_TABELA = 'https://site.api.espn.com/apis/v2/sports/soccer';

async function jogosESPN(slug, de, ate) {
  const j = await pegaJSON(`${ESPN}/${slug}/scoreboard?dates=${compacta(de)}-${compacta(ate)}&limit=500`);
  if (!j || !j.events) return [];
  return j.events.map(e => {
    const c = e.competitions[0];
    const mand = c.competitors.find(x => x.homeAway === 'home') || c.competitors[0];
    const vis = c.competitors.find(x => x.homeAway === 'away') || c.competitors[1];
    const acabou = !!e.status?.type?.completed;
    return {
      data: e.date.slice(0, 10),
      hora: e.date.slice(11, 16),
      rodada: c.notes?.[0]?.headline || (e.week?.number ? `Rodada ${e.week.number}` : ''),
      local: c.venue?.fullName || '',
      cidade: c.venue?.address?.city || '',
      mandante: mand?.team?.displayName || '',
      visitante: vis?.team?.displayName || '',
      escudoMandante: mand?.team?.logo || '',
      escudoVisitante: vis?.team?.logo || '',
      golsMandante: acabou ? Number(mand?.score ?? 0) : null,
      golsVisitante: acabou ? Number(vis?.score ?? 0) : null,
      encerrado: acabou,
      situacao: e.status?.type?.description || ''
    };
  });
}

async function classificacaoESPN(slug, temporada) {
  const j = await pegaJSON(`${ESPN_TABELA}/${slug}/standings?season=${temporada}`);
  if (!j) return [];
  /* Pontos corridos vêm num grupo só; grupos da Libertadores/Champions vêm em
     vários. Achatamos tudo, guardando de que grupo cada time veio. */
  const grupos = j.children?.length ? j.children : [j];
  const linhas = [];
  for (const g of grupos) {
    const entradas = g.standings?.entries || [];
    for (const e of entradas) {
      const st = Object.fromEntries((e.stats || []).map(x => [x.name, x.value ?? x.displayValue]));
      linhas.push({
        grupo: grupos.length > 1 ? (g.name || '').replace(/^Group /, 'Grupo ') : '',
        time: e.team?.displayName || '',
        escudo: e.team?.logos?.[0]?.href || '',
        pontos: Number(st.points ?? 0),
        jogos: Number(st.gamesPlayed ?? 0),
        vitorias: Number(st.wins ?? 0),
        empates: Number(st.ties ?? 0),
        derrotas: Number(st.losses ?? 0),
        golsPro: Number(st.pointsFor ?? 0),
        golsContra: Number(st.pointsAgainst ?? 0),
        saldo: Number(st.pointDifferential ?? 0)
      });
    }
  }
  /* ordena como tabela de futebol: pontos, vitórias, saldo, gols pró */
  linhas.sort((a, b) =>
    b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro
  );
  return linhas.map((l, i) => ({ posicao: i + 1, ...l }));
}

/* Busca a temporada inteira, mês a mês. Sem isso, campeonato fora de época
   (estadual em agosto, Champions em julho) fica com a tela vazia — e o Annibal
   ainda quer poder olhar a tabela final do Carioca em novembro.

   Campeonato que vira o ano (Champions: setembro a maio) tem os meses do fim do
   ano na temporada anterior. Detectamos isso pela lista de meses "dar a volta". */
/* Em que temporada o campeonato esta HOJE.

   Campeonato que vira o ano nao acompanha o calendario: em agosto de 2026 o
   Ingles ja comecou a temporada 2026/27, enquanto a Champions, que so abre em
   setembro, ainda esta na de 2025/26. Sem isto o robo mostrava a tabela final
   da temporada passada como se fosse a atual.

   O rotulo segue a convencao do resto do arquivo: o ano em que a temporada
   TERMINA. Quem fala com a ESPN converte na hora de pedir. */
function mesDeAbertura(meses) {
  const s = new Set(meses);
  for (const m of meses) if (!s.has(m === 1 ? 12 : m - 1)) return m;
  return meses[0];
}

function temporadaCorrente(c, padrao) {
  const meses = c.meses || [];
  if (!(meses.includes(12) && meses.includes(1))) return padrao;
  const hoje = new Date();
  const abre = mesDeAbertura(meses);
  const ano = hoje.getUTCFullYear();
  return (hoje.getUTCMonth() + 1 >= abre) ? ano + 1 : ano;
}

async function jogosDaTemporada(c, temporada) {
  const meses = c.meses || [];
  const viraOAno = meses.includes(12) && meses.includes(1);
  const jogos = [];
  for (const m of meses) {
    const ano = (viraOAno && m >= 7) ? temporada - 1 : temporada;
    const ini = new Date(Date.UTC(ano, m - 1, 1));
    const fim = new Date(Date.UTC(ano, m, 0));      // dia 0 do mês seguinte = último dia deste
    if (ini > new Date()) continue;                 // mês que ainda nem começou
    jogos.push(...await jogosESPN(c.espn, ini, fim));
    await dorme(150);
  }
  return jogos;
}

/* ------------------------------------------------------- grafia dos nomes

   As fontes escrevem nome de clube sem acento. Na tela isso aparece como
   "Sampaio Correa" e "Atletico Alagoinhas", que estão simplesmente errados em
   português, e o Annibal, que tem dislexia, pediu para eu avisar e corrigir
   sempre que algo saia escrito errado.

   Corrigir na mão nos arquivos de dados não adianta: este robô roda de meia em
   meia hora e sobrescreve tudo. Por isso a correção mora AQUI, e é aplicada toda
   vez que um nome entra.

   Só entram nesta lista casos em que a fonte erra a grafia do MESMO clube. Clube
   diferente com nome parecido não é assunto daqui. */
const GRAFIA = {
  'sampaio correa rj': 'Sampaio Corrêa RJ',
  'sampaio correa':    'Sampaio Corrêa',
  'atletico alagoinhas': 'Atlético Alagoinhas',
};

function grafia(nome) {
  if (!nome) return nome;
  const certo = GRAFIA[normaliza(nome)];
  return certo || nome;
}

/* Passa a correção em tudo que leva nome de clube dentro de um campeonato. */
function corrigeGrafia(arquivo) {
  for (const j of (arquivo.jogos || [])) {
    j.mandante  = grafia(j.mandante);
    j.visitante = grafia(j.visitante);
  }
  for (const t of (arquivo.classificacao || [])) {
    t.time = grafia(t.time);
  }
  return arquivo;
}

/* junta duas listas de jogos sem repetir; a segunda lista tem prioridade
   (é a janela recente, mais fresca que o histórico) */
function juntaJogos(historico, recentes) {
  const chave = j => `${j.data}|${normaliza(j.mandante)}|${normaliza(j.visitante)}`;
  const mapa = new Map();
  for (const j of historico) mapa.set(chave(j), j);
  for (const j of recentes) mapa.set(chave(j), j);
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
}

/* Quando a fonte não tem a tabela da temporada corrente, o robô monta a tabela
   ele mesmo, somando os jogos que já aconteceram. Isso é sempre preferível a
   mostrar a tabela do ano passado: a tabela calculada bate com os jogos que
   estão logo abaixo dela na tela, a do ano passado não bate com nada.
   Vale 3 pontos por vitória, 1 por empate — regra de todos os campeonatos
   que este app cobre. */
function calculaTabela(jogos) {
  const times = new Map();
  const pega = nome => {
    if (!times.has(nome)) times.set(nome, {
      grupo: '', time: nome, escudo: '', pontos: 0, jogos: 0,
      vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0
    });
    return times.get(nome);
  };

  for (const j of jogos) {
    if (!j.encerrado || j.golsMandante === null || j.golsVisitante === null) continue;
    const m = pega(j.mandante), v = pega(j.visitante);
    if (!m.escudo) m.escudo = j.escudoMandante || '';
    if (!v.escudo) v.escudo = j.escudoVisitante || '';
    m.jogos++; v.jogos++;
    m.golsPro += j.golsMandante; m.golsContra += j.golsVisitante;
    v.golsPro += j.golsVisitante; v.golsContra += j.golsMandante;
    if (j.golsMandante > j.golsVisitante) { m.vitorias++; m.pontos += 3; v.derrotas++; }
    else if (j.golsMandante < j.golsVisitante) { v.vitorias++; v.pontos += 3; m.derrotas++; }
    else { m.empates++; v.empates++; m.pontos++; v.pontos++; }
  }

  const linhas = [...times.values()];
  for (const l of linhas) l.saldo = l.golsPro - l.golsContra;
  linhas.sort((a, b) =>
    b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro
  );
  return linhas.map((l, i) => ({ posicao: i + 1, ...l }));
}

/* De que temporada são, de fato, os jogos que baixamos? É essa a tabela que
   pode aparecer junto deles — e nenhuma outra. Campeonato que vira o ano é
   nomeado pelo ano de início (a Champions 2025/26 é "2025" na fonte). */
function temporadaDosJogos(c, jogos, padrao) {
  if (!jogos.length) return padrao;
  const anos = jogos.map(j => Number(j.data.slice(0, 4)));
  const viraOAno = (c.meses || []).includes(12) && (c.meses || []).includes(1);
  if (viraOAno) return Math.min(...anos);
  const contagem = {};
  for (const a of anos) contagem[a] = (contagem[a] || 0) + 1;
  return Number(Object.entries(contagem).sort((x, y) => y[1] - x[1])[0][0]);
}

/* ----------------------------------------------------------- fonte 2: Fotmob */

/* Uma consulta por dia devolve TODOS os campeonatos daquele dia. Guardamos em
   cache para não pedir o mesmo dia uma vez por campeonato. */
const cacheFotmob = new Map();

async function fotmobDoDia(d) {
  const chave = compacta(d);
  if (cacheFotmob.has(chave)) return cacheFotmob.get(chave);
  const j = await pegaJSON(`https://www.fotmob.com/api/data/matches?date=${chave}`);
  const jogos = [];
  for (const liga of (j?.leagues || [])) {
    for (const m of (liga.matches || [])) {
      const placar = /(\d+)\s*-\s*(\d+)/.exec(m.status?.scoreStr || '');
      jogos.push({
        data: iso(d),
        liga: liga.name || '',
        pais: liga.ccode || '',
        mandante: m.home?.name || '',
        visitante: m.away?.name || '',
        golsMandante: placar ? Number(placar[1]) : null,
        golsVisitante: placar ? Number(placar[2]) : null,
        encerrado: !!m.status?.finished
      });
    }
  }
  cacheFotmob.set(chave, jogos);
  await dorme(250);            // educação com o servidor alheio
  return jogos;
}

/* acha, entre os jogos do Fotmob daquele dia, o que corresponde ao jogo da ESPN */
function acharPar(jogoESPN, candidatos) {
  let melhor = null, melhorNota = 0;
  for (const c of candidatos) {
    const nm = parecenca(jogoESPN.mandante, c.mandante);
    const nv = parecenca(jogoESPN.visitante, c.visitante);
    if (nm < 0.5 || nv < 0.5) continue;      // os DOIS times têm que bater
    const nota = nm + nv;
    if (nota > melhorNota) { melhorNota = nota; melhor = c; }
  }
  return melhor;
}

/* ------------------------------------------------------------------ conferir */

async function conferir(jogos) {
  const avisos = [];
  /* agrupa por dia para consultar o Fotmob uma vez por dia */
  const porDia = new Map();
  for (const j of jogos) {
    if (!porDia.has(j.data)) porDia.set(j.data, []);
    porDia.get(j.data).push(j);
  }

  for (const [dia, doDia] of porDia) {
    const outros = await fotmobDoDia(new Date(dia + 'T12:00:00Z'));
    for (const j of doDia) {
      const par = acharPar(j, outros);

      if (!par) { j.conferencia = 'sozinho'; j.fontes = ['espn']; continue; }
      j.fontes = ['espn', 'fotmob'];

      /* jogo ainda não aconteceu: nada a conferir além de existir nas duas */
      if (!j.encerrado && !par.encerrado) { j.conferencia = 'confirmado'; continue; }

      /* uma acha que acabou e a outra não — normal nos minutos após o apito */
      if (j.encerrado !== par.encerrado) { j.conferencia = 'sozinho'; continue; }

      if (j.golsMandante === par.golsMandante && j.golsVisitante === par.golsVisitante) {
        j.conferencia = 'confirmado';
      } else {
        j.conferencia = 'divergente';
        avisos.push({
          jogo: `${j.mandante} x ${j.visitante}`,
          data: j.data,
          espn: `${j.golsMandante}-${j.golsVisitante}`,
          fotmob: `${par.golsMandante}-${par.golsVisitante}`
        });
        /* segura o placar: melhor não mostrar do que mostrar errado */
        j.golsMandante = null;
        j.golsVisitante = null;
      }
    }
  }
  return avisos;
}

/* ---------------------------------------------------------------------- main */

async function main() {
  const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const dias = janelaDeDatas();
  const de = dias[0], ate = dias[dias.length - 1];
  fs.mkdirSync(SAIDA, { recursive: true });

  const resumo = [];

  for (const c of cat.campeonatos) {
    process.stdout.write(`\n${c.nome.padEnd(24)} `);

    /* histórico da temporada + janela recente, sem repetir jogo */
    const temporadaC = temporadaCorrente(c, cat.temporada);
    const historico = await jogosDaTemporada(c, temporadaC);
    const recentes = await jogosESPN(c.espn, de, ate);
    const jogos = juntaJogos(historico, recentes);

    /* A conferência com a segunda fonte roda só na janela recente. Reconferir
       meses de jogos antigos a cada 15 minutos seria desperdício: resultado de
       março não muda mais. */
    const limiteJanela = iso(de);
    const aConferir = jogos.filter(j => j.data >= limiteJanela);
    const avisos = await conferir(aConferir);
    for (const j of jogos) {
      if (!j.conferencia) { j.conferencia = 'historico'; j.fontes = ['espn']; }
    }

    /* A tabela tem que ser da MESMA temporada dos jogos que estão na tela.
       Nunca cair para o ano anterior às escondidas. */
    const temporadaTabela = temporadaDosJogos(c, jogos, temporadaC);
    let tabela = await classificacaoESPN(c.espn, temporadaTabela);
    let origemTabela = tabela.length ? 'fonte' : 'nenhuma';

    if (!tabela.length && c.formato !== 'mata-mata') {
      tabela = calculaTabela(jogos);
      if (tabela.length) origemTabela = 'calculada';
    }

    const encerrados = jogos.filter(j => j.encerrado);
    const conferidos = jogos.filter(j => j.conferencia === 'confirmado');

    const arquivo = {
      id: c.id,
      nome: c.nome,
      curto: c.curto,
      formato: c.formato,
      temporada: temporadaC,
      temporadaTabela,
      origemTabela,
      atualizado: new Date().toISOString(),
      classificacao: tabela,
      jogos,
      avisos
    };
    corrigeGrafia(arquivo);
    fs.writeFileSync(path.join(SAIDA, `${c.id}.json`), JSON.stringify(arquivo, null, 1));

    process.stdout.write(
      `${String(jogos.length).padStart(3)} jogos · ${String(encerrados.length).padStart(3)} encerrados · ` +
      `${String(conferidos.length).padStart(2)} conferidos na janela · ${avisos.length} divergências · ` +
      `${String(tabela.length).padStart(2)} times na tabela` +
      (origemTabela === 'calculada' ? ' (calculada pelo robô)' : '') +
      (origemTabela === 'nenhuma' ? ' (mata-mata, sem tabela)' : '') +
      (temporadaTabela !== cat.temporada ? ` · temporada ${temporadaTabela}` : '')
    );
    resumo.push({ id: c.id, nome: c.nome, jogos: jogos.length, tabela: tabela.length, avisos: avisos.length });
  }

  /* Quais escudos e mascotes o Annibal já desenhou.

     Sem esta lista o app tinha que adivinhar: pedia `img/escudos/<time>.png`
     para todo mundo e, quando não existia — que é o caso da quase totalidade —
     tomava um 404 e só então caía na imagem da fonte. Dava dezenas de pedidos
     perdidos a cada tela aberta. Agora o robô olha a pasta e conta para o app o
     que existe de verdade; ele só pede o que vai encontrar.

     Como o robô roda de meia em meia hora, um desenho novo aparece no app
     sozinho — e na hora, se ele rodar o script na mão depois de salvar. */
  function listarDesenhos() {
    const ler = (pasta, ext = '.png') => {
      try {
        return fs.readdirSync(path.join(RAIZ, 'img', pasta))
          .filter(f => f.toLowerCase().endsWith(ext))
          .map(f => f.slice(0, -ext.length))
          .sort();
      } catch { return []; }
    };
    /* fundos: o mascote em versão marca d'água, que a tela de computador põe
       atrás do conteúdo. É uma pasta à parte porque é outro desenho, feito para
       ocupar a tela inteira — não a mesma imagem em outro tamanho. E em .jpg,
       porque são opacos: em PNG pesavam dez vezes mais sem nenhum ganho. */
    return { escudos: ler('escudos'), mascotes: ler('mascotes'), fundos: ler('fundos', '.jpg') };
  }

  /* índice que o app lê primeiro, para montar o seletor sem baixar tudo */
  fs.writeFileSync(path.join(SAIDA, 'indice.json'), JSON.stringify({
    atualizado: new Date().toISOString(),
    temporada: cat.temporada,
    locais: listarDesenhos(),
    campeonatos: cat.campeonatos.map(c => {
      const r = resumo.find(x => x.id === c.id) || {};
      return { id: c.id, nome: c.nome, curto: c.curto, formato: c.formato, ordem: c.ordem, meses: c.meses, jogos: r.jogos || 0, temTabela: (r.tabela || 0) > 0 };
    })
  }, null, 1));

  console.log('\n\nPronto.');
}

main().catch(e => { console.error('\nO robô parou:', e); process.exit(1); });
