# Local Face Lab

## Avvio locale

```bash
cd /percorso/alla/cartella/face_web_safe
python3 -m http.server 8000
```

Apri poi:

```text
http://localhost:8000/
```

## Cosa fa

- Mostra la webcam in tempo reale nel pannello centrale.
- Permette di scansionare, salvare e cercare volti nel database locale del browser.
- Mostra overlay di landmark e box facciale nella scansione.
- Offre una colonna destra con **guide makeup AR** live ancorate ai landmark del volto:
  - Graphic liner
  - Smokey eyes
  - Blush lift
  - Lip tint
  - Soft contour
  - Stage mask

## Note

- La pagina usa `face-api.js` e carica libreria e modelli da CDN remota.
- I descrittori facciali vengono salvati in `localStorage` del browser.
- Il layout è fisso per schermo desktop.
- Le guide makeup sono overlay cosmetici/artistici in sovraimpressione sulla webcam, non istruzioni operative per evasione biometrica.
