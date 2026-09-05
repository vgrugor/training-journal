# Особистий журнал дня

Мінімальний offline-first PWA для персонального журналу дня, силових тренувань, велотренувань і добавок.

## Запуск локально

Відкрийте папку проєкту через будь-який статичний сервер. Наприклад:

```bash
python -m http.server 8080
```

Потім відкрийте:

```text
http://localhost:8080
```

## GitHub Pages

1. Створіть репозиторій на GitHub, наприклад `training-journal`.
2. Завантажте в нього всі файли з цієї папки.
3. У репозиторії відкрийте `Settings` -> `Pages`.
4. Оберіть джерело `Deploy from a branch`.
5. Вкажіть гілку `master` і папку `/root`.
6. Відкрийте видану адресу на телефоні.
7. У браузері виберіть `Add to Home Screen`.

Застосунок зберігає дані локально в IndexedDB на пристрої. GitHub Pages лише віддає статичні файли через HTTPS.

## Ручний backup у Google Sheets

1. Створіть нову Google Sheets таблицю.
2. Відкрийте `Extensions` -> `Apps Script`.
3. Вставте код з файлу `apps-script.gs`.
4. У рядку `const BACKUP_KEY = "change-this-key";` замініть `change-this-key` на власний довгий ключ.
5. Натисніть `Deploy` -> `New deployment`.
6. Тип deployment: `Web app`.
7. `Execute as`: `Me`.
8. `Who has access`: `Anyone`.
9. Скопіюйте Web app URL.
10. У застосунку відкрийте `Довідники`, вставте Web app URL і той самий ключ.

Кнопка `Зберегти в Google Sheets` записує повний JSON-знімок IndexedDB у лист `backup`.
Кнопка `Відновити з Google Sheets` замінює локальні дані останнім збереженим backup-знімком.

## Дані

Перший реліз має такі сховища IndexedDB:

- `days`
- `strengthWorkouts`
- `cyclingWorkouts`
- `exercises`
- `bands`
- `supplements`
- `supplementIntakes`

Google Sheets backup у цьому релізі працює як ручний повний знімок даних. Це ще не двостороння синхронізація по окремих записах.
