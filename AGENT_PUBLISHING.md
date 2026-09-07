# Інструкція для агента: публікація на GitHub Pages

Цей застосунок лежить локально в папці:

```text
C:\Users\Vlad\Documents\Codex\2026-09-04\pwa-pwa-indexeddb-google-sheets-apps\outputs\training-journal
```

GitHub repository:

```text
vgrugor/training-journal
```

GitHub Pages URL:

```text
https://vgrugor.github.io/training-journal/
```

## Важливо

Локальна папка `outputs/training-journal` зараз не є git-репозиторієм. Тому не треба очікувати, що спрацює звичайний `git commit` / `git push` з цієї папки.

Поточний робочий спосіб публікації: через GitHub MCP tools:

- `mcp__codex_apps__github._fetch_file`
- `mcp__codex_apps__github._create_file`
- `mcp__codex_apps__github._update_file`

Якщо GitHub tools ще не доступні в контексті, спочатку викликати `tool_search` із запитом на кшталт:

```text
GitHub fetch update file contents repository
```

## Типовий порядок роботи

1. Внести зміни локально в `outputs/training-journal`.
2. Перевірити JS-синтаксис:

```powershell
node --check .\outputs\training-journal\src\some-file.js
```

3. Якщо змінювався JS/CSS/HTML або додавався новий файл, оновити `service-worker.js`:

```js
const CACHE_NAME = "personal-day-journal-v82";
```

Версію кешу треба збільшувати щоразу, щоб PWA на телефоні підтягувала нову версію.

4. Якщо додано новий файл, додати його в масив `ASSETS` у `service-worker.js`.
5. Опублікувати файли в GitHub repository через MCP.
6. Після публікації перевірити GitHub-версію через `_fetch_file`.

## Як оновити існуючий файл на GitHub

1. Спочатку отримати файл і його `sha`:

```json
{
  "repository_full_name": "vgrugor/training-journal",
  "path": "src/example.js",
  "encoding": "utf-8"
}
```

2. Потім викликати `_update_file` з повним новим вмістом файлу:

```json
{
  "repository_full_name": "vgrugor/training-journal",
  "path": "src/example.js",
  "sha": "SHA_FROM_FETCH_FILE",
  "message": "Short commit message",
  "content": "FULL UTF-8 FILE CONTENT"
}
```

GitHub contents API замінює файл цілком. Не передавати тільки diff.

## Як створити новий файл на GitHub

1. Можна спробувати `_fetch_file`.
2. Якщо відповідь `404 Not Found`, створити файл через `_create_file`:

```json
{
  "repository_full_name": "vgrugor/training-journal",
  "path": "src/new-file.js",
  "message": "Add new file",
  "content": "FULL UTF-8 FILE CONTENT"
}
```

3. Після цього не забути:

- підключити файл у loader або HTML;
- додати файл у `service-worker.js` `ASSETS`;
- підняти `CACHE_NAME`.

## Поточна архітектурна особливість

Через те, що `src/app.js` великий і GitHub-версія іноді може відрізнятися від локальної, останні доробки часто робилися окремими маленькими файлами-надбудовами:

- `src/technical-progress.js`
- `src/cycling-load-progress.js`
- `src/progress-explanations.js`
- `src/strength-forecast.js`

Вони підключаються через `src/mobile-nav.js`, який динамічно додає `<script>`.

Це зроблено, щоб:

- не перезаписувати великий `app.js`;
- зменшити ризик зламати кодування українського тексту;
- простіше публікувати точкові зміни через GitHub MCP.

## Перевірка після публікації

Після `_update_file` або `_create_file` обов'язково зробити `_fetch_file` для ключових рядків.

Наприклад:

```json
{
  "repository_full_name": "vgrugor/training-journal",
  "path": "service-worker.js",
  "start_line": 1,
  "end_line": 20,
  "encoding": "utf-8"
}
```

Треба перевірити:

- `CACHE_NAME` має нову версію;
- новий файл є в `ASSETS`;
- новий файл підключений у `mobile-nav.js` або `index.html`;
- ключова логіка справді є на GitHub.

## GitHub Pages

Окремої команди deploy немає. GitHub Pages бере файли напряму з repository. Після оновлення файлів через MCP GitHub Pages сам оновлює сайт.

Зазвичай треба почекати від кількох секунд до кількох хвилин.

Для PWA на телефоні важливо саме оновлення `service-worker.js`:

- якщо `CACHE_NAME` не змінити, телефон може залишитися на старих файлах;
- якщо файл доданий, але не доданий у `ASSETS`, офлайн-версія може його не мати.

## Що казати користувачу після публікації

Фінальна відповідь має бути коротка:

- що саме змінено;
- що опубліковано на GitHub Pages;
- яка версія кешу PWA;
- чи пройшли локальні перевірки.

Наприклад:

```text
Готово. Змінив ..., опублікував на GitHub Pages, кеш PWA оновлений до personal-day-journal-v82. Перевірка JS-синтаксису пройшла.
```
