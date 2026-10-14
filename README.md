# Tabelaço

Tabelas, jogos e classificação dos campeonatos que importam, numa tela só —
Brasileirão A e B, Copa do Brasil, Libertadores, Champions, Carioca, Paulista,
Mineiro e Gaúcho.

**Ao vivo:** https://tabelaco.cartagossoftware.com

O torcedor escolhe o time do coração e o app se veste com as cores dele, do
primeiro ao último campeonato.

## De onde vêm os placares

De duas fontes independentes, ESPN e Fotmob, conferidas uma contra a outra:

- as duas concordam → o placar aparece normal;
- só uma tem o jogo → aparece marcado como **preliminar**;
- as duas discordam → o placar **não** aparece, e o jogo entra na lista de
  conferência. Melhor não mostrar do que mostrar errado.

Quem faz esse trabalho é `scripts/fetch-resultados.js`, disparado de meia em meia
hora pelo GitHub Actions (`.github/workflows/atualizar-resultados.yml`). Ele grava
os arquivos de `dados/` e commita sozinho. Nenhum computador precisa ficar ligado.

## Como rodar na sua máquina

```bash
node server.js          # sobe em http://localhost:8080/
node scripts/fetch-resultados.js   # busca os placares na hora
```

Só isso: não tem dependência para instalar, nem build. O app inteiro é o
`index.html` — HTML, CSS e JavaScript no mesmo arquivo, sem framework.

A página `celular.html` mostra o app dentro de uma tela de celular, para conferir
a versão de celular sem sair do computador.

## Acessibilidade

O app calcula sozinho a cor de cada texto a partir da cor do clube escolhido, de
modo que nenhum botão fique com o texto da mesma cor do próprio fundo — vale para
os 82 clubes cadastrados em `dados/cores.json`. No rodapé da versão de computador
há ainda um modo de **alto contraste** e três tamanhos de texto.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `index.html` | o app inteiro |
| `celular.html` | prévia da versão de celular |
| `dados/` | campeonatos, cores dos clubes e resultados |
| `scripts/fetch-resultados.js` | o robô que busca e confere os placares |
| `img/escudos/` | escudos desenhados, um arquivo por time |
| `img/fundo/tabelaco.jpg` | o fundo da tela de computador, igual para todos os times |
| `DESIGN-STITCH.md` | as cores e fontes que deram origem ao visual |

### Escudos

Basta salvar o PNG em `img/escudos/` com o nome do time em minúsculas e sem
acento (`atletico-mg.png`). O app passa a usar o desenho no lugar da imagem que
vem da fonte.

Quem avisa o app de que o arquivo existe é o robô: a cada rodada ele lista a
pasta e grava os nomes em `dados/indice.json`, no campo `locais`. Por isso
um desenho novo entra no ar em até meia hora, ou na mesma hora, se você rodar
`node scripts/fetch-resultados.js` depois de salvar.

### O fundo da tela de computador

`img/fundo/tabelaco.jpg` é o jogador de armadura do Tabelaço, o mesmo para
todos os times. Ele entra como **marca d'água** atrás do conteúdo, só na versão
de computador, e some no alto contraste, porque quem liga o alto contraste está
pedindo que nada dispute com o texto.

O mesmo arquivo alimenta o botão **Baixar wallpaper**, no rodapé da versão de
computador. Por isso ele já traz as marcas do Tabelaço e da Cartago's.

## Contato

Cartago's Software — contato@cartagossoftware.com · www.cartagossoftware.com
