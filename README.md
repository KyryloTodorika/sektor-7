# sektor-7-backup

Ein kleiner Singleplayer-Ego-Shooter für Desktop-Browser mit drei einzeln auswählbaren Missionen und automatischem Übergang zwischen den Leveln. Babylon.js rendert echte 3D-Räume über WebGL 2; TypeScript enthält die Spiellogik, Vite startet den Entwicklungsserver und erstellt den statischen Build.

## Starten

Voraussetzung: Node.js 22.18+ oder 24+ und npm.

```sh
npm install
npm run dev
```

Die ausgegebene lokale URL im Desktop-Browser öffnen (normalerweise `http://localhost:5173`). Auf **Einsatz starten** klicken und die Maussteuerung erlauben. Auf entfernten Servern HTTPS verwenden. Das Spiel ist für Maus und Tastatur ausgelegt.

## Level auswählen

Im Hauptmenü stehen alle drei Level unabhängig zur Auswahl. Über **Zur Levelauswahl** im Pausen- oder Ergebnisbildschirm kannst du wechseln. Ein Neustart startet immer das ausgewählte Level neu.

- **Level 1 · Lockdown:** die ursprüngliche Forschungsstation mit sieben Wachdrohnen, Türen und Zugangskarte. Grundriss und Missionsablauf bleiben erhalten.
- **Level 2 · Dead Coast:** eine Küstenstadt unter offenem Himmel mit 16 Palmen, sechs verlassenen Autos, vier Bränden mit animierten Flammen und Rauch, Meerblick und 18 Zombies. Finde das Funkgerät am Kontrollpunkt Nord und betrete mit **E** das Safehouse im Hotel Miramar. Die Zombies verfolgen dich und greifen im Nahkampf an.

- **Level 3 · Lakehouse:** ein an CS:GO Lake angelehntes Seegrundstück mit zweigeschossigem Seehaus, begehbarer Treppe, Balkon, Garage, Baustelle, Bootssteg und 14 gelben Gummienten. Suche den Bootsschlüssel im Obergeschoss und lege am Fluchtboot mit **E** ab. Die Enten watscheln hinter dir her, benutzen die Treppe und greifen im Nahkampf an.

Direktlinks nach dem Serverstart: `http://localhost:5173/?level=1`, `http://localhost:5173/?level=2` und `http://localhost:5173/?level=3`.

Nach dem Missionsabschluss folgt ein Countdown von drei Sekunden. Anschließend startet das nächste Level automatisch: **Lockdown → Dead Coast → Lakehouse**. Die Maus bleibt dabei im Spiel gefangen; ein weiterer Klick ist nicht nötig. Gesundheit und Munition werden für den neuen Einsatz aufgefüllt. **Escape** pausiert auch den Countdown. Über **Zur Levelauswahl** lässt sich der automatische Übergang abbrechen. Nach Level 3 erscheint das Abschlussbild; die Kampagne startet nicht von vorne.

Das neue Seehaus verwendet selbst erstellte Geometrie und Texturen. Als gestalterische Referenz dient [Valves Lake aus CS:GO](https://steamcommunity.com/sharedfiles/filedetails/?id=125440557).

## Spielen

| Taste           | Aktion                                              |
| --------------- | --------------------------------------------------- |
| WASD            | Bewegen                                             |
| Maus            | Umsehen                                             |
| Linke Maustaste | Einzelschuss                                        |
| R               | Nachladen                                           |
| E               | Tür bedienen / Missionsausgang benutzen             |
| Shift           | Sprinten                                            |
| Leertaste       | Springen                                            |
| Escape          | Maus freigeben und pausieren                        |
| Pfeiltasten     | Alternative Vorwärts-/Rückwärtsbewegung und Drehung |

**Level 1:** Finde die leuchtend blaue Zugangskarte im Sicherheitslabor C–02 und erreiche das grün leuchtende Ausgangsfeld in der Frachtschleuse D–04. Betätige dort **E**. Sieben Wachdrohnen verteidigen die Anlage. Gelbe Pakete enthalten Munition, grüne Pakete heilen. Türen lassen sich aus der Nähe mit **E** öffnen. Das Spiel pausiert bei Fokusverlust.

Mausempfindlichkeit, Lautstärke, Grafikqualität und FPS-Anzeige lassen sich über das Zahnrad im Hauptmenü oder die Einstellungen im Pausenmenü ändern. Einstellungen werden, sofern verfügbar, lokal gespeichert.

## Prüfen und bauen

```sh
npm test
npm run build
npm run preview
```

Der Build liegt in `dist/` und kann von einem statischen Webserver ausgeliefert werden. Die Tests prüfen für alle drei Level erreichbare Missionsziele, Kollisionen, Levelwechsel und für Level 1 unveränderte Missionsdaten. Für Lakehouse prüfen sie zusätzlich die Treppe, Stockwerke, Entenverfolgung und den Höhenschutz beim Einsammeln des Schlüssels. Der automatische Ablauf und die Pause während des Countdowns werden ebenfalls geprüft. Zusätzlich prüfen sie Schießen, Nachladen, Pause, Springen, Gegnerangriffe, Neustart und das Missionsende mit Babylons NullEngine. Die NullEngine prüft die Spiellogik und Szenengeometrie, ersetzt aber keinen sichtbaren Browser-Test. Ein FPS-Ziel von 60 ist noch keine Hardware-Garantie: auf den gewünschten Zielgeräten messen.

## Aufbau

- `src/game/level.ts`: Levelraster, Kollisionen, Sichtprüfung und Wegsuche.
- `src/game/levels.ts`: getrennte Leveldefinitionen, Ziele, Spawnpunkte und Auswahl.
- `src/game/lake-level.ts`: Seegrundstück, Höhen, Treppe, Balkon und Missionsobjekte.
- `src/game/lake-world.ts`: zweigeschossiges Seehaus, rotes Dach, Garage, Baustelle, Ufer, Steg und Boot.
- `src/game/ducks.ts`: Gummienten, Watscheln, Höhenwechsel und Nahkampf.
- `src/game/outdoor-level.ts`: Straßenverlauf, Autos, Palmen, Zombies und Vorräte von Level 2.
- `src/game/outdoor-world.ts`: Außenareal, Gebäude, Meer, Palmen, Autos, Feuer und Rauch.
- `src/game/zombies.ts`: Zombie-Modelle, Verfolgung und Nahkampfangriffe.
- `src/game/navigation.ts`: Navigation für eigenständige zusätzliche Level.
- `src/game/world.ts`: Geometrie, prozedurale Texturen, Licht, Beschilderung und Türen.
- `src/game/game.ts`: Spielzustand, feste Physikschritte, Eingaben, Treffer, Inventar und Missionsende.
- `src/game/enemies.ts`: Wachdrohnen, Sichtkontakt, Wegsuche und Angriffe.
- `src/game/weapon.ts`: Kamerawaffe, Rückstoß und Nachladeanimation.
- `src/game/babylon.ts`: gezielte Engine-Imports für ein kleines Browser-Paket.
- `tests/game.integration.test.mjs`: Integrationstests der Spielsysteme mit Babylons NullEngine.
- `src/game/audio.ts`: synthetisierte Soundeffekte über Web Audio.
- `src/main.ts` und `src/style.css`: Menü, HUD, Pause, Einstellungen und Ergebnisanzeige.

Modelle, Texturen und Soundeffekte werden im Code erzeugt. Die Menüschrift wird von Google Fonts geladen; ohne Verbindung greifen lokale Ersatzschriften. Es werden keine Originaldateien aus Doom oder Half-Life verwendet. Spielstände werden in dieser ersten Version nicht gespeichert.
