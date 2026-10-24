"""Reproduce the repository-owned three-frame image codec sample (not a runtime dependency)."""
from pathlib import Path
from PIL import Image,ImageDraw

frames=[]
for color in ['#2563eb','#2dd4bf','#f97316']:
 image=Image.new('RGB',(24,24),color);draw=ImageDraw.Draw(image);draw.rectangle((7,7,16,16),fill='white');frames.append(image)
frames[0].save(Path(__file__).with_name('pulse.gif'),save_all=True,append_images=frames[1:],duration=[240,240,240],loop=0,optimize=False,disposal=2)
