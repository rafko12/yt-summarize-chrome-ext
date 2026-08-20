# Sterownik stanu panelu z adapterem Chrome

Logikę panelu bocznego wydzielamy do głębokiego modułu instalowanego jednym wywołaniem. Moduł ukrywa stan, odtwarzanie, kolejność operacji, trwałość i kompensacje, natomiast szczegóły `chrome.*` znajdują się w adapterze produkcyjnym, któremu odpowiada deterministyczny adapter testowy; rezygnujemy z publicznego rejestru polityk i generycznego interpretera efektów, ponieważ zwiększałyby koszt poznawczy bez potrzebnej dziś elastyczności.
