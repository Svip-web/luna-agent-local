"""One-time source capture. The delivered site does not use the network."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlsplit, unquote
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup, Comment
import hashlib, json, re

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
ASSETS = PUBLIC / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
mapping = {}
errors = []
UA = 'Mozilla/5.0'
def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': UA}), timeout=60) as r:
        return r.read()
def asset(url):
    url = url.replace('&amp;', '&')
    if url in mapping: return mapping[url]
    suffix = Path(unquote(urlsplit(url).path)).suffix or '.bin'
    name = hashlib.sha256(url.encode()).hexdigest()[:20] + suffix
    mapping[url] = 'assets/' + name
    dest = ASSETS / name
    try:
        if not dest.exists(): dest.write_bytes(fetch(url))
        if suffix == '.css':
            css = dest.read_text(encoding='utf-8')
            def sub(m):
                value = m.group(1).strip(' \"\'')
                if value.startswith(('data:', '#')): return m.group(0)
                return 'url("' + Path(asset(urljoin(url, value))).name + '")'
            css = re.sub(r'url\(([^)]+)\)', sub, css)
            dest.write_text(css, encoding='utf-8')
    except Exception as e:
        errors.append({'url':url, 'error':str(e)})
    return mapping[url]

def page(html, base, filename):
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup.find_all(['script', 'noscript', 'iframe']): tag.decompose()
    for tag in soup.find_all('link'):
        if any(x in tag.get('rel',[]) for x in ['preconnect','dns-prefetch','canonical']): tag.decompose()
    for tag in soup.find_all('meta', attrs={'name':re.compile('generator|google-site-verification')}): tag.decompose()
    for c in soup.find_all(string=lambda t:isinstance(t,Comment)): c.extract()
    urls=set()
    for tag in soup.find_all(True):
        for key in list(tag.attrs):
            if key.startswith(('data-wf','data-turnstile','on')) or key in ['integrity','crossorigin']: del tag[key]
        for attr in ['src','poster','href']:
            value=tag.get(attr,'')
            if value.startswith(('https://','http://','//')) and tag.name != 'a': urls.add(urljoin(base,value))
        if tag.get('srcset'):
            for item in tag['srcset'].split(','): urls.add(urljoin(base,item.strip().split()[0]))
    with ThreadPoolExecutor(max_workers=12) as pool: list(pool.map(asset, sorted(urls)))
    for tag in soup.find_all(True):
        for attr in ['src','poster','href']:
            value=tag.get(attr,'')
            if tag.name != 'a' and value.startswith(('https://','http://','//')): tag[attr]=mapping[urljoin(base,value)]
        if tag.get('srcset'):
            tag['srcset']=', '.join(mapping[urljoin(base,p.strip().split()[0])]+' '+' '.join(p.strip().split()[1:]) for p in tag['srcset'].split(','))
        if tag.name == 'a' and tag.get('href','').startswith(('http','//')):
            tag['href'] = './policy-coding.html' if '/policy-coding' in tag['href'] else './index.html'
    soup.html['lang']='ru'
    soup.head.append(soup.new_tag('meta',attrs={'http-equiv':'Content-Security-Policy','content':"default-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'"}))
    soup.head.append(soup.new_tag('link',rel='stylesheet',href='assets/fonts.css'))
    soup.head.append(soup.new_tag('link',rel='stylesheet',href='local.css'))
    if filename == 'index.html':
        soup.title.string='ИИ-агенты — бесплатный онлайн-практикум'
        for tag in soup.select('link[href*="intlTel"]'): tag.decompose()
        form=soup.find('form')
        form['action']='#'
        form['method']='post'
        field=form.find('input',type='tel')
        field['placeholder']='+380 50 123 4567'
        field['aria-label']='Номер телефона с кодом страны'
        field['pattern']=r'\+?[0-9\s()\-]{7,25}'
        field['maxlength']='25'
        field['autocomplete']='tel'
        note=soup.new_tag('p',attrs={'class':'local-note'})
        note.string='Локальная демоверсия: заявка сохраняется только в этом браузере. Регистрация на эфир и переход в чат-бот не выполняются.'
        form.select_one('.p-14').clear()
        form.select_one('.p-14').string='Запись на бесплатный практикум'
        form.insert(1,note)
        status=soup.new_tag('p',attrs={'id':'local-status','role':'status','class':'local-note'})
        form.append(status)
        popup=soup.select_one('.pop-up-wrp-min')
        popup['role']='dialog'; popup['aria-modal']='true'; popup['aria-label']='Запись на практикум'
        close=soup.select_one('.close-img')
        close['role']='button'; close['tabindex']='0'; close['aria-label']='Закрыть'
        swiper=asset('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js')
        soup.body.append(soup.new_tag('script',src=swiper))
        soup.body.append(soup.new_tag('script',src='local.js'))
    (PUBLIC/filename).write_text(str(soup),encoding='utf-8')

source=(ROOT.parent/'tmp/luna-agent-source.html').read_text(encoding='utf-8')
page(source,'https://www.luna13.academy/agent','index.html')
page(fetch('https://www.luna13.academy/policy-coding').decode('utf-8'),'https://www.luna13.academy/policy-coding','policy-coding.html')
font_url='https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap'
css=fetch(font_url).decode()
css=re.sub(r'url\(([^)]+)\)',lambda m:'url("'+Path(asset(m.group(1).strip('\"\''))).name+'")',css)
(ASSETS/'fonts.css').write_text(css,encoding='utf-8')
(ROOT/'asset-manifest.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'download-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(mapping),'errors':errors},ensure_ascii=False))
