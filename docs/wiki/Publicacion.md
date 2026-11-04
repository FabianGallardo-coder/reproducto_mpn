# Publicación

## Canales de publicación

El README, el sitio Pages, los iconos y las guías se versionan en el repositorio principal. Pages se despliega desde `main` mediante GitHub Actions. La Wiki es un repositorio separado: habilitarla en GitHub no la inicializa; necesita una primera página antes de aceptar un push.

## Publicar la Wiki

1. En GitHub, abrí la pestaña **Wiki** del repositorio.
2. Creá una primera página llamada **Home** y guardala.
3. Cloná el repositorio de la Wiki junto al proyecto, no dentro de su código:

```powershell
git clone https://github.com/FabianGallardo-coder/reproducto_mpn.wiki.git ..\reproducto_mpn.wiki
Copy-Item docs\wiki\*.md ..\reproducto_mpn.wiki\
Set-Location ..\reproducto_mpn.wiki
Get-ChildItem -File -Filter '*.md' | ForEach-Object {
    $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
    $text = $text -replace '\]\(([^)]+)\.md\)', ']($1)'
    Set-Content -LiteralPath $_.FullName -Value $text -Encoding UTF8
}
git add -- '*.md'
git commit -m "docs: publicar guias de FlowPlayer"
git push
```

La conversión quita la extensión `.md` de los enlaces dentro de la copia de la Wiki, que usa nombres de página en lugar de rutas del repositorio. Comprobá su navegación después de publicarlas. Las copias en `docs/wiki` son la fuente mantenida junto al código; no publiques cambios divergentes solamente en la Wiki.

## Publicar GitHub Pages

El sitio estático está en `docs/index.html`. No incluye backend Tauri ni pretende reproducir audio desde GitHub.

1. Revisá y subí el contenido de `docs`, el README y `.github/workflows/pages.yml`.
2. En **Settings > Pages > Build and deployment**, elegí **GitHub Actions**.
3. Ejecutá el workflow **Pages** o hacé push a `main` con cambios en `docs`.
4. Revisá la URL devuelta por el job de despliegue. La URL prevista es:
   `https://fabiangallardo-coder.github.io/reproducto_mpn/`

El workflow sube únicamente `docs`, no `dist`, dependencias ni datos de pruebas. Los recursos usan rutas relativas para funcionar bajo el subdirectorio del repositorio.

## Previsualizar localmente

Con Python disponible, desde la raíz:

```powershell
python -m http.server 5188 --bind 127.0.0.1 --directory docs
```

Abrí `http://127.0.0.1:5188`. Detené el servidor al terminar.

## Actualizar iconos y capturas

El favicon de la app es `public/favicon.svg`; los bundles usan los archivos generados en `src-tauri/icons`. El sitio mantiene una copia del vector en `docs/assets/icon.svg` para poder desplegarse de forma independiente.

Las capturas usan archivos originales de QA. No publiques capturas de una biblioteca personal, datos de cuentas ni contenido de terceros sin autorización. Si cambia la interfaz, reemplazá las imágenes y verificá README, Pages y Wiki.

## Licencia

Antes de distribuir, el titular debe establecer la licencia del proyecto y revisar los avisos de sus dependencias y binarios incluidos. No se asume MIT por una mención anterior en el README.
