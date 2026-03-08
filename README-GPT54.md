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

## Note

- La pagina usa `face-api.js` e carica libreria e modelli da CDN remota.
- I descrittori facciali vengono salvati in `localStorage` del browser.
- Il layout è fisso per schermo desktop.
- La colonna destra mantiene la struttura richiesta ma mostra solo visualizzazioni diagnostiche non operative.
