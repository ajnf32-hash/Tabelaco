# -*- coding: utf-8 -*-
"""
Monta o mascote da versao de celular em cima do template do Annibal.

O template ("Template mascote celular 2.png") e um estadio azul. Este script:
  1. vira o azul do estadio e das bandeiras da torcida para a cor do clube
     (o verde do quadro e o verde do gramado ficam como estao, de proposito:
      o quadro verde e a marca do Tabelaco)
  2. recorta o personagem do fundo branco em que ele nasceu
  3. cola o personagem grande, com a cabeca passando por cima da borda de cima
  4. poe o escudo do clube no cantinho de cima, do lado direito

Uso:  python scripts/montar-mascote-celular.py <personagem.png> <escudo.png> <matiz> <saida.png>
      matiz = 0 vermelho, 30 laranja, 60 amarelo, 120 verde, 210 azul, 280 roxo
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

TEMPLATE = r"H:\Annibal\Cartagos Software\Tabelaço\Mascotes\Template mascote celular 2.png"

PAINEL = (23, 31, 676, 515)    # o estadio
FAIXA  = (23, 536, 676, 694)   # a torcida com as bandeiras


# ----------------------------------------------------------------- cor do time

def _rgb_para_hsv(a):
    import colorsys
    return None  # nao usado; ver tingir


def tingir(im, matiz_alvo, forca=1.0):
    """Leva o azul do template para a cor do clube. Verde nao e tocado."""
    a = np.array(im.convert("RGBA")).astype(np.float32)
    rgb, al = a[..., :3] / 255.0, a[..., 3]

    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    dif = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    h = np.zeros_like(mx)
    nz = dif > 1e-6
    idx = nz & (mx == r)
    h[idx] = ((g - b)[idx] / dif[idx]) % 6
    idx = nz & (mx == g)
    h[idx] = ((b - r)[idx] / dif[idx]) + 2
    idx = nz & (mx == b)
    h[idx] = ((r - g)[idx] / dif[idx]) + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, dif / np.maximum(mx, 1e-6), 0)
    v = mx

    # so o azul/ciano-azul vira. O verde do quadro e do gramado escapa.
    azul = (h >= 165) & (h <= 275)
    # cinza tambem entra de leve: o ceu quase preto tem pouca saturacao
    quase = (s < 0.12) & (v < 0.35)
    alvo = azul | quase

    h2 = np.where(alvo, matiz_alvo, h)
    s2 = np.where(alvo & (s < 0.25) & (v > 0.05), np.minimum(s + 0.18, 1.0), s)

    # HSV -> RGB
    c = v * s2
    x = c * (1 - np.abs((h2 / 60.0) % 2 - 1))
    m = v - c
    z = np.zeros_like(c)
    faixa = (h2 / 60.0).astype(int) % 6
    tab = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
    R = np.select([faixa == i for i in range(6)], [t[0] for t in tab])
    G = np.select([faixa == i for i in range(6)], [t[1] for t in tab])
    B = np.select([faixa == i for i in range(6)], [t[2] for t in tab])
    novo = np.stack([R + m, G + m, B + m], axis=2)

    saida = rgb * (1 - forca) + novo * forca
    out = np.concatenate([np.clip(saida * 255, 0, 255), al[..., None]], axis=2)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


# ------------------------------------------------------------ tirar o fundo branco

def recortar(im, brilho=138, cinza=34):
    """Apaga o fundo claro por alagamento a partir da borda.

    E por alagamento e nao por cor solta porque o personagem tem branco dentro
    dele (a bola, a meia, o olho). Tirando so o que esta ligado a borda, o
    branco de dentro fica.

    O corte e generoso (aceita cinza claro ate a sombra do chao) porque o
    gerador nao entrega branco chapado: entrega um fundo de estudio com
    vinheta. Cinza claro so existe no fundo; a pele do bicho e cinza escuro.
    """
    im = im.convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[..., :3].astype(int)

    claro = (rgb.min(axis=2) > brilho) & (rgb.max(axis=2) - rgb.min(axis=2) < cinza)
    visto = np.zeros((h, w), bool)
    fila = deque()
    for x in range(w):
        for y in (0, h - 1):
            if claro[y, x] and not visto[y, x]:
                visto[y, x] = True
                fila.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if claro[y, x] and not visto[y, x]:
                visto[y, x] = True
                fila.append((y, x))
    while fila:
        y, x = fila.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and claro[ny, nx] and not visto[ny, nx]:
                visto[ny, nx] = True
                fila.append((ny, nx))

    alfa = np.where(visto, 0, 255).astype(np.uint8)
    m = Image.fromarray(alfa).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    a[..., 3] = np.array(m)
    return Image.fromarray(a, "RGBA")


# ------------------------------------------------------------------- montagem

def sombra(figura, desloc=(6, 8), desfoque=9, opacidade=110):
    s = Image.new("RGBA", (figura.width + 40, figura.height + 40), (0, 0, 0, 0))
    marca = Image.new("RGBA", figura.size, (0, 0, 0, opacidade))
    s.paste(marca, (20 + desloc[0], 20 + desloc[1]), figura)
    return s.filter(ImageFilter.GaussianBlur(desfoque))


def montar(personagem, escudo, matiz, saida):
    fundo = tingir(Image.open(TEMPLATE), matiz)
    tela = Image.new("RGBA", fundo.size, (0, 0, 0, 0))
    tela.alpha_composite(fundo)

    # --- personagem ---
    p = recortar(Image.open(personagem))
    p = p.crop(p.getbbox())
    px1, py1, px2, py2 = PAINEL
    alvo_h = int((py2 - py1) * 1.12)          # passa da borda de cima de proposito
    esc = alvo_h / p.height
    if p.width * esc > (px2 - px1) * 0.98:
        esc = (px2 - px1) * 0.98 / p.width
    p = p.resize((max(1, int(p.width * esc)), max(1, int(p.height * esc))), Image.LANCZOS)

    cx = (px1 + px2) // 2 - p.width // 2
    cy = py2 - p.height + int((py2 - py1) * 0.06)   # pes perto da linha de baixo

    s = sombra(p)
    tela.alpha_composite(s, (cx - 20, cy - 20))
    tela.alpha_composite(p, (cx, cy))

    # a faixa da torcida volta por cima: ela e o chao da cena
    faixa = fundo.crop(FAIXA)
    tela.alpha_composite(faixa, (FAIXA[0], FAIXA[1]))

    # --- escudo no cantinho, por ultimo ---
    # por ultimo de proposito: se o bicho for largo, e o escudo que tem que
    # continuar visivel, nao o contrario. Escudo escondido nao identifica time.
    e = Image.open(escudo).convert("RGBA")
    lado = 78
    e = e.resize((lado, int(e.height * lado / e.width)), Image.LANCZOS)
    tela.alpha_composite(sombra(e, (2, 3), 5, 150), (px2 - lado - 30 - 20, py1 + 14 - 20))
    tela.alpha_composite(e, (px2 - lado - 30, py1 + 14))

    tela.save(saida)
    return saida


if __name__ == "__main__":
    print(montar(sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]))
