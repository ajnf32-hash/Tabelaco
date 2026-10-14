/* Teste do Tabelaço — confere o app NO AR, do jeito que o torcedor usa.

   Roda sozinho no GitHub todo dia (ver .github/workflows/testar-app.yml), sem
   computador ligado e sem gastar nada. Se alguma coisa quebrar, a rodada fica
   vermelha e o GitHub manda e-mail.

   Nasceu de um defeito real: de 15/09 a 14/10/2026 a aba Jogos ficou vazia em
   todos os campeonatos e ninguém percebeu, porque a tabela continuava certa.

   Rodar na mão:  cd testes && npm install && node testar-app.mjs
   Outro endereço: node testar-app.mjs http://127.0.0.1:8080 */

import { chromium } from 'playwright';

const SITE = (process.argv[2] || 'https://tabelaco.cartagossoftware.com').replace(/\/$/, '');
const HORAS_SEM_ATUALIZAR = 3;   // o robô roda de meia em meia hora
const DIAS_SEM_JOGO = 45;        // campeonato em andamento sem jogo nesse raio está errado

const falhas = [];
let passos = 0;
function confere(ok, oQue) {
  passos++;
  if (ok) console.log('  ok   ' + oQue);
  else { console.log('  FALHA ' + oQue); falhas.push(oQue); }
}
const pegar = async caminho => {
  const r = await fetch(`${SITE}/${caminho}?t=${Date.now()}`);
  return r;
};

/* ------------------------------------------------------------ 1. arquivos */
console.log('\nArquivos do app');
for (const f of ['', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png',
                 'img/logo-capa.jpg', 'img/fundo/tabelaco.jpg',
                 'img/cartagos-marca.png', 'img/cartagos-nome.png']) {
  const r = await pegar(f);
  confere(r.ok, `${f || 'página inicial'} abre (${r.status})`);
}

/* ---------------------------------------------------------------- 2. dados */
console.log('\nDados dos campeonatos');
const indice = await (await pegar('dados/indice.json')).json();
const horas = iso => (Date.now() - new Date(iso)) / 36e5;
confere(horas(indice.atualizado) < HORAS_SEM_ATUALIZAR,
  `robô rodou nas últimas ${HORAS_SEM_ATUALIZAR}h (última: ${indice.atualizado})`);

const mesAgora = new Date().getUTCMonth() + 1;
for (const c of indice.campeonatos) {
  const d = await (await pegar(`dados/${c.id}.json`)).json();
  confere(d.jogos.length > 0, `${c.curto}: tem jogos (${d.jogos.length})`);
  if (c.formato !== 'mata-mata')
    confere(d.classificacao.length > 0, `${c.curto}: tem tabela (${d.classificacao.length} times)`);
  if ((c.meses || []).includes(mesAgora)) {
    const perto = d.jogos.filter(j => Math.abs(Date.now() - new Date(j.data)) < DIAS_SEM_JOGO * 864e5);
    confere(perto.length > 0, `${c.curto}: em andamento e com jogo a menos de ${DIAS_SEM_JOGO} dias`);
  }
  const semNome = d.jogos.filter(j => !j.mandante || !j.visitante).length;
  confere(semNome === 0, `${c.curto}: todo jogo tem os dois times`);
}

/* ----------------------------------------------------------- 3. navegador */
const navegador = await chromium.launch();

async function usar(nomeTela, tamanho) {
  console.log(`\nUsando o app: ${nomeTela}`);
  const pagina = await navegador.newPage({ viewport: tamanho, acceptDownloads: true });
  const erros = [];
  pagina.on('pageerror', e => erros.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

  await pagina.goto(SITE, { waitUntil: 'networkidle' });
  confere(await pagina.isVisible('#capa'), 'capa aparece');
  /* force: o botão pulsa sem parar, e o clique normal espera ele ficar parado */
  await pagina.click('#entrar', { force: true });
  await pagina.waitForSelector('#app:not([hidden])');
  confere(true, 'botão "Ver tabelas" abre o app');

  /* cada campeonato do seletor abre e desenha alguma coisa */
  const botoes = await pagina.$$('#seletor button');
  confere(botoes.length === indice.campeonatos.length,
    `seletor mostra os ${indice.campeonatos.length} campeonatos (${botoes.length})`);
  for (const c of indice.campeonatos) {
    await pagina.click(`#seletor button:text-is("${c.curto}")`);
    await pagina.waitForFunction(() => !document.querySelector('#carrossel').textContent.includes('Buscando'));
    const texto = await pagina.textContent('#carrossel');
    confere(!texto.includes('Não consegui'), `${c.curto} abre`);
  }

  /* volta na Série A e passa pelas quatro abas */
  await pagina.click('#seletor button:text-is("Série A")');
  await pagina.waitForSelector('#carrossel table');
  confere(await pagina.$$eval('#carrossel table tbody tr', l => l.length) >= 20, 'Classificação mostra os 20 times');
  const abas = await pagina.$$('#pontos button');
  confere(abas.length === 4, 'existem as 4 abas');
  for (let i = 0; i < abas.length; i++) {
    /* as abas são redesenhadas a cada clique, por isso procura de novo */
    await pagina.click(`#pontos button:nth-child(${i + 1})`);
    /* a troca de aba desliza; espera o deslize terminar */
    const marcada = await pagina.waitForFunction(n =>
      document.querySelector(`#pontos button:nth-child(${n})`).classList.contains('on'), i + 1,
      { timeout: 4000 }).then(() => true, () => false);
    confere(marcada, `aba ${i + 1} abre ao clicar`);
  }
  confere(await pagina.$$eval('#carrossel .jogo', l => l.length) > 0, 'aba Jogos mostra jogos');

  /* time do coração */
  await pagina.click('#btTorcida');
  await pagina.waitForSelector('#gaveta.abre');
  confere(await pagina.$$eval('#listaTimes button', l => l.length) > 20, 'lista de times abre e tem times');
  await pagina.click('#listaTimes button:has-text("Flamengo")');
  confere(!(await pagina.$eval('#gaveta', g => g.classList.contains('abre'))), 'escolher o time fecha a lista');
  confere(await pagina.evaluate(() => localStorage.getItem('tabelaco.time')) === 'Flamengo', 'time escolhido fica guardado');

  /* O rodapé, com contraste, tamanho do texto, wallpaper e contato, só existe na
     tela de computador. No celular o contato fica no botão do alto (#btInfo). */
  const computador = tamanho.width >= 920;
  if (computador) {
    /* alto contraste liga e desliga */
    await pagina.click('#btContraste');
    confere(await pagina.$eval('html', h => h.classList.contains('contraste-alto')), 'alto contraste liga');
    await pagina.click('#btContraste');
    confere(!(await pagina.$eval('html', h => h.classList.contains('contraste-alto'))), 'alto contraste desliga');

    /* tamanho do texto troca */
    const antes = await pagina.textContent('#txtTamanho');
    await pagina.click('#btTexto');
    confere((await pagina.textContent('#txtTamanho')) !== antes, 'botão Texto troca o tamanho');

    /* wallpaper */
    await pagina.waitForSelector('#btWallpaper:not([hidden])', { timeout: 10000 }).catch(() => {});
    const href = await pagina.getAttribute('#btWallpaper', 'href');
    confere(!!href && !(await pagina.isHidden('#btWallpaper')), 'botão Baixar wallpaper aparece');
    if (href) confere((await pegar(href)).ok, 'wallpaper baixa');
  }

  /* contato */
  await pagina.click(computador ? '#btContato' : '#btInfo');
  await pagina.waitForSelector('#sobre.abre');
  confere(true, 'botão Contato abre a página de contato');
  confere(await pagina.getAttribute('#linkZap', 'href') === 'https://wa.me/5521979902500', 'WhatsApp certo');
  confere(await pagina.getAttribute('#linkMail', 'href') === 'mailto:contato@cartagossoftware.com', 'e-mail certo');
  confere((await pagina.getAttribute('#linkSite', 'href') || '').includes('cartagossoftware.com'), 'link do site certo');
  await pagina.keyboard.press('Escape');
  confere(!(await pagina.$eval('#sobre', s => s.classList.contains('abre'))), 'Esc fecha o contato');

  confere(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  await pagina.close();
}

for (const [nome, tamanho] of [['computador', { width: 1440, height: 900 }],
                                ['celular',    { width: 390,  height: 844 }]]) {
  try { await usar(nome, tamanho); }
  catch (e) { confere(false, `${nome}: o teste travou: ` + e.message.split('\n')[0]); }
}
await navegador.close();

console.log(`\n${passos - falhas.length} de ${passos} conferências passaram.`);
if (falhas.length) {
  console.log('\nO QUE QUEBROU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
