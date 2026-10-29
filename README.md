# backoffice-eslint-test

Repositorio de prueba para validar la configuración ESLint de documentación de código (BackOffice).

## Uso

```bash
npm install
npm run lint:valid     # debe terminar sin errores
npm run lint:invalid   # debe reportar errores en cada archivo
npm run lint           # todo el proyecto
```

## Estructura

- `src/valid/`: archivos que cumplen la plantilla (no deben generar errores).
- `src/invalid/`: archivos con un tipo de error cada uno. El comentario al inicio indica qué se espera.
- `hooks/pre-push`: hook para validar antes del push (copiar a `.git/hooks/pre-push`).
