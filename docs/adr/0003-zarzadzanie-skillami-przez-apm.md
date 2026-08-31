# Zarządzanie skillami agentów przez APM

Zarządzanie zależnościami skilli asystentów AI (Claude, Codex, Antigravity) powierzamy narzędziu APM (Agent Package Manager).

Wybieramy deklaratywny rozdział na pakiet projektowy w korzeniu repozytorium oraz niezależny podpakiet w `packages/mattpocock-skills` zawierający przenośną deklarację globalnego zestawu skilli użytkownika. Podpakiet globalny jest zagnieżdżony w repozytorium wyłącznie jako punkt odniesienia i deklaracja instalacyjna — nie uruchamia się podczas standardowej instalacji projektu ani w procesie CI aplikacji.

Wygenerowane skille dla obsługiwanych targetów (`.agents/skills`, `.claude/skills`, `.codex`) oraz pliki `apm.lock.yaml` commitujemy bezpośrednio do repozytorium, co zapewnia natychmiastową dostępność narzędzi po sklonowaniu (zero-install) oraz umożliwia niezależną kontrolę driftu (`apm audit --ci`) w CI bez modyfikowania checkoutu. Cache pakietów `apm_modules/` pozostaje niecommitowany.

APM odpowiada wyłącznie za deterministyczną dystrybucję identycznych plików skilli i weryfikację ich integralności, nie tłumacząc automatycznie semantyki zależnej od konkretnego agenta. Wyszukiwanie `apm search` ogranicza się do zarejestrowanych repozytoriów marketplace i nie zastępuje wyszukiwania w całym serwisie GitHub.
