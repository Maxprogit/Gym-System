# 🏋️ GOLIAT GYM SYSTEM

> Sistema de gestión para gimnasios con IA integrada, notificaciones automáticas por WhatsApp y generación de planes personalizados en PDF.

![Version](https://img.shields.io/badge/version-1.0.0-D4FF00?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![SQL Server](https://img.shields.io/badge/SQL_Server-2019+-red?style=for-the-badge&logo=microsoft-sql-server)

---

## ✨ Características Principales

### 📊 Dashboard en Tiempo Real
- Estadísticas de atletas activos, ingresos mensuales y membresías por vencer
- Gráfica de tendencia de ingresos de los últimos 6 meses
- Lista de vencimientos próximos con alertas visuales
- Notificaciones en tiempo real via Socket.io sin necesidad de recargar la página

### 👥 Gestión de Atletas
- Registro, edición y eliminación de atletas
- Búsqueda por nombre o ID en tiempo real
- Tarjetas con indicadores visuales de estado (activo/por vencer/vencido)
- Planes de membresía dinámicos desde la base de datos

### 💳 Sistema de Pagos
- 3 métodos de pago: Efectivo, Tarjeta y Transferencia SPEI
- Procesamiento simulado de pagos con tarjeta (arquitectura lista para pasarela real)
- Historial completo de pagos en la sección Caja
- Renovación de membresías con cambio de plan

### 🤖 Asistente IA con Google Gemini
- Chat interactivo para generar rutinas de entrenamiento personalizadas
- Generación de planes de dieta basados en objetivos y preferencias
- Historial de planes anteriores por atleta para mejora continua
- Generación automática de PDF con el plan completo
- Envío directo del PDF por WhatsApp al atleta

### 📱 Integración WhatsApp
- Notificaciones automáticas de vencimiento (3 días antes)
- Envío de planes personalizados en PDF directamente al atleta
- QR de vinculación desde el panel de administración
- Desvinculación remota sin acceso al servidor

### 🔒 Seguridad
- Autenticación con bcrypt (hashing de contraseñas)
- Sesiones con sessionStorage (expiran al cerrar el navegador)
- Rate limiting (100 requests / 15 minutos por IP)
- Sanitización de contenido con DOMPurify
- CORS configurado por dominio
- Rutas protegidas en el frontend

---

## 🛠️ Stack Tecnológico

### Frontend
| Tecnología | Uso |
|---|---|
| React 18 + TypeScript | Framework principal |
| Vite | Build tool |
| Tailwind CSS | Estilos |
| Zustand | State management |
| Socket.io Client | Tiempo real |
| Recharts | Gráficas |
| Sonner | Notificaciones toast |
| Lucide React | Iconografía |

### Backend
| Tecnología | Uso |
|---|---|
| Node.js + Express | Servidor |
| SQL Server (mssql) | Base de datos |
| Socket.io | WebSockets |
| whatsapp-web.js | Integración WhatsApp |
| Google Gemini API | Inteligencia Artificial |
| PDFKit | Generación de PDFs |
| bcryptjs | Encriptación |
| node-cron | Tareas programadas |
| express-rate-limit | Rate limiting |

---

## 📋 Requisitos Previos

- Node.js 18 o superior
- SQL Server 2019 o superior (o SQL Server Express)
- Cuenta de Google AI Studio (API Key de Gemini - gratuita)
- Número de WhatsApp para el bot de notificaciones
- Git

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Maxprogit/Gym-System.git
cd goliat-gym-system
```

### 2. Configurar la Base de Datos

Ejecuta los siguientes scripts en SQL Server Management Studio:

```sql
-- Crear base de datos
CREATE DATABASE GoliatDB;
USE GoliatDB;

-- Tabla de usuarios administradores
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role NVARCHAR(50) DEFAULT 'Admin'
);

-- Tabla de planes
CREATE TABLE Plans (
    PlanID INT IDENTITY(1,1) PRIMARY KEY,
    PlanName NVARCHAR(100) NOT NULL,
    DurationDays INT NOT NULL,
    Price DECIMAL(10,2) NOT NULL
);

-- Tabla de atletas
CREATE TABLE Members (
    MemberID INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL,
    Phone NVARCHAR(20),
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Tabla de suscripciones
CREATE TABLE Subscriptions (
    SubscriptionID INT IDENTITY(1,1) PRIMARY KEY,
    MemberID INT NOT NULL,
    PlanID INT NOT NULL,
    StartDate DATETIME DEFAULT GETDATE(),
    EndDate DATETIME NOT NULL,
    IsActive BIT DEFAULT 1,
    FOREIGN KEY (MemberID) REFERENCES Members(MemberID),
    FOREIGN KEY (PlanID) REFERENCES Plans(PlanID)
);

-- Tabla de pagos
CREATE TABLE Payments (
    PaymentID INT IDENTITY(1,1) PRIMARY KEY,
    MemberID INT NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    PaymentMethod NVARCHAR(50),
    PaymentDate DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (MemberID) REFERENCES Members(MemberID)
);

-- Tabla de planes IA
CREATE TABLE AthletsPlans (
    PlanID INT IDENTITY(1,1) PRIMARY KEY,
    MemberID INT NOT NULL,
    PlanType NVARCHAR(50),
    PlanContent NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (MemberID) REFERENCES Members(MemberID)
);

-- Planes de ejemplo
INSERT INTO Plans (PlanName, DurationDays, Price) VALUES
('Goliat Visita', 1, 35),
('Goliat Semanal', 7, 150),
('Goliat Mensual', 30, 350);
```

### 3. Configurar el Servidor

```bash
cd server
npm install
```

Crea el archivo `.env` en la carpeta `server`:

```env
DB_USER=sa
DB_PASS=tu_contraseña
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=GoliatDB
GEMINI_API_KEY=tu_api_key_de_gemini
```

> **¿Cómo obtener la API Key de Gemini?**
> Ve a [aistudio.google.com](https://aistudio.google.com) → Get API Key → Create API Key. Es completamente gratuita.

### 4. Crear el primer usuario administrador

```bash
# Inicia el servidor temporalmente
node index.js

# En otra terminal, ejecuta este comando
curl -X POST http://localhost:3001/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "tu_contraseña_segura"}'
```

### 5. Configurar el Cliente

```bash
cd ../client
npm install
```

Crea el archivo `.env` en la carpeta `client`:

```env
VITE_API_URL=http://localhost:3001
VITE_PAYMENT_PROVIDER=simulated
```

### 6. Iniciar el proyecto

```bash
# Terminal 1 - Servidor
cd server
node index.js

# Terminal 2 - Cliente
cd client
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

---

## 🌐 Despliegue en Producción

### Frontend → Vercel
1. Sube el proyecto a GitHub
2. Importa el repositorio en [vercel.com](https://vercel.com)
3. Configura el directorio raíz como `client`
4. Agrega las variables de entorno:
   - `VITE_API_URL` → URL de tu backend
   - `VITE_PAYMENT_PROVIDER` → `simulated`

### Backend → Render
1. Crea un nuevo Web Service en [render.com](https://render.com)
2. Conecta tu repositorio de GitHub
3. Configura el directorio raíz como `server`
4. Comando de inicio: `node index.js`
5. Agrega todas las variables de entorno del `.env`

> **Nota:** El plan gratuito de Render duerme el servidor tras 15 minutos de inactividad. Se recomienda usar [UptimeRobot](https://uptimerobot.com) para mantenerlo activo haciendo ping a `/api/healthz` cada 5 minutos.

---

## 📱 Configuración de WhatsApp

1. Inicia el servidor
2. Navega a **Conexión WhatsApp** en el panel
3. Escanea el código QR con tu teléfono:
   - Abre WhatsApp → Menú (⋮) → Dispositivos vinculados → Vincular dispositivo
4. El sistema enviará automáticamente recordatorios de vencimiento cada día a las 8am

---

## 📁 Estructura del Proyecto

```
goliat-gym-system/
├── client/                    # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   │   ├── ui/            # Componentes base (Button, Input, etc.)
│   │   │   ├── AddMemberModal.tsx
│   │   │   ├── EditMemberModal.tsx
│   │   │   ├── RenewModal.tsx
│   │   │   ├── AIModal.tsx
│   │   │   ├── PaymentModal.tsx
│   │   │   └── MemberCard.tsx
│   │   ├── config/
│   │   │   └── api.ts         # Configuración centralizada de URLs
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx
│   │   ├── lib/
│   │   │   └── useSocket.ts   # Hook de Socket.io
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── MembersPage.tsx
│   │   │   ├── PaymentsPage.tsx
│   │   │   └── WhatsAppPage.tsx
│   │   ├── services/
│   │   │   └── payments/      # Arquitectura de pagos
│   │   │       ├── paymentService.ts
│   │   │       └── simulatedPayment.ts
│   │   └── stores/
│   │       └── useMemberStore.ts
│   └── .env                   # Variables de entorno 
│
└── server/                    # Backend Node.js + Express
    ├── index.js               # Servidor principal
    └── .env                   # Variables de entorno (no subir a Git
```

---

## 🔑 Variables de Entorno

### Servidor (`server/.env`)
| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_USER` | Usuario de SQL Server | `sa` |
| `DB_PASS` | Contraseña de SQL Server | `MiPassword123` |
| `DB_SERVER` | Servidor de BD | `localhost\SQLEXPRESS` |
| `DB_NAME` | Nombre de la base de datos | `GoliatDB` |
| `GEMINI_API_KEY` | API Key de Google Gemini | `AIza...` |

### Cliente (`client/.env`)
| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_API_URL` | URL del backend | `http://localhost:3001` |
| `VITE_PAYMENT_PROVIDER` | Proveedor de pagos | `simulated` |

---

## 🤖 Integración con IA

El sistema usa **Google Gemini 2.5 Flash** para generar planes personalizados. El asistente:

1. Consulta el historial de planes anteriores del atleta
2. Hace preguntas específicas sobre objetivos, limitaciones y preferencias
3. Genera un plan estructurado (rutina, dieta o ambos)
4. Guarda el plan en la base de datos
5. Genera un PDF profesional y lo envía por WhatsApp

**Límites del plan gratuito de Gemini:**
- 15 requests por minuto
- 1,500 requests por día
- Suficiente para un gimnasio pequeño/mediano

---

## 🛣️ Roadmap

- [ ] Integración con pasarela de pagos real (Stripe/Conekta)
- [ ] Portal web para atletas
- [ ] App móvil
- [ ] Exportación de reportes a Excel
- [ ] Sistema de múltiples roles (Admin/Recepcionista)
- [ ] Soporte multi-gimnasio

---

## 📄 Licencia

Este proyecto está bajo licencia comercial. Al adquirirlo tienes derecho a:
- ✅ Usar en proyectos comerciales
- ✅ Modificar el código fuente
- ✅ Desplegar en producción
- ❌ Redistribuir o revender el código fuente
- ❌ Remover atribuciones de autoría

---

## 👨‍💻 Autor

Desarrollado por **Maximiliano** — [GitHub](https://github.com/Maxprogit)

---

## ⭐ ¿Te fue útil?

Si este proyecto te ayudó, considera darle una estrella en GitHub y compartirlo con otros desarrolladores.

