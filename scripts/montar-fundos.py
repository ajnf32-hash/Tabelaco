# -*- coding: utf-8 -*-
"""
Monta os fundos de PC do Tabelaco a partir dos PNG do Annibal.

O que ele pediu em 25/08/2026:
  - ocupar a tela inteira: o desenho vem 1376x768 (1,79:1) e sai 1920x1080 (16:9),
    com um corte de 11 px na largura para bater o formato exato;
  - marca d'agua do escudo do Tabelaco no canto de baixo a direita;
  - marca d'agua da Cartago's no canto de baixo a esquerda, o triangulo com o nome
    ao lado, do mesmo jeito que esta no site.
"""
from PIL import Image, ImageFilter
import os, sys, unicodedata, re, json, io

WP    = r"H:\Annibal\Cartagos Software\Tabelaço\Mascotes Wallpaper"
PROJ  = r"C:\Users\ajnf32\Cartagos Software\Tabelaco"
SAIDA = os.path.join(PROJ, "img", "fundos")
ESCUDO  = r"H:\Annibal\Cartagos Software\Tabelaço\Logo tabelaço só o escudo.png"
SIMBOLO = os.path.join(PROJ, "..", "Cartagos-Site", "src", "assets", "images", "cartago-simbolo-branco.png")
NOME    = os.path.join(PROJ, "..", "Cartagos-Site", "src", "assets", "images", "cartago-logotipo-branco.png")

L, A = 1920, 1080
MARGEM = 34
ALT_ESCUDO = 118      # altura do escudo do Tabelaco
ALT_SIMB   = 74       # altura do triangulo da Cartago's
ALT_NOME   = 30       # altura do nome escrito ao lado
VAO        = 16       # espaco entre o triangulo e o nome
OPAC_ESCUDO = 0.60
OPAC_MARCA  = 0.55

def opacidade(img, k):
    img = img.copy()
    img.putalpha(img.getchannel("A").point(lambda v: int(v * k)))
    return img

def com_sombra(img, raio=5, forca=0.85):
    """Sombra preta atras, para a marca ler tanto em fundo claro quanto escuro."""
    pad = raio * 3
    base = Image.new("RGBA", (img.width + pad*2, img.height + pad*2), (0,0,0,0))
    sombra = Image.new("RGBA", base.size, (0,0,0,0))
    silhueta = Image.new("RGBA", img.size, (0,0,0,255))
    silhueta.putalpha(img.getchannel("A"))
    sombra.alpha_composite(silhueta, (pad, pad + 2))
    sombra = sombra.filter(ImageFilter.GaussianBlur(raio))
    sombra.putalpha(sombra.getchannel("A").point(lambda v: int(v * forca)))
    base.alpha_composite(sombra)
    base.alpha_composite(img, (pad, pad))
    return base

def por_altura(p, alt):
    im = Image.open(p).convert("RGBA")
    im = im.crop(im.getbbox())
    return im.resize((max(1, round(im.width * alt / im.height)), alt), Image.LANCZOS)

# --- as duas marcas, montadas uma vez so ---
escudo = com_sombra(opacidade(por_altura(ESCUDO, ALT_ESCUDO), OPAC_ESCUDO))

simb = por_altura(SIMBOLO, ALT_SIMB)
nome = por_altura(NOME, ALT_NOME)
marca = Image.new("RGBA", (simb.width + VAO + nome.width, max(simb.height, nome.height)), (0,0,0,0))
marca.alpha_composite(simb, (0, (marca.height - simb.height)//2))
marca.alpha_composite(nome, (simb.width + VAO, (marca.height - nome.height)//2))
marca = com_sombra(opacidade(marca, OPAC_MARCA))

def montar(caminho_png):
    im = Image.open(caminho_png).convert("RGB")
    # corta para 16:9 pelo centro, depois amplia
    alvo = im.height * 16 / 9
    if im.width > alvo:
        corte = round((im.width - alvo) / 2)
        im = im.crop((corte, 0, im.width - corte, im.height))
    elif im.width < alvo:
        alvo_h = round(im.width * 9 / 16)
        corte = (im.height - alvo_h) // 2
        im = im.crop((0, corte, im.width, corte + alvo_h))
    im = im.resize((L, A), Image.LANCZOS).convert("RGBA")
    im.alpha_composite(escudo, (L - MARGEM - escudo.width, A - MARGEM - escudo.height))
    im.alpha_composite(marca,  (MARGEM - 15, A - MARGEM - marca.height + 8))
    return im.convert("RGB")

# ---------- de qual arquivo vem cada clube ----------
def chave(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", s)
def apelido(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii","ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

APEL = {"athleticclub":"Athletic", "atleticomineiro":"Atlético-MG", "curitiba":"Coritiba",
        "fluminence":"Fluminense", "paisandu":"Paysandu", "vasco":"Vasco da Gama"}
MESMO = {"Athletico-PR":"Athletico Paranaense"}

if __name__ == "__main__":
    masc = json.load(io.open(os.path.join(PROJ, "dados", "mascotes.json"), encoding="utf-8"))["mascotes"]
    clubes = {}
    for c in masc:
        c2 = MESMO.get(c, c); clubes.setdefault(chave(c2), c2)

    feitos, fora = [], []
    for f in sorted(os.listdir(WP)):
        if not f.lower().endswith(".png") or f.lower() == "screen.png": continue
        base = os.path.splitext(f)[0]
        if base.startswith("Manaus - ERRADO"): continue
        if base == "Tabelaço":
            montar(os.path.join(WP, f)).save(os.path.join(SAIDA, "tabelaco.jpg"),
                                             "JPEG", quality=84, optimize=True, progressive=True)
            feitos.append("Tabelaço (reserva)"); continue
        k = chave(base); k = chave(APEL.get(k, k))
        if k not in clubes: fora.append(base); continue
        clube = clubes[k]
        montar(os.path.join(WP, f)).save(os.path.join(SAIDA, apelido(clube) + ".jpg"),
                                         "JPEG", quality=84, optimize=True, progressive=True)
        feitos.append(clube)

    print(f"gerados: {len(feitos)}")
    if fora: print("sem clube correspondente:", fora)
    tot = sum(os.path.getsize(os.path.join(SAIDA, x)) for x in os.listdir(SAIDA))
    print(f"pasta: {len(os.listdir(SAIDA))} arquivos, {tot/1024/1024:.1f} MB")
