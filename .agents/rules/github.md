# GitHub i uwierzytelnienie sesji

- Dostęp SSH skonfigurowany w systemie nie musi być dostępny w bieżącej sesji agenta. Przed użyciem SSH sprawdź `ssh -o BatchMode=yes -T git@github.com`.
- Uwierzytelnienie GitHub CLI (`gh auth status -h github.com`) jest niezależne od klucza SSH. Sprawdzaj je osobno przed operacjami na Issues, PR-ach i API.
- Jeśli sesja nie widzi agenta SSH, katalogu `.ssh` albo `known_hosts`, nie zakładaj, że systemowe połączenie SSH jest dostępne dla agenta.
- Pomyślne `gh auth login` lub konfiguracja SSH w terminalu użytkownika nie potwierdza dostępu w sesji agenta; zawsze wykonaj testy z poziomu tej sesji.
- Nie ujawniaj tokenów, kluczy prywatnych ani zawartości plików uwierzytelniających w logach lub odpowiedziach.
- Nie przełączaj `origin` na SSH bez potwierdzenia działającego testu SSH w bieżącej sesji.
