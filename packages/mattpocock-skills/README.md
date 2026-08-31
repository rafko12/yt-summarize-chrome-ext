# mattpocock-skills

Pakiet zawiera przenośną deklarację zestawu 35 globalnych skilli autorstwa Matta Pococka (`mattpocock/skills`) dla asystentów AI: Claude, Codex oraz Antigravity.

Pakiet jest zagnieżdżony w repozytorium jako samodzielny podpakiet i nie uruchamia się podczas standardowej instalacji zależności projektu YT Summarizer ani w procesie CI aplikacji.

## Wspierane środowiska (targety)

Manifest [`apm.yml`](apm.yml) deklaruje dystrybucję do trzech targetów:

- **Claude** (`.claude/skills/` lub `~/.claude/skills/`)
- **Codex** (`.codex/` lub profil Codexa)
- **Antigravity** (`.agents/skills/` lub `~/.agents/skills/`)

> [!NOTE]
> APM odpowiada za bezpieczną, deterministyczną dystrybucję identycznych plików skilli i weryfikację ich skrótów kryptograficznych. Narzędzie nie wykonuje automatycznej translacji składni ani semantyki specyficznej dla poszczególnych agentów (instrukcje zoptymalizowane pod Claude Code trafiają do wszystkich targetów w oryginalnej postaci).

## Instalacja na nowym systemie

Aby wdrożyć globalny zestaw skilli na nowej maszynie roboczej:

1. Upewnij się, że masz zainstalowane CLI APM (rekomendowana wersja `0.29.0`).
2. Przejdź do katalogu podpakietu:
   ```bash
   cd packages/mattpocock-skills
   ```
3. Wykonaj instalację na podstawie przypiętego lockfile'a:
   ```bash
   apm install
   ```

Polecenie odtworzy stan z pliku [`apm.lock.yaml`](apm.lock.yaml) (hashe SHA-256 oraz przypięty commit upstreamu), instalując dokładnie zadeklarowane 35 skilli bez automatycznego podnoszenia ich wersji.

## Podgląd i kontrolowana aktualizacja

Zwykłe polecenie `apm install` zawsze korzysta z lockfile'a i nie modyfikuje wersji zależności. Aby zaktualizować skille do nowszych wydań z upstreamu:

1. **Podgląd planowanych zmian (dry-run)**:
   ```bash
   apm update --dry-run
   ```
   Pozwala to zweryfikować listę modyfikowanych skilli przed wprowadzeniem zmian na dysku.
2. **Zastosowanie aktualizacji**:
   ```bash
   apm update
   ```
   Aktualizacja pobierze nowe wersje i zaktualizuje `apm.lock.yaml`.
3. **Audyt spójności**:
   ```bash
   apm audit --ci
   ```

## Wyszukiwanie skilli (`apm search`)

Polecenie `apm search <fraza>` przeszukuje wyłącznie zarejestrowane lokalnie repozytoria marketplace (np. skonfigurowane w rejestrze APM). Nie stanowi ono zamiennika dla pełnotekstowego przeszukiwania całego serwisu GitHub.

## Procedura odzyskiwania profilu z kopii zapasowej

Przed wykonaniem migracji lub przełączeniem globalnego profilu zaleca się zachowanie kopii bezpieczeństwa dotychczasowych katalogów skilli.

W przypadku wystąpienia problemów podczas instalacji lub przełączania profilu:

1. Zlokalizuj utworzoną kopię zapasową (np. w katalogu `%TEMP%\skills-backup-*`).
2. Usuń uszkodzone lub niepełne katalogi skilli w profilu użytkownika (`~/.claude/skills`, `~/.codex`, `~/.agents/skills`).
3. Przywróć pliki z kopii zapasowej do odpowiednich ścieżek docelowych.
4. Sprawdź poprawność działania asystentów w nowej sesji terminala.
