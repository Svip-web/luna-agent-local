"""One-time edit of the original compact HTML header."""
from pathlib import Path
from bs4 import BeautifulSoup

page = Path(__file__).resolve().parent / 'public' / 'index.html'
soup = BeautifulSoup(page.read_text(encoding='utf-8'), 'html.parser')
strip = soup.select_one('.section-n.hero-w .nav-line.g-2.m')
assert strip is not None
strip['class'] = strip.get('class', []) + ['event-strip']
badges = strip.find_all('div', class_='pl-nav-n', recursive=False)
assert len(badges) == 2

first = badges[0]
first.clear()
kicker = soup.new_tag('span', attrs={'class': 'event-kicker'})
kicker.string = 'Бесплатный'
title = soup.new_tag('strong', attrs={'class': 'event-title'})
title.string = 'онлайн-практикум'
first.extend([kicker, title])

second = badges[1]
second.clear()
clock = soup.new_tag('img', attrs={
    'class': 'event-clock', 'src': 'assets/234ee51ec37d97aa8532.svg',
    'alt': '', 'aria-hidden': 'true'
})
copy = soup.new_tag('div', attrs={'class': 'event-copy'})
time = soup.new_tag('strong', attrs={'class': 'event-time'})
time.string = 'Сегодня в 19:00'
zones = soup.new_tag('span', attrs={'class': 'event-zones'})
zones.string = 'Берлин · Варшава · Мадрид'
copy.extend([time, zones])
second.extend([clock, copy])

page.write_text(str(soup), encoding='utf-8')
