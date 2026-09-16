from pathlib import Path

root = Path(__file__).resolve().parent / 'public' / 'assets'
icons = {
    'cd9fcc897e933d61b38f.svg': '#B07724',
    '19d912893018882ff131.svg': '#C68A2F',
    'fcaa5fe91a3a1d85178d.svg': '#A86920',
    '234ee51ec37d97aa8532.svg': '#BB812C',
}
for name, color in icons.items():
    path = root / name
    source = path.read_text(encoding='utf-8')
    source = source.replace('fill="black"', f'fill="{color}"')
    path.write_text(source, encoding='utf-8')
