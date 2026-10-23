/**
 * "Learn Python by typing": short, runnable programs in learning order. The
 * note explains the idea in Turkish; the code stays ASCII so it can be typed
 * on a US layout.
 */

export type CodeLesson = {id: string; title: string; note: string; code: string};

export const pythonLessons: CodeLesson[] = [
  {
    id: 'py-print',
    title: 'Ekrana yazdırma ve değişkenler',
    note: 'print() ekrana yazar. Değişkene = ile değer verilir, türünü Python kendisi anlar. f"..." içindeki {} değişkenin değerini metne koyar.',
    code: `name = "Ada"
age = 28
print("Hello,", name)
print(f"{name} is {age} years old")`,
  },
  {
    id: 'py-numbers',
    title: 'Sayılar ve işlemler',
    note: '/ her zaman ondalıklı bölme yapar; // tam sayı bölmesi, % kalan, ** üs alma. round() yuvarlar.',
    code: `price = 149.90
count = 3
total = price * count
print(total)
print(17 // 5, 17 % 5)
print(2 ** 10)
print(round(total, 1))`,
  },
  {
    id: 'py-strings',
    title: 'Metinler',
    note: 'Metinlerin hazır metotları vardır: upper, lower, strip, replace, split. [0] ilk karakter, [-1] son karakter, [a:b] bir dilim verir.',
    code: `text = "  Python is fun  "
clean = text.strip()
print(clean.upper())
print(clean.replace("fun", "great"))
words = clean.split()
print(words, len(words))
print(clean[0], clean[-1], clean[:6])`,
  },
  {
    id: 'py-lists',
    title: 'Listeler',
    note: 'Liste köşeli parantezle yazılır, sırası korunur ve değiştirilebilir. append sona ekler, pop sondan çıkarır, sort sıralar.',
    code: `langs = ["java", "python", "go"]
langs.append("rust")
langs.sort()
print(langs)
first = langs[0]
last = langs.pop()
print(first, last, len(langs))
print("python" in langs)`,
  },
  {
    id: 'py-if',
    title: 'Koşullar',
    note: 'if / elif / else bloğu girintiyle belirlenir; süslü parantez yoktur. and, or, not mantık işleçleridir.',
    code: `score = 72
if score >= 90:
    grade = "A"
elif score >= 70:
    grade = "B"
else:
    grade = "C"
print(grade)
if score > 50 and score != 100:
    print("passed, keep going")`,
  },
  {
    id: 'py-for',
    title: 'for döngüsü',
    note: 'for her elemanı sırayla gezer. range(n) 0\'dan n-1\'e kadar sayılar üretir. Java\'daki for (int i = 0; ...) yerine budur.',
    code: `for i in range(3):
    print("round", i)

total = 0
for n in [4, 8, 15, 16, 23, 42]:
    total += n
print("sum:", total)

for ch in "abc":
    print(ch.upper())`,
  },
  {
    id: 'py-while',
    title: 'while, break ve continue',
    note: 'while koşul doğru olduğu sürece döner. break döngüden çıkar, continue o turu atlayıp sonrakine geçer.',
    code: `n = 10
while n > 0:
    n -= 3
    if n == 4:
        continue
    print(n)

while True:
    answer = "yes"
    if answer == "yes":
        break`,
  },
  {
    id: 'py-functions',
    title: 'Fonksiyonlar',
    note: 'def ile fonksiyon tanımlanır, return değer döndürür. Parametrelere varsayılan değer verilebilir; çağırırken isimle de geçilebilir.',
    code: `def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

def area(width, height):
    return width * height

print(greet("Ada"))
print(greet("Can", greeting="Hi"))
print(area(3, 4))`,
  },
  {
    id: 'py-dicts',
    title: 'Sözlükler',
    note: 'Sözlük anahtar: değer çiftleri tutar (Java\'daki HashMap gibi). get olmayan anahtarda hata yerine varsayılanı döndürür, items çiftleri gezer.',
    code: `ages = {"ada": 28, "can": 35}
ages["ece"] = 22
print(ages["ada"])
print(ages.get("deniz", 0))
for name, age in ages.items():
    print(name, age)
del ages["can"]
print(len(ages))`,
  },
  {
    id: 'py-comprehensions',
    title: 'Liste üreteçleri',
    note: 'Bir listeyi tek satırda üretir: [ifade for x in kaynak if koşul]. Python\'da döngü yazmanın en sık görülen kısa yoludur.',
    code: `numbers = range(10)
squares = [n * n for n in numbers]
evens = [n for n in numbers if n % 2 == 0]
names = ["ada", "can", "ece"]
upper = [name.upper() for name in names]
lengths = {name: len(name) for name in names}
print(squares, evens)
print(upper, lengths)`,
  },
  {
    id: 'py-tuples-sets',
    title: 'Demet ve küme',
    note: 'Demet (tuple) değiştirilemeyen listedir, birden çok değer döndürmek için kullanılır. Küme (set) tekrar etmeyen elemanlar tutar.',
    code: `point = (3, 4)
x, y = point
print(x + y)

def min_max(items):
    return min(items), max(items)

low, high = min_max([7, 2, 9])
tags = {"java", "python", "java"}
tags.add("sql")
print(low, high, tags)`,
  },
  {
    id: 'py-errors',
    title: 'Hata yakalama',
    note: 'try içinde oluşan hata except ile yakalanır. finally her durumda çalışır. raise ile kendin hata fırlatırsın.',
    code: `def parse_age(text):
    try:
        age = int(text)
    except ValueError:
        return None
    if age < 0:
        raise ValueError("age must be positive")
    return age

print(parse_age("42"))
print(parse_age("abc"))`,
  },
  {
    id: 'py-files',
    title: 'Dosya okuma ve yazma',
    note: 'with open(...) dosyayı açar ve blok bitince kendisi kapatır. "w" yazar, "a" sona ekler, okurken satır satır gezilebilir.',
    code: `with open("notes.txt", "w") as f:
    f.write("first line\\n")
    f.write("second line\\n")

with open("notes.txt") as f:
    for line in f:
        print(line.strip())`,
  },
  {
    id: 'py-classes',
    title: 'Sınıflar',
    note: '__init__ kurucudur, self Java\'daki this gibidir ve açıkça yazılır. __repr__ nesnenin yazdırılınca nasıl görüneceğini belirler.',
    code: `class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def __repr__(self):
        return f"Account({self.owner}, {self.balance})"

acc = Account("Ada")
acc.deposit(100)
print(acc)`,
  },
  {
    id: 'py-modules',
    title: 'Modüller',
    note: 'import ile standart kütüphane kullanılır. from ... import ile sadece gerekeni alırsın. math, random ve datetime en sık kullanılanlardandır.',
    code: `import math
import random
from datetime import date

print(math.sqrt(16), math.pi)
dice = random.randint(1, 6)
print("dice:", dice)
today = date.today()
print(today.year, today.month)`,
  },
  {
    id: 'py-sorting',
    title: 'Sıralama ve lambda',
    note: 'sorted yeni bir liste döndürür; key ile neye göre sıralanacağını söylersin. lambda tek satırlık isimsiz fonksiyondur.',
    code: `people = [("ada", 28), ("can", 35), ("ece", 22)]
by_age = sorted(people, key=lambda p: p[1])
print(by_age)
oldest = max(people, key=lambda p: p[1])
print(oldest[0])
words = ["kiwi", "fig", "banana"]
print(sorted(words, key=len, reverse=True))`,
  },
  {
    id: 'py-enumerate-zip',
    title: 'enumerate ve zip',
    note: 'enumerate sıra numarasını da verir, zip iki listeyi eş eş gezer. İndeksle uğraşmadan döngü kurmanın Python yoludur.',
    code: `tasks = ["write", "test", "ship"]
for i, task in enumerate(tasks, start=1):
    print(i, task)

names = ["ada", "can"]
scores = [91, 78]
for name, score in zip(names, scores):
    print(f"{name}: {score}")`,
  },
  {
    id: 'py-args',
    title: '*args ve **kwargs',
    note: '*args istediğin kadar konumlu argümanı demet olarak, **kwargs isimli argümanları sözlük olarak toplar.',
    code: `def total(*args):
    return sum(args)

def describe(**kwargs):
    for key, value in kwargs.items():
        print(key, "=", value)

print(total(1, 2, 3, 4))
describe(lang="python", level=2)`,
  },
  {
    id: 'py-dataclass',
    title: 'dataclass',
    note: '@dataclass, alanlardan kurucu ve __repr__ gibi metotları kendisi üretir. Java\'daki record\'a benzer.',
    code: `from dataclasses import dataclass, field

@dataclass
class Task:
    title: str
    done: bool = False
    tags: list = field(default_factory=list)

t = Task("learn python", tags=["daily"])
t.done = True
print(t)`,
  },
  {
    id: 'py-project',
    title: 'Mini proje: kelime sayacı',
    note: 'Öğrendiklerin bir arada: fonksiyon, sözlük, döngü, sıralama. Counter aynı işi tek satırda da yapar.',
    code: `from collections import Counter

def count_words(text):
    counts = {}
    for word in text.lower().split():
        word = word.strip(".,!?")
        counts[word] = counts.get(word, 0) + 1
    return counts

text = "the cat and the dog and the bird"
counts = count_words(text)
top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
print(top[:3])
print(Counter(text.split()).most_common(2))`,
  },
];
