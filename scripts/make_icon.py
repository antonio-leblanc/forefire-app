# Gera os ícones do app (resources/installer/ e resources/) a partir do logo do ForeFire num
# quadrado escuro arredondado (SPEC §7.2). Rodar da raiz do repo:
#   uv run --with pillow python scripts/make_icon.py src/renderer/src/assets/logo.png
import sys
from PIL import Image, ImageDraw
logo_path = sys.argv[1]
N = 1024
SS = 4  # supersampling pra borda lisa
bg = Image.new('RGBA', (N * SS, N * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(bg)
m = 40 * SS
d.rounded_rectangle([m, m, N * SS - m, N * SS - m], radius=200 * SS, fill=(31, 26, 22, 255), outline=(58, 50, 43, 255), width=6 * SS)
bg = bg.resize((N, N), Image.LANCZOS)
logo = Image.open(logo_path).convert('RGBA')
h = 640
w = round(logo.width * h / logo.height)
logo = logo.resize((w, h), Image.LANCZOS)
bg.alpha_composite(logo, ((N - w) // 2, (N - h) // 2 + 8))
bg.save('resources/installer/icon.png')
bg.save('resources/installer/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
bg.save('resources/installer/icon.icns')
# Ícone da janela em runtime.
bg.resize((512, 512), Image.LANCZOS).save('resources/icon.png')
