import type {CodeLesson} from './python';

/** Everyday Java, for keeping the hands fluent with braces, generics and streams. */
export const javaLessons: CodeLesson[] = [
  {
    id: 'java-main',
    title: 'main ve println',
    note: 'Her Java programı bir sınıf içindeki main metoduyla başlar.',
    code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}`,
  },
  {
    id: 'java-variables',
    title: 'Değişkenler ve var',
    note: 'Türü açıkça yazabilir ya da var ile derleyiciye bırakabilirsin. final değişmeyen değerdir.',
    code: `int count = 3;
double price = 149.90;
final String name = "Ada";
var total = price * count;
boolean expensive = total > 400;
System.out.printf("%s: %.2f (%b)%n", name, total, expensive);`,
  },
  {
    id: 'java-strings',
    title: 'String ve StringBuilder',
    note: 'String değişmez; çok parça birleştirirken StringBuilder kullan.',
    code: `String text = "  Java is fun  ".trim();
System.out.println(text.toUpperCase());
System.out.println(text.contains("fun") + " " + text.length());
StringBuilder sb = new StringBuilder();
for (String word : text.split(" ")) {
    sb.append(word.charAt(0));
}
System.out.println(sb.reverse());`,
  },
  {
    id: 'java-arrays',
    title: 'Diziler ve döngüler',
    note: 'Klasik for, gelişmiş for ve Arrays yardımcıları.',
    code: `int[] numbers = {4, 8, 15, 16, 23, 42};
int sum = 0;
for (int i = 0; i < numbers.length; i++) {
    sum += numbers[i];
}
for (int n : numbers) {
    if (n % 2 == 0) System.out.print(n + " ");
}
Arrays.sort(numbers);
System.out.println(Arrays.toString(numbers) + " sum=" + sum);`,
  },
  {
    id: 'java-collections',
    title: 'List ve Map',
    note: 'List.of ve Map.of değiştirilemeyen koleksiyon üretir; değiştireceksen ArrayList ve HashMap.',
    code: `List<String> langs = new ArrayList<>(List.of("java", "python"));
langs.add("go");
Map<String, Integer> ages = new HashMap<>();
ages.put("ada", 28);
ages.merge("ada", 1, Integer::sum);
ages.putIfAbsent("can", 35);
for (Map.Entry<String, Integer> e : ages.entrySet()) {
    System.out.println(e.getKey() + " -> " + e.getValue());
}`,
  },
  {
    id: 'java-switch',
    title: 'switch ifadesi',
    note: 'Yeni switch ok sözdizimiyle değer döndürür, break gerekmez.',
    code: `String day = "SAT";
String type = switch (day) {
    case "SAT", "SUN" -> "weekend";
    case "MON", "TUE", "WED", "THU", "FRI" -> "weekday";
    default -> throw new IllegalArgumentException(day);
};
System.out.println(type);`,
  },
  {
    id: 'java-class',
    title: 'Sınıf, kurucu ve metot',
    note: 'Alanlar private, erişim metotlarla. this alanı parametreden ayırır.',
    code: `public class Account {
    private final String owner;
    private double balance;

    public Account(String owner) {
        this.owner = owner;
    }

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("amount");
        balance += amount;
    }

    public double getBalance() {
        return balance;
    }
}`,
  },
  {
    id: 'java-record',
    title: 'record ve interface',
    note: 'record veri taşıyan değişmez sınıfı tek satırda tanımlar. interface bir sözleşmedir.',
    code: `interface Shape {
    double area();
}

record Circle(double r) implements Shape {
    public double area() {
        return Math.PI * r * r;
    }
}

record Rect(double w, double h) implements Shape {
    public double area() {
        return w * h;
    }
}`,
  },
  {
    id: 'java-streams',
    title: 'Stream ile filtrele ve dönüştür',
    note: 'filter, map, sorted ve collect zinciri; döngü yazmadan veri işleme.',
    code: `List<String> names = List.of("ada", "can", "ece", "deniz");
List<String> result = names.stream()
    .filter(n -> n.length() == 3)
    .map(String::toUpperCase)
    .sorted(Comparator.reverseOrder())
    .collect(Collectors.toList());
int total = names.stream().mapToInt(String::length).sum();
System.out.println(result + " " + total);`,
  },
  {
    id: 'java-exceptions',
    title: 'Hata yakalama',
    note: 'try-with-resources kaynağı kendisi kapatır; birden çok hata | ile yakalanabilir.',
    code: `try (BufferedReader reader = Files.newBufferedReader(Path.of("notes.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
} catch (NoSuchFileException e) {
    System.err.println("missing: " + e.getMessage());
} catch (IOException | UncheckedIOException e) {
    throw new RuntimeException(e);
}`,
  },
  {
    id: 'java-optional',
    title: 'Optional ve lambda',
    note: 'Optional null yerine "belki değer" demektir; orElse, map ve ifPresent ile kullanılır.',
    code: `Optional<String> found = Stream.of("kiwi", "fig", "banana")
    .filter(f -> f.startsWith("b"))
    .findFirst();
found.ifPresent(f -> System.out.println("found " + f));
String upper = found.map(String::toUpperCase).orElse("none");
Comparator<String> byLength = Comparator.comparing(String::length);
System.out.println(upper + " " + byLength.compare("a", "bb"));`,
  },
  {
    id: 'java-generics',
    title: 'Generic metot',
    note: 'Tür parametresi <T> ile aynı kodu farklı türler için yazarsın; extends ile sınır koyarsın.',
    code: `public static <T extends Comparable<T>> T max(List<T> items) {
    if (items.isEmpty()) throw new NoSuchElementException();
    T best = items.get(0);
    for (T item : items) {
        if (item.compareTo(best) > 0) best = item;
    }
    return best;
}`,
  },
];
