# Goliat System 8.1 / Context Shift

Reconstrucción completa del sistema de administración para gimnasios. Conserva el stack React + TypeScript + Vite + Tailwind, Zustand, Node.js + Express, SQL Server, Socket.IO, Google Gemini, PDFKit y WhatsApp Web, con una arquitectura modular y una interfaz nueva.

La interfaz usa una dirección visual **Goliat Apex** sin repetir el mismo tablero entre módulos. Control funciona como un circuito operativo con ruta financiera animada, cinta de datos, faders mensuales y agenda; Caja, como una máquina de cobro con odómetro y cinta de movimientos; Atletas, como una red paginada de nodos con comandos contextuales; y WhatsApp se concentra en sus tres verificaciones reales. GSAP controla accesos, cambios de estado, trazos, texto, arrastre con inercia y transiciones de distribución; Sileo concentra la retroalimentación de operaciones asíncronas.

> **Importante:** Goliat no incluye una base de datos ni esquemas, migraciones o scripts SQL propios. `server/src/config/sqlServer.js` solamente abre una conexión hacia la base que ya existe usando las variables de tu `.env` original. El repositorio externo `exercises-dataset` se conserva íntegro, incluidos sus ejemplos educativos de exportación a distintos motores; Goliat no los importa ni los ejecuta.

## Qué incluye

- Autenticación con contraseña cifrada y token de sesión firmado.
- Altas, edición, archivo lógico y renovación de atletas.
- Transacciones SQL para que atleta, membresía y pago se registren como una sola operación.
- Montos calculados en el servidor; el navegador no decide el precio de una renovación.
- Control reconstruido como una consola continua, no como un tablero de tarjetas: combina circuito SVG animado, métricas de caja, cinta cinética, secuencia mensual arrastrable y agenda de renovaciones. Su paleta usa carbón, marfil, cobre y latón para compartir el lenguaje material de Caja sin repetir su estructura.
- Campo de atletas con búsqueda, filtros y paginación de 25/50/100 nodos compactos; aumentó la escala tipográfica operativa y en móvil cambia a una sola columna para conservar nombres completos. El panel de acciones es un popover contextual montado fuera del roster: sigue visualmente al atleta seleccionado sin ocupar una celda, desplazar nodos ni alterar la altura de la cuadrícula.
- Los filtros de Atletas desacoplan Flip de la animación inicial, limpian estilos GSAP residuales y conservan visibles todos los resultados incluso después de cambios rápidos o filtros vacíos.
- Tipografías DM Sans y Space Grotesk servidas localmente para evitar dependencias visuales y avisos de red en la consola del navegador.
- Caja reconstruida con odómetro histórico, cinta de cobros arrastrable, distribución por método y bitácora densa; no reutiliza la composición de Control.
- Historial financiero compatible con las tablas existentes: archivar un atleta desactiva su membresía pero conserva `Members`, `Payments` y sus planes.
- Coach con Gemini, historial automático y tres documentos: entrenamiento, nutrición e integral. El plan terminado no se imprime dentro del chat; se descarga o envía como PDF.
- PDF multipágina con tablas de sesiones, ejercicios, comidas y bitácora semanal, en lugar de volcar Markdown sin formato.
- Atlas integrado de extremo a extremo: conserva su cuadrícula visual dentro del Coach y el servidor resuelve ejercicios canónicos para que el PDF incluya nombre, objetivo, equipo e identificador.
- Integración completa de `exercises-dataset`: 1,324 ejercicios, 9 idiomas y todos sus recursos visuales.
- Biblioteca con búsqueda, filtros, paginación, tarjetas de proporción estable y detalle animado.
- WhatsApp Web inicia automáticamente, restaura LocalAuth y transforma la interfaz al conectarse sin recopilar metadatos del dispositivo, IP ni ubicación.
- Alertas en tiempo real y recordatorios diarios de WhatsApp.
- Sileo para estados de carga, éxito y error sin duplicar avisos dentro de cada formulario.
- Animación responsive con MotionPath, MorphSVG, Observer, Draggable, InertiaPlugin, `useGSAP`, ScrollTrigger, SplitText, ScrambleText, DrawSVG, Flip y objetivos DOM verificados.
- Error boundary global para recuperar un módulo sin derribar toda la aplicación.
- Compatibilidad con rutas previas del proyecto como `/api/renew`, `/api/ai/save-plan` y `/api/ai/send-whatsapp`, además de las rutas nuevas organizadas por dominio.

## Estructura

```text
GoliatSystem/
├── client/
│   └── src/
│       ├── app/             # Rutas y protección de sesión
│       ├── components/ui/   # Componentes visuales reutilizables
│       ├── features/        # Módulos por dominio
│       ├── layouts/         # Navegación principal
│       ├── lib/             # API, formato, pagos, avisos y movimiento
│       ├── stores/          # Estado global
│       ├── styles/          # Sistema visual
│       └── types/           # Contratos TypeScript
├── server/
│   └── src/
│       ├── config/          # Entorno y SQL Server
│       ├── core/            # Errores y utilidades HTTP
│       ├── middleware/      # Autenticación y errores
│       ├── repositories/    # Acceso transaccional a datos
│       ├── routes/          # Endpoints por dominio
│       ├── services/        # IA, PDF, WhatsApp y catálogo
│       └── utils/           # Validaciones y normalización
└── resources/
    └── exercises-dataset/   # Repositorio externo completo
```

## Instalación

Requiere Node.js 20.19 o superior y acceso a la base SQL Server que ya utiliza el proyecto original. Esta entrega no contiene scripts para crear, alterar o migrar la base de datos.

1. Copia tu archivo `server/.env` del proyecto original dentro de esta nueva carpeta `server/`. No ejecutes scripts SQL: no se necesita crear ni modificar ninguna tabla. El backend conserva los nombres y columnas originales de `Users`, `Plans`, `Members`, `Subscriptions`, `Payments` y `AthletsPlans`.
2. Copia `client/.env.example` como `client/.env`.
3. Desde la raíz ejecuta:

```bash
npm run install:all
```

Si solo quieres trabajar sin WhatsApp o tu servidor no puede descargar Chrome durante la instalación, instala el backend con `PUPPETEER_SKIP_DOWNLOAD=true npm --prefix server install`. Para habilitar WhatsApp después necesitarás indicar un ejecutable de Chrome compatible en el entorno de despliegue.

4. Inicia servidor y cliente en terminales distintas:

```bash
npm run dev:server
npm run dev:client
```

El cliente abre en `http://localhost:5173` y el servidor en `http://localhost:3001`.

## Primer administrador

Solo si tu base existente todavía no tiene ningún usuario administrador, con el servidor activo puedes utilizar:

```bash
curl -X POST http://localhost:3001/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"una_contraseña_segura","setupKey":"la_clave_de_ADMIN_SETUP_KEY"}'
```

La ruta utiliza la tabla `Users` que ya existe y deja de aceptar altas después de encontrar el primer usuario. Si tu base ya tiene usuarios, no debes ejecutar este paso.

## WhatsApp y Gemini

- Define `GEMINI_API_KEY` para habilitar el coach.
- WhatsApp Web inicia automáticamente como en el proyecto original. No necesitas agregar `ENABLE_WHATSAPP` a tu `.env`.
- Únicamente en un host sin navegador puedes definir `ENABLE_WHATSAPP=false` para desactivarlo de forma explícita.
- En Linux o proveedores cloud, instala un navegador compatible con Puppeteer para utilizar WhatsApp.

## Verificación

```bash
npm test
npm run build
```

Los tests cubren normalización, validaciones, preparación del historial de Gemini, texto para PDF, compatibilidad de las consultas con la estructura original y verificación de que no existan esquemas/migraciones SQL propios del proyecto. La compilación TypeScript valida el contrato completo del cliente.

La renovación no depende de un identificador adicional de suscripción: consulta y actualiza usando `MemberID`, `PlanID`, `StartDate`, `EndDate` e `IsActive`, igual que el alta original. No se agregan columnas, tablas ni migraciones.

## Cobros simulados

Tarjeta y transferencia pasan por `client/src/services/payments/SimulatedPayment.ts` antes de crear el atleta o renovar la membresía. La terminal nunca almacena datos de tarjeta. Para personalizar la cuenta de demostración puedes definir `VITE_TRANSFER_BANK`, `VITE_TRANSFER_CLABE` y `VITE_TRANSFER_BENEFICIARY` en `client/.env`.

## Dataset y licencias

Consulta [THIRD_PARTY.md](THIRD_PARTY.md). Se conservaron todos los archivos, licencias y avisos del repositorio externo. Antes de reutilizar sus imágenes o GIF fuera de este sistema, revisa específicamente los términos de Gym visual incluidos por el autor del dataset.
