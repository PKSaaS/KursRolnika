# Kurs Rolnika 🌾

Aplikacja do nauki do kursu rolnika: notatki, fiszki (powtórki 1/2/4/8/16 dni) i testy jednokrotnego wyboru.

- **Podstawy produkcji roślinnej** – moduły I–VIII
- **Teoria BHP** – moduły I–II

Live: https://pksaas.github.io/KursRolnika/

## Aktualizacja treści
Treść modułów jest w `content/<id>.json` (`notes`, `flashcards`, `quiz`). Po zmianie uruchom `python3 build.py`, który generuje `data.js`, i podbij `?v=N` w `index.html`.
