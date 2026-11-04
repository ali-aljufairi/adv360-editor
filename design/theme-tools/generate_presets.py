#!/usr/bin/env python3
"""Embed Ghostty bundled palettes in prototype/index.html.
Usage: python3 generate_presets.py [Ghostty themes dir] [prototype html]
"""
from pathlib import Path
import html, json, re, sys
ROOT=Path(__file__).resolve().parents[1]
SRC=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/Applications/Ghostty.app/Contents/Resources/ghostty/themes')
OUT=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'prototype/index.html'
LICENSES=json.loads((ROOT/'sources/license-audit.json').read_text())['themes']
NAMES=['Catppuccin Mocha','Catppuccin Latte','Catppuccin Frappe','Catppuccin Macchiato','TokyoNight','TokyoNight Day','TokyoNight Moon','TokyoNight Storm','Dracula','Nord','Nord Light','Gruvbox Dark','Gruvbox Dark Hard','Gruvbox Light','Gruvbox Light Hard','Rose Pine','Rose Pine Dawn','Rose Pine Moon','Solarized Dark Patched','Solarized Light','Kanagawa Wave','Kanagawa Lotus','Kanagawa Dragon','Everforest Dark Hard','Everforest Dark Med','Everforest Dark Soft','Everforest Light Hard','Everforest Light Med','Everforest Light Soft','Atom One Dark','Atom One Light','GitHub Dark','GitHub Light Default','GitHub Dark Dimmed','GitHub Dark High Contrast','Andromeda','Cobalt Next','Ayu','Ayu Light','Ayu Mirage','One Dark Two','Night Owl','Night Owlish Light','Flexoki Dark','Flexoki Light','Modus Vivendi','Modus Operandi','Dawnfox','Dayfox','Everblush','Zenburn','Horizon','Snazzy','Carbonfox','Material Ocean']
ALIASES={'TokyoNight':'TokyoNight','TokyoNight Day':'TokyoNight Day','TokyoNight Moon':'TokyoNight Moon','TokyoNight Storm':'TokyoNight Storm'}
def read_palette(name):
 p=SRC/ALIASES.get(name,name)
 if not p.is_file(): return None
 out={'palette':{}}
 for line in p.read_text(errors='replace').splitlines():
  line=line.strip()
  if not line or line.startswith('#') or '=' not in line: continue
  k,v=(x.strip() for x in line.split('=',1))
  if k=='palette':
   m=re.fullmatch(r'(\d+)\s*=\s*(#[0-9a-fA-F]{6})',v)
   if m: out['palette'][int(m[1])]=m[2].lower()
  elif k in ('background','foreground','cursor-color','selection-background','selection-foreground') and re.fullmatch(r'#[0-9a-fA-F]{6}',v): out[k]=v.lower()
 q=out['palette']
 if len(q)<8 or 'background' not in out or 'foreground' not in out: return None
 return {'background':out['background'],'foreground':out['foreground'],'cursor':out.get('cursor-color',out['foreground']),'selection':out.get('selection-background',q.get(4,out['foreground'])),'ansi':[q.get(i,out['foreground']) for i in range(16)]}
def oc(name, defs, dark, light):
 keys=set(dark)|set(light); theme={}
 for k in keys: theme[k]={'dark':dark.get(k,defs['neutral2']),'light':light.get(k,defs['neutral8'])}
 return {'id':'custom:'+name.lower().replace(' ','-'),'name':name,'source':'Hand-tuned OpenCode-style semantic JSON','type':'semantic','license':'Original prototype palette','defs':defs,'theme':theme}
presets=[]
for n in NAMES:
 pal=read_palette(n)
 if pal:
  lic=LICENSES.get(n,{'license':'unknown','source':''})
  presets.append({'id':'ghostty:'+n.lower().replace(' ','-'),'name':n,'source':'Ghostty bundled / iTerm2-Color-Schemes','sourceFile':n,'license':lic['license'],'licenseSource':lic.get('source',''),'type':'terminal','palette':pal})
presets += [
 oc('Harbor Signal',{'neutral2':'#33494b','neutral8':'#d4e6df'}, {'primary':'#69d4c4','secondary':'#83b6e6','accent':'#c3df7c','error':'#f18172','warning':'#efc875','success':'#c3df7c','info':'#83b6e6','text':'#d7f0ed','textMuted':'#91aaa8','background':'#102225','backgroundPanel':'#1b3438','backgroundElement':'#254247','border':'#3a5556','borderActive':'#69d4c4','borderSubtle':'#294143','diffAdded':'#c3df7c','diffRemoved':'#f18172','diffAddedBg':'#254332','diffRemovedBg':'#452d34'}, {'primary':'#247b72','secondary':'#366a94','accent':'#617b2c','error':'#a63f3f','warning':'#84621b','success':'#617b2c','info':'#366a94','text':'#173331','textMuted':'#536e6a','background':'#eef5ef','backgroundPanel':'#e2ece4','backgroundElement':'#d8e7df','border':'#b8ccc1','borderActive':'#247b72','borderSubtle':'#cfddd4','diffAdded':'#426b29','diffRemoved':'#a63f3f','diffAddedBg':'#d5e8d1','diffRemovedBg':'#f1d9d5'}),
 oc('Signal Amber',{'neutral2':'#303034','neutral8':'#e8e5da'}, {'primary':'#ffc857','secondary':'#78c6c2','accent':'#b9df78','error':'#ff766e','warning':'#ffc857','success':'#b9df78','info':'#78c6c2','text':'#f5eedc','textMuted':'#aaa393','background':'#17181b','backgroundPanel':'#202226','backgroundElement':'#2b2e32','border':'#43464a','borderActive':'#ffc857','borderSubtle':'#303236','diffAdded':'#b9df78','diffRemoved':'#ff766e','diffAddedBg':'#293627','diffRemovedBg':'#3c2929'}, {'primary':'#835300','secondary':'#246e6c','accent':'#526d14','error':'#a73330','warning':'#835300','success':'#526d14','info':'#246e6c','text':'#28251d','textMuted':'#655f50','background':'#f6f1e4','backgroundPanel':'#ebe4d3','backgroundElement':'#e2d9c3','border':'#cfc4aa','borderActive':'#835300','borderSubtle':'#ddd4c1','diffAdded':'#4d641e','diffRemoved':'#a73330','diffAddedBg':'#e0e9d2','diffRemovedBg':'#f2dcd5'}),
 oc('Studio Slate',{'neutral2':'#343b45','neutral8':'#e1e6eb'}, {'primary':'#8eafff','secondary':'#79d3bf','accent':'#e5bf75','error':'#ff817d','warning':'#e5bf75','success':'#79d3bf','info':'#8eafff','text':'#e8edf3','textMuted':'#a0aab7','background':'#181d24','backgroundPanel':'#222a33','backgroundElement':'#2c3641','border':'#404b58','borderActive':'#8eafff','borderSubtle':'#303943','diffAdded':'#79d3bf','diffRemoved':'#ff817d','diffAddedBg':'#283d3a','diffRemovedBg':'#432d32'}, {'primary':'#315997','secondary':'#2c7568','accent':'#836116','error':'#a13d3d','warning':'#836116','success':'#2c7568','info':'#315997','text':'#232b34','textMuted':'#5e6977','background':'#f0f3f6','backgroundPanel':'#e4e9ee','backgroundElement':'#d9e0e7','border':'#c2ccd6','borderActive':'#315997','borderSubtle':'#d0d8e0','diffAdded':'#2c7568','diffRemoved':'#a13d3d','diffAddedBg':'#d6e7df','diffRemovedBg':'#f0d9d7'})]
# Theme families pair a light preset with its dark sibling for follow-system mode.
PAIR_GROUPS={
 'catppuccin':['Catppuccin Mocha','Catppuccin Frappe','Catppuccin Macchiato','Catppuccin Latte'],
 'tokyonight':['TokyoNight','TokyoNight Day','TokyoNight Moon','TokyoNight Storm'],
 'nord':['Nord','Nord Light'], 'gruvbox':['Gruvbox Dark','Gruvbox Dark Hard','Gruvbox Light','Gruvbox Light Hard'],
 'rose-pine':['Rose Pine','Rose Pine Moon','Rose Pine Dawn'], 'solarized':['Solarized Dark Patched','Solarized Light'],
 'kanagawa':['Kanagawa Wave','Kanagawa Lotus','Kanagawa Dragon'],
 'everforest-hard':['Everforest Dark Hard','Everforest Light Hard'],
 'everforest-med':['Everforest Dark Med','Everforest Light Med'],
 'everforest-soft':['Everforest Dark Soft','Everforest Light Soft'],
 'atom-one':['Atom One Dark','Atom One Light'], 'github':['GitHub Dark','GitHub Light Default'],
 'ayu':['Ayu','Ayu Light'], 'flexoki':['Flexoki Dark','Flexoki Light'],
 'modus':['Modus Vivendi','Modus Operandi'], 'fox':['Dawnfox','Dayfox']}
for group,names in PAIR_GROUPS.items():
 for item in presets:
  if item.get('sourceFile') in names:
   item['pairKey']=group; item['pairMode']='light' if 'Light' in item['name'] or item['name'] in ('TokyoNight Day','Rose Pine Dawn','Solarized Light','Kanagawa Lotus','Modus Operandi','Dayfox') else 'dark'
if len(presets)<40: raise SystemExit(f'Only {len(presets)} presets; source dir={SRC}')
script='<script id="theme-catalog" type="application/json">'+json.dumps(presets,ensure_ascii=False,separators=(',',':')).replace('</script','<\\/script')+'</script>'
note='<p class="license-note">Ghostty palette samples come from the bundled iTerm2-Color-Schemes collection. The collection is MIT, but each palette keeps its author’s license. This scratchpad is a research catalog; before shipping, bundle only verified permissive entries and their required notices. Exclude <code>unknown</code> and <code>nonfree</code> palettes.</p>'
s=OUT.read_text()
s=re.sub(r'<p class="license-note">.*?</p>','',s,flags=re.S)
s=re.sub(r'<script id="theme-catalog" type="application/json">.*?</script>','',s,flags=re.S)
marker="<script>\n(() => {\n'use strict';\nconst catalogEl"
if marker in s: s=s.replace(marker,note+'\n'+script+'\n'+marker,1)
else: s=s.replace('</body>',note+'\n'+script+'\n</body>')
OUT.write_text(s)
print(f'Embedded {len(presets)} themes: {sum(x["type"]=="terminal" for x in presets)} Ghostty palettes + 3 semantic themes')
