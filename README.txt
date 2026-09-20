# Buscador PRC — GitHub Pages

Archivos incluidos:
- `index.html`: aplicación.
- `manifest.webmanifest`: configuración de web app.
- `sw.js`: funcionamiento offline después de la primera carga.
- `icon.svg` y `apple-touch-icon.png`: iconos.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `buscador-prc`.
2. Sube **todos los archivos de esta carpeta a la raíz del repositorio**.
3. En GitHub entra en **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`.
6. Guarda. GitHub te mostrará la dirección pública, normalmente:
   `https://TU-USUARIO.github.io/buscador-prc/`
7. Abre esa dirección en Safari en el iPhone.
8. Pulsa **Compartir → Añadir a pantalla de inicio**.

Después de abrirla una vez con conexión, el service worker guarda la aplicación para poder usarla también sin conexión.
