# BackOffice (ejemplo) – validación de documentación

Réplica del BackOffice (Webix Jet) para probar la validación de documentación:
ESLint - `eslint.config.mjs` + hook - `pre-push`.


## Estructura

```
sources/
  app.js                 clase JetApp (constructor + método)
  views/top.js           JetView con callback inline (arrow)
  views/users/list.js    JetView con callbacks inline, métodos async
  models/users.js        funciones exportadas con @throws
  services/api.js        función async con parámetro opcional y @throws
  utils/format.js        funciones en const (arrow y function)
hooks/pre-push           copia versionada del hook (el activo es .git/hooks/pre-push)
eslint.config.mjs        reglas de documentación
```

## Uso

```bash
npm install                          # instala ESLint
cp hooks/pre-push .git/hooks/pre-push   # instala el hook (git usa .git/hooks por defecto)
npm run lint                         # valida todo sources/
```

## Cómo probar

1. Crea una rama, daña la documentación de algún archivo de `sources/` (quita un `@param`,
   pon una descripción en minúscula, borra el encabezado, etc.) y haz commit.
2. `git push` → el hook valida solo los `.js` modificados en la rama y bloquea si hay errores.
3. Arregla la documentación, commit y push de nuevo → pasa.