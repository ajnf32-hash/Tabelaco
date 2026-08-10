# Tabelaço

Tabelas, jogos e classificação dos campeonatos que importam, numa tela só —
Brasileirão A e B, Copa do Brasil, Libertadores, Champions, Carioca, Paulista,
Mineiro e Gaúcho.

**Ao vivo:** https://ajnf32-hash.github.io/Tabelaco/

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
| `img/mascotes/` | mascotes dos clubes, um arquivo por time |
| `PEDIDOS-MASCOTES.md` | o que pedir ao ilustrador de cada mascote |
| `DESIGN-STITCH.md` | as cores e fontes que deram origem ao visual |

## Contato

Cartago's Software — contato@cartagossoftware.com · www.cartagossoftware.com
