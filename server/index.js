require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sql = require('mssql');
const cors = require('cors');
const cron = require('node-cron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const bcrypt = require('bcryptjs');
const { JSDOM } = require('jsdom');
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.'
});

const crteateDOMPurify = require('dompurify');
const window = new JSDOM('').window;
const DOMPurify = crteateDOMPurify(window);

const app = express();
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://gym-system-tawny.vercel.app"
    ],
    credentials: true
}));
app.use(express.json());
app.use('/api/', limiter);


const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "https://gym-system-tawny.vercel.app"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Local SQL Database Configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

//AZURE SQL CONFIG 
// const dbConfig = {
//     server: process.env.DB_SERVER,
//     database: process.env.DB_NAME,
//     driver: 'msnodesqlv8',
//     options: {
//         trustedConnection: true,
//         trustServerCertificate: true
//     }
// };




let pool;


async function connectDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log('✅ Base de Datos Conectada (Pool Global)');
    } catch (err) {
        console.error('❌ Error fatal al conectar SQL:', err);
    }
}
connectDB();

const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
        timeout: 120000,
        defaultViewport: null
    }
});
whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Error de Autenticación de WhatsApp:', msg);
});

let isWhatsAppReady = false;
let currentQr = null;
whatsappClient.on('qr', (qr) => {
    console.log('QR Generado');
    currentQr = qr;
    io.emit('qr_code', qr);
    isWhatsAppReady = false;
});

whatsappClient.on('disconnected', () => {
    console.log('❌ WhatsApp Desconectado');
    isWhatsAppReady = false;
    io.emit('whatsapp_status', 'disconnected');
});

async function initializeWhatsApp() {
    try {
        console.log('🔄 Iniciando WhatsApp...');
        await whatsappClient.initialize();
    } catch (err) {
        console.error('⚠️  WhatsApp no disponible:', err.message);
        console.log('⏳ Reintentando en 10 segundos...');
        setTimeout(initializeWhatsApp, 10000);
    }
}


setTimeout(initializeWhatsApp, 2000);

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado');


    socket.on('get_status', () => {
        if (isWhatsAppReady) {
            socket.emit('whatsapp_status', 'connected');
        } else if (currentQr) {
            socket.emit('qr_code', currentQr);
        } else {
            socket.emit('whatsapp_status', 'disconnected');
        }
    });

    if (isWhatsAppReady) {
        socket.emit('whatsapp_status', 'connected');
    } else if (currentQr) {
        socket.emit('qr_code', currentQr);
    } else {
        socket.emit('whatsapp_status', 'disconnected');
    }
});


app.get('/api/members', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT m.MemberID, m.FullName, m.Phone, p.PlanName, s.EndDate,
            DATEDIFF(day, GETDATE(), s.EndDate) as DaysLeft
            FROM Members m
            JOIN Subscriptions s ON m.MemberID = s.MemberID
            JOIN Plans p ON s.PlanID = p.PlanID
            WHERE s.IsActive = 1
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});


app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {

        const result = await pool.request()
            .input('User', sql.NVarChar, username)
            .query('SELECT UserID, Username, PasswordHash, Role FROM Users WHERE Username = @User');


        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.recordset[0];

        const isMatch = await bcrypt.compare(password, user.PasswordHash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }


        res.json({
            success: true,
            user: {
                id: user.UserID,
                username: user.Username,
                role: user.Role
            }
        });

    } catch (err) {
        console.error("❌ Error de Seguridad en Login:", err);
        res.status(500).json({ error: 'Error interno de autenticación' });
    }
});


app.post('/api/admin/create', async (req, res) => {
    const { username, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.request()
            .input('Username', sql.NVarChar, username)
            .input('PasswordHash', sql.NVarChar, hashedPassword)
            .query('INSERT INTO Users (Username, PasswordHash, Role) VALUES (@Username, @PasswordHash, "Admin")');

        res.json({ success: true, message: "Usuario admin creado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/plans', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT PlanID, PlanName, Price, DurationDays FROM Plans');
        res.json(result.recordset);
        console.log("Planes obtenidos:", result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

app.post('/api/members', async (req, res) => {

    const { fullName, phone, planId, paymentMethod } = req.body;

    try {

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = `521${cleanPhone}`;


        const memberResult = await pool.request()
            .input('FullName', sql.NVarChar, fullName)
            .input('Phone', sql.NVarChar, cleanPhone)
            .query('INSERT INTO Members (FullName, Phone) OUTPUT INSERTED.MemberID VALUES (@FullName, @Phone)');

        const newMemberId = memberResult.recordset[0].MemberID;

        const planResult = await pool.request()
            .input('PlanID', sql.Int, planId)
            .query('SELECT DurationDays, Price FROM Plans WHERE PlanID = @PlanID');
        if (planResult.recordset.length === 0) throw new Error("Plan no encontrado");

        const { DurationDays, Price } = planResult.recordset[0];


        const endDate = new Date();
        endDate.setDate(endDate.getDate() + DurationDays);


        await pool.request()
            .input('MemberID', sql.Int, newMemberId)
            .input('PlanID', sql.Int, planId)
            .input('EndDate', sql.DateTime, endDate)
            .query('INSERT INTO Subscriptions (MemberID, PlanID, EndDate) VALUES (@MemberID, @PlanID, @EndDate)');

        await pool.request()
            .input('MemberID', sql.Int, newMemberId)
            .input('Amount', sql.Decimal(10, 2), Price)
            .input('Method', sql.NVarChar, paymentMethod || 'Efectivo')
            .query('INSERT INTO Payments (MemberID, Amount, PaymentMethod, PaymentDate) VALUES (@MemberID, @Amount, @Method, GETDATE())');

        res.json({ success: true, memberId: newMemberId });

    } catch (err) {
        console.error("Error al crear miembro:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/renew', async (req, res) => {
    const { memberId, planId, paymentMethod, amount } = req.body;
    try {
        // 1. Fechas
        const subResult = await pool.request()
            .input('MemberID', sql.Int, memberId)
            .query('SELECT EndDate FROM Subscriptions WHERE MemberID = @MemberID AND IsActive = 1');

        let newStartDate = new Date();
        if (subResult.recordset.length > 0) {
            const currentEnd = subResult.recordset[0].EndDate;
            if (currentEnd > newStartDate) newStartDate = currentEnd;
        }


        const planResult = await pool.request()
            .input('PlanID', sql.Int, planId)
            .query('SELECT DurationDays FROM Plans WHERE PlanID = @PlanID');

        const duration = planResult.recordset[0].DurationDays;
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + duration);


        await pool.request()
            .input('MemberID', sql.Int, memberId)
            .input('PlanID', sql.Int, planId)
            .input('EndDate', sql.DateTime, newEndDate)
            .query('UPDATE Subscriptions SET EndDate = @EndDate, PlanID = @PlanID WHERE MemberID = @MemberID AND IsActive = 1');


        await pool.request()
            .input('MemberID', sql.Int, memberId)
            .input('Amount', sql.Decimal(10, 2), amount)
            .input('Method', sql.NVarChar, paymentMethod)
            .query('INSERT INTO Payments (MemberID, Amount, PaymentMethod, PaymentDate) VALUES (@MemberID, @Amount, @Method, GETDATE())');

        res.json({ success: true, newEndDate });
    } catch (err) {
        console.error("Error Renew:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/members/:id', async (req, res) => {
    const { id } = req.params;
    const { fullName, phone } = req.body;

    try {

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = `521${cleanPhone}`;

        await pool.request()
            .input('ID', sql.Int, id)
            .input('FullName', sql.NVarChar, fullName)
            .input('Phone', sql.NVarChar, cleanPhone)
            .query('UPDATE Members SET FullName = @FullName, Phone = @Phone WHERE MemberID = @ID');

        res.json({ success: true });
    } catch (err) {
        console.error("Error Edit:", err);
        res.status(500).json({ error: err.message });
    }
});


app.delete('/api/members/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.request().input('ID', sql.Int, id).query('DELETE FROM Payments WHERE MemberID = @ID');
        await pool.request().input('ID', sql.Int, id).query('DELETE FROM Subscriptions WHERE MemberID = @ID');
        await pool.request().input('ID', sql.Int, id).query('DELETE FROM AthletsPlans WHERE MemberID = @ID');
        await pool.request().input('ID', sql.Int, id).query('DELETE FROM Members WHERE MemberID = @ID');
        res.json({ success: true });
    } catch (err) {
        console.error("Error Delete:", err);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/payments', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT p.PaymentID, p.Amount, p.PaymentMethod, p.PaymentDate, m.FullName, pl.PlanName
            FROM Payments p
            LEFT JOIN Members m ON p.MemberID = m.MemberID
            LEFT JOIN Subscriptions s ON m.MemberID = s.MemberID AND s.IsActive = 1
            LEFT JOIN Plans pl ON s.PlanID = pl.PlanID
            ORDER BY p.PaymentDate DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const activeResult = await pool.request().query("SELECT COUNT(*) as Count FROM Subscriptions WHERE IsActive = 1 AND EndDate >= GETDATE()");
        const expiringResult = await pool.request().query("SELECT COUNT(*) as Count FROM Subscriptions WHERE IsActive = 1 AND DATEDIFF(day, GETDATE(), EndDate) BETWEEN 0 AND 5");
        const revenueResult = await pool.request().query("SELECT COALESCE(SUM(p.Price), 0) as Total FROM Subscriptions s JOIN Plans p ON s.PlanID = p.PlanID WHERE s.StartDate >= DATEADD(day, -30, GETDATE())");

        const listResult = await pool.request().query(`
            SELECT TOP 5 m.FullName, p.PlanName, DATEDIFF(day, GETDATE(), s.EndDate) as DaysLeft
            FROM Members m JOIN Subscriptions s ON m.MemberID = s.MemberID
            JOIN Plans p ON s.PlanID = p.PlanID
            WHERE s.IsActive = 1 AND DATEDIFF(day, GETDATE(), s.EndDate) BETWEEN 0 AND 30
            ORDER BY s.EndDate ASC
        `);

        const historyResult = await pool.request().query(`
            SELECT DATENAME(MONTH, s.StartDate) as MonthName, COALESCE(SUM(p.Price), 0) as Total
            FROM Subscriptions s JOIN Plans p ON s.PlanID = p.PlanID
            WHERE s.StartDate >= DATEADD(MONTH, -6, GETDATE())
            GROUP BY DATENAME(MONTH, s.StartDate), MONTH(s.StartDate)
            ORDER BY MONTH(s.StartDate)
        `);

        res.json({
            activeMembers: activeResult.recordset[0].Count,
            expiringSoon: expiringResult.recordset[0].Count,
            monthlyRevenue: revenueResult.recordset[0].Total,
            expiringList: listResult.recordset,
            revenueHistory: historyResult.recordset
        });
    } catch (err) {
        console.error("Error Dashboard:", err);
        res.status(500).json({ error: err.message });
    }
});

//IA 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/ai/generate', async (req, res) => {

    const { messages, memberName, memberId } = req.body;

    let historialPlanes = '';
    try {
        if (memberId) {
            const plansResult = await pool.request()
                .input('MemberID', sql.Int, memberId)
                .query(`
                SELECT TOP 3 PlanType, PlanContent, CreatedAt
                FROM AthletsPlans
                WHERE MemberID = @MemberID
                ORDER BY CreatedAt DESC
            `);

            if (plansResult.recordset.length > 0) {
                historialPlanes = `HISTORIAL DE PLANES ANTERIORES DEL ATLETA:\n`;
                plansResult.recordset.forEach((plan, i) => {
                    historialPlanes += `\nPlan ${i + 1} (${plan.PlanType} - ${new Date(plan.CreatedAt).toLocaleDateString('es-MX')}):\n${plan.PlanContent}\n`;
                });
                historialPlanes += `\nBásate en este historial para mejorar y personalizar el nuevo plan sin preguntar lo que ya sabes.`;
            }
        }
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: `Eres un entrenador personal y nutriólogo experto.
                Estás ayudando a crear un plan personalizado para el atleta: ${memberName}.
                
                INSTRUCCIONES IMPORTANTES:
                - Usa el historial disponible directamente, sin pedirle al atleta que lo repita
                - Haz preguntas solo sobre info que NO esté en el historial
                - Al generar el plan, no incluyas las respuestas del usuario, solo el plan estructurado
                - Al terminar el plan agrega exactamente: [PLAN_LISTO]
                - Responde siempre en español, profesional y amigable
                
                VARIEDAD DE EJERCICIOS:
                - Revisa el historial y cambia el 70% de ejercicios si hay 1 plan previo, el 100% si hay 2 o más
                - Rota variantes: press inclinado/declinado/plano, dominadas/jalones/remos, curl barra/predicador/araña, sentadilla frontal/búlgara/goblet/sumo, hip thrust, pullover, arnold press, etc.
                - Prioriza ejercicios que NO aparezcan en planes anteriores
                            
                ${historialPlanes.length > 0
                    ? `TIENES ACCESO AL SIGUIENTE HISTORIAL DEL ATLETA, ÚSALO:\n${historialPlanes}`
                    : 'Este atleta no tiene planes anteriores registrados, empieza desde cero.'
                }`
        });

        const rawHistory = messages.slice(-10, -1).filter((msg, i) => {
            if (i === 0 && messages[0].role === 'assistant') return false;
            if (!msg.content || msg.content.trim() === '') return false;
            return true;
        });

        const history = rawHistory.map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));


        const chat = model.startChat({ history });


        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessage(lastMessage);
        const content = result.response.text();
        const isComplete = content.includes('[PLAN_LISTO]');

        res.json({
            success: true,
            message: content.replace('[PLAN_LISTO]', '').trim(),
            isComplete
        });
    } catch (err) {
        console.error('Error Gemini:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/send-whatsapp', async (req, res) => {
    const { phone, plan, memberName } = req.body;
    try {
        if (!isWhatsAppReady) {
            return res.status(400).json({ error: 'WhatsApp no está conectado' });
        }
        const chatId = `${phone}@c.us`;
        const message = `Plan de Entrenamiento\n\nHola *${memberName}*, aquí está tu plan:\n\n${plan}`;
        await whatsappClient.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (err) {
        console.error('Error WhatsApp IA:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        await whatsappClient.logout();
        isWhatsAppReady = false;
        currentQr = null;
        io.emit('whatsapp_status', 'disconnected');
        res.json({ success: true });

        setTimeout(initializeWhatsApp, 2000);
    } catch (error) {
        console.error('Error al cerrar sesión de WhatsApp:', error);
        res.status(500).json({ error: 'Error al cerrar sesión de WhatsApp' });
    }
});

const PDFDocument = require('pdfkit');


app.post('/api/ai/save-plan', async (req, res) => {
    const { memberId, planType, planContent } = req.body;
    try {

        const cleanContent = DOMPurify.sanitize(planContent);

        await pool.request()
            .input('MemberID', sql.Int, memberId)
            .input('PlanType', sql.NVarChar, planType)
            .query('DELETE FROM AthletsPlans WHERE MemberID = @MemberID AND PlanType = @PlanType');

        await pool.request()
            .input('MemberID', sql.Int, memberId)
            .input('PlanType', sql.NVarChar, planType)
            .input('PlanContent', sql.NVarChar(sql.MAX), cleanContent)
            .query('INSERT INTO AthletsPlans (MemberID, PlanType, PlanContent, CreatedAt) VALUES (@MemberID, @PlanType, @PlanContent, GETDATE())');
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar el plan:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/ai/plans/:memberId', async (req, res) => {
    const { memberId } = req.params;
    try {
        const result = await pool.request()
            .input('MemberID', sql.Int, memberId)
            .query(`
                SELECT PlanID, PlanType, PlanContent, CreatedAt
                FROM AthletsPlans
                WHERE MemberID = @MemberID
                ORDER BY CreatedAt DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener el historial de planes:', error);
        res.status(500).json({ error: error.message });
    }
});


//     const { phone, planContent, memberName, planType } = req.body;
//     try {
//         if (!isWhatsAppReady) {
//             return res.status(400).json({ error: 'WhatsApp no está conectado' });
//         };

//         //Genera un pdf en memoria
//         const doc = new PDFDocument({margin: 50});
//         const chunks = [];

//         doc.on('data', chunk => chunks.push(chunk));
//         doc.on('end', async () => {
//             const pdfBuffer = Buffer.concat(chunks);
//             const base64Pdf = pdfBuffer.toString('base64');
//             const MessageMedia = require('whatsapp-web.js').MessageMedia;
//             const media = new MessageMedia('application/pdf', base64Pdf, `${planType}_${memberName.replace(/\s+/g, '_')}.pdf`);

//         const chatId = `${phone}@c.us`;
//         await whatsappClient.sendMessage(chatId, media, {
//         caption: `💪 *GOLIAT GYM*\nHola *${memberName}*, aquí tienes tu ${planType}.`
//         });

//         res.json({ success: true });
//     });

//     //contenido del pdf
//     //header
//     doc.fontSize(24)
//     .font('Helvetica-Bold')
//     .fillColor('#000000')
//     .text(`GOLIAT GYM`, { align: 'center' });

//     doc.fontSize(14)
//     .font('Helvetica')
//     .fillColor('#555555')
//     .text(`Plan Personalizado: ${planType}`, { align: 'center' });

//     doc.moveDown();

//     doc.fontSize(12)
//     .fillColor('#333333')
//     .text(`Atleta: ${memberName}`, { align: 'left' });

//     doc.text(`Fecha: ${new Date().toLocaleDateString('es-Mx')}`, { align: 'left' });

//     doc.moveDown();

//     //linea separadora
//     doc.moveTo(50, doc.y)
//     .lineTo(550, doc.y)
//     .strokeColor('#D4FF00')
//     .lineWidth(2)
//     .stroke();


//     doc.moveDown();


//     //conternido del plan
//     doc.fontSize(11)
//     .font('Helvetica')
//     .fillColor('#000000')
//     .text(planContent, {
//         align: 'left',
//         lineGap: 4
//     });

//     doc.end();

//     } catch (error) {
//         console.error('Error al generar PDF:', error);
//         res.status(500).json({ error: 'Error al generar PDF' });
//     }
// });


// ============================================================
// GOLIAT GYM - Endpoint: /api/ai/send-plan-pdf  (Node.js)
// Dependencias: pdfkit, whatsapp-web.js
// IA de nutricion: Gemini 2.0 Flash (GEMINI_API_KEY en .env)
// ============================================================

app.post('/api/ai/send-plan-pdf', async (req, res) => {
    const { phone, planContent, memberName, planType } = req.body;
    try {
        if (!isWhatsAppReady) return res.status(400).json({ error: 'WhatsApp no esta conectado' });

        const cleanPlan = extractFinalPlan(planContent);

        let mealsData = null;
        if (/NUTRICI[ÓO]N|dieta|comidas|desayuno/i.test(cleanPlan)) {
            mealsData = await parseMealsWithAI(cleanPlan);
        }

        const pdfBuffer = await generateStructuredPDF({ memberName, planType, planContent: cleanPlan, mealsData });

        const base64Pdf = pdfBuffer.toString('base64');
        const { MessageMedia } = require('whatsapp-web.js');
        const media = new MessageMedia('application/pdf', base64Pdf, `${planType}_${memberName.replace(/\s+/g, '_')}.pdf`);
        await whatsappClient.sendMessage(`${phone}@c.us`, media, {
            caption: `\u{1F4AA} *GOLIAT GYM*\nHola *${memberName}*, aqui tienes tu ${planType}.`
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error al generar PDF:', error);
        res.status(500).json({ error: 'Error al generar PDF' });
    }
});


// ============================================================
//  HELPER 0 - Gemini 2.5 Flash: parsear nutricion a JSON
//  FIXES vs version anterior:
//  - URL y estructura de request correcta para Gemini
//  - Lectura de respuesta por candidates[0].content.parts[0].text
//  - Solo envia la seccion de nutricion (ahorro de tokens)
//  - responseMimeType:'application/json' evita razonamiento extra
//  - maxOutputTokens:800 limita costo
// ============================================================
async function parseMealsWithAI(planContent) {
    try {
        // FIX 1: regex corregido para capturar sección de nutrición
        const nutritionStart = planContent.search(/NUTRICI[ÓO]N|Plan de Nutrici|Estrategia de Comidas|Comidas del d/i);
        const nutritionText = nutritionStart !== -1 ? planContent.slice(nutritionStart) : planContent;

        // FIX 2: prompt más estricto que forza JSON mínimo y sin texto extra
        const prompt = `Eres un extractor de datos. Analiza el plan de nutrición y devuelve ÚNICAMENTE un array JSON válido.
            NO incluyas explicaciones, markdown, ni texto fuera del JSON.

            Formato requerido (array de objetos):
            [
                {
                    "comida": "Desayuno",
                    "horario": "7:00 AM",
                    "alimentos": [
                        { "nombre": "Avena integral", "porcion": "80g" },
                        { "nombre": "Leche descremada", "porcion": "200ml" }
                    ]
                }
            ]

            Reglas:
            - Incluye TODAS las opciones de cada comida como filas separadas
            - Cada opción va como un objeto en "alimentos": nombre = "Opción 1: [descripción breve]", porcion = ""
            - Descripción breve: máximo 80 caracteres por opción, resume los ingredientes principales
            - Si hay horario explícito, úsalo; si no, asigna uno realista
            - Incluye TODAS las comidas (desayuno, colación, almuerzo, comida, merienda, cena, etc.)
            - Devuelve SOLO el array JSON, sin texto adicional

            PLAN DE NUTRICIÓN:
            ${nutritionText}`;

        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    generationConfig: {
                        responseMimeType: 'application/json',
                        maxOutputTokens: 4096,   // FIX 3: suficiente para planes completos
                        temperature: 0,
                    },
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText);
            return null;
        }

        const data = await response.json();

        // Log para debug (puedes removerlo en producción)
        console.log('Gemini raw response:', JSON.stringify(data).substring(0, 300));

        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!raw) {
            console.error('Respuesta vacía de Gemini:', JSON.stringify(data));
            return null;
        }

        // FIX 4: limpieza agresiva de cualquier wrapper markdown que Gemini pueda agregar
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .replace(/^\s*\/\/.*$/gm, '')
            .trim();

        // FIX 5: detectar truncamiento antes de parsear
        if (!cleaned.endsWith(']')) {
            console.error('JSON truncado detectado, últimos 100 chars:', cleaned.slice(-100));
            // Intento de reparación: cerrar el JSON si está truncado
            const repaired = repairTruncatedJSON(cleaned);
            if (repaired) {
                return validateAndReturn(repaired);
            }
            return null;
        }

        return validateAndReturn(JSON.parse(cleaned));

    } catch (err) {
        console.error('Error parseando nutricion con IA:', err.message);
        return null;
    }
}

// FIX 6: función de reparación para JSON truncado
function repairTruncatedJSON(str) {
    try {
        // Encuentra el último objeto completo (que tenga alimentos cerrado)
        const lastComplete = str.lastIndexOf('},');
        if (lastComplete === -1) return null;
        const truncated = str.substring(0, lastComplete + 1) + ']';
        return JSON.parse(truncated);
    } catch {
        return null;
    }
}

// FIX 7: validación de estructura antes de retornar
function validateAndReturn(parsed) {
    if (!Array.isArray(parsed) || parsed.length === 0) {
        console.error('JSON de comidas no es array válido');
        return null;
    }

    // Filtrar y sanitizar cada comida
    const valid = parsed.filter(meal =>
        meal && typeof meal === 'object' && meal.comida && Array.isArray(meal.alimentos)
    ).map(meal => ({
        comida: String(meal.comida || '').trim(),
        horario: String(meal.horario || '').trim(),
        alimentos: (meal.alimentos || [])
            .filter(a => a && a.nombre)
            .map(a => ({
                nombre: String(a.nombre || '').trim(),
                porcion: String(a.porcion || '').trim(),
            }))
    }));

    if (valid.length === 0) {
        console.error('Ninguna comida pasó la validación');
        return null;
    }

    console.log(`✓ Comidas parseadas: ${valid.length} comidas`);
    return valid;
}

// ============================================================
//  HELPER 1 - Extrae solo el plan final (sin preguntas del chat)
// ============================================================
function extractFinalPlan(rawContent) {
    const lines = rawContent.split('\n');
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---'
            || line.match(/^#{1,3}\s*\*{0,2}Plan (Personalizado|de Entrenamiento|de Nutricion)/i)
            || line.match(/^#{1,3}\s*PLAN DE (ENTRENAMIENTO|NUTRICION)/i)
        ) { startIndex = i; break; }
    }
    if (startIndex === -1) {
        return lines.filter(l => !l.match(/^\d+\.\s*\*{0,2}[?]/) && !l.match(/^Hola!/)).join('\n').trim();
    }
    return lines.slice(startIndex).join('\n').trim();
}


// ============================================================
//  HELPER 2 - Genera el PDF estructurado
// ============================================================
function generateStructuredPDF({ memberName, planType, planContent, mealsData }) {
    return new Promise((resolve, reject) => {
        const PDFDocument = require('pdfkit');
        const COLORS = {
            lime: '#D4FF00', black: '#000000', darkGray: '#1a1a1a', medGray: '#333333',
            borderGray: '#cccccc', white: '#ffffff', accent: '#2a2a2a',
            tableHead: '#1a1a1a', tableAlt: '#f9f9f9', sectionBg: '#111111',
        };

        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageW = doc.page.width;
        const pageH = doc.page.height;
        const margin = 50;
        const contentW = pageW - margin * 2;

        // HEADER pagina 1
        doc.rect(0, 0, pageW, 110).fill(COLORS.black);
        doc.rect(0, 108, pageW, 4).fill(COLORS.lime);
        doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.lime)
            .text('GOLIAT GYM', margin, 22, { align: 'center', width: contentW });
        doc.fontSize(11).font('Helvetica').fillColor(COLORS.white)
            .text('Plan Personalizado: ' + planType, margin, 60, { align: 'center', width: contentW });

        const infoY = 120;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.medGray).text('Atleta:', margin, infoY);
        doc.font('Helvetica').fillColor(COLORS.medGray).text(memberName, margin + 48, infoY);
        doc.font('Helvetica-Bold').text('Fecha:', margin + 250, infoY);
        doc.font('Helvetica').text(new Date().toLocaleDateString('es-MX'), margin + 295, infoY);
        doc.moveTo(margin, 145).lineTo(pageW - margin, 145).strokeColor(COLORS.borderGray).lineWidth(1).stroke();
        doc.y = 158;

        const lines = planContent.split('\n');
        let i = 0;
        let mealsRendered = false;

        function isExerciseLine(str) {
            if (/calentamiento|enfriamiento|movilidad articular|estiramientos estáticos|descanso entre series|generalmente|cardio ligero/i.test(str)) return false;
            return /\d+\s*series?\s*x\s*\d+|\d+\s*x\s*\d+\s*rep|\d+\s*series\b|\d+[-–]\d+\s*rep|\d+\s*rondas?/i.test(str);
        }

        while (i < lines.length) {
            const line = lines[i].trim();
            if (doc.y > pageH - 100) { doc.addPage(); drawPageHeader(doc, pageW, COLORS); doc.y = 60; }

            if (line === '---') {
                doc.moveDown(0.4);
                doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).strokeColor(COLORS.lime).lineWidth(1.5).stroke();
                doc.moveDown(0.6); i++; continue;
            }

            if (/^#{1,2}\s/.test(line) && !/^#{3}/.test(line)) {
                const text = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                drawSectionHeader(doc, text, margin, contentW, pageW, COLORS);

                const isNutrition = /NUTRICI[ÓO]N|DIETA|COMIDAS|nutrici[oó]n|plan.*nutri|alimenta/i.test(text);
                if (isNutrition && mealsData && !mealsRendered) {
                    mealsRendered = true;
                    for (const meal of mealsData) { drawMealTable(doc, meal, margin, contentW, pageW, pageH, COLORS); doc.moveDown(0.6); }
                    i++;
                    while (i < lines.length) {
                        const peek = lines[i].trim();
                        if (/^#{1,2}\s/.test(peek) && !/^#{3}/.test(peek)) break;
                        if (peek === '---') break;
                        i++;
                    }
                    continue;
                }
                i++; continue;
            }

            // ✅ REEMPLAZA CON ESTO — H3 también detecta nutrición:
            const NUTRITION_REGEX = /NUTRICI[ÓO]N|DIETA|COMIDAS|nutrici[oó]n|plan.*nutri|alimenta/i;

            if (/^#{3}\s/.test(line) && !/^#{4}/.test(line)) {
                const text = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');

                // ← FIX: si es sección de nutrición, renderiza tablas de comidas
                if (NUTRITION_REGEX.test(text) && mealsData && !mealsRendered) {
                    drawSectionHeader(doc, text, margin, contentW, pageW, COLORS);
                    mealsRendered = true;
                    i++;
                    for (const meal of mealsData) {
                        drawMealTable(doc, meal, margin, contentW, pageW, pageH, COLORS);
                        doc.moveDown(0.8);
                    }
                    // Saltar prosa de nutrición hasta el siguiente encabezado o ---
                    while (i < lines.length) {
                        const peek = lines[i].trim();
                        if (/^#{1,3}\s/.test(peek) || peek === '---') break;
                        i++;
                    }
                    continue;
                }

                // H3 normal
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.darkGray).text(text, margin, doc.y);
                const tw = doc.widthOfString(text);
                doc.moveTo(margin, doc.y + 1).lineTo(margin + Math.min(tw + 10, contentW), doc.y + 1)
                    .strokeColor(COLORS.lime).lineWidth(1).stroke();
                doc.moveDown(0.5); i++; continue;
            }

            // H4 — días de entrenamiento cuando el plan usa ####
            if (/^#{4}\s/.test(line) && !/^#{5}/.test(line)) {
                const text = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                doc.moveDown(0.5);
                doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.darkGray).text(text, margin, doc.y);
                const tw = doc.widthOfString(text);
                doc.moveTo(margin, doc.y + 1).lineTo(margin + Math.min(tw + 10, contentW), doc.y + 1)
                    .strokeColor(COLORS.lime).lineWidth(1).stroke();
                doc.moveDown(0.4); i++; continue;
            }

            // H5+
            if (/^#{5,6}\s/.test(line)) {
                const text = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                doc.moveDown(0.3);
                doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.accent).text('› ' + text, margin, doc.y);
                doc.moveDown(0.3); i++; continue;
            }

            // CASO A: encabezado de tabla markdown "EJERCICIO  SERIES..."
            if (/^EJERCICIO\b/i.test(line)) {
                const tableRows = [];
                i++;
                while (i < lines.length) {
                    const r = lines[i].trim();
                    if (r === '' || r === '---' || /^#{1,}/.test(r) || /^EJERCICIO\b/i.test(r)) break;
                    const parts = r.split(/\s{2,}|\t/);
                    if (parts.length >= 2) {
                        tableRows.push({ ejercicio: parts[0].trim().replace(/\*\*/g, ''), detalle: parts.slice(1).join(' ').trim().replace(/\*\*/g, '') });
                    } else if (r !== '' && tableRows.length > 0) {
                        tableRows[tableRows.length - 1].detalle += ' ' + r.replace(/\*\*/g, '');
                    }
                    i++;
                }
                if (tableRows.length > 0) { drawExerciseTable(doc, tableRows, margin, contentW, pageW, pageH, COLORS); doc.moveDown(0.5); }
                continue;
            }

            // CASO B/C: lista numerada o grupo muscular
            if (/^\d+\.\s/.test(line) || /^\*\s+\*\*/.test(line)) {
                const tableRows = [];
                let j = i;
                let groupTitle = null;
                if (/^\*\s+\*\*/.test(lines[j]?.trim() || '')) {
                    groupTitle = lines[j].trim().replace(/^\*\s+\*\*/, '').replace(/\*\*:?/, '');
                    j++;
                }
                while (j < lines.length) {
                    const r = lines[j].trim();
                    if (/^\d+\.\s/.test(r)) {
                        const cleaned = r.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '');
                        const colonIdx = cleaned.indexOf(':');
                        if (colonIdx > -1) {
                            tableRows.push({ ejercicio: cleaned.substring(0, colonIdx).trim(), detalle: cleaned.substring(colonIdx + 1).trim() });
                        } else {
                            const match = cleaned.match(/^(.+?)\s*[(:]\s*(\d+\s+series?.+)/i);
                            if (match) tableRows.push({ ejercicio: match[1].trim(), detalle: match[2].trim() });
                            else tableRows.push({ ejercicio: cleaned, detalle: '' });
                        }
                        j++;
                    } else if (/^\*\s+\*\*/.test(r)) { break; }
                    else if (r === '' || r === '---') { j++; break; }
                    else { break; }
                }
                if (tableRows.length > 0) {
                    if (groupTitle) { doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.medGray).text(groupTitle, margin + 5, doc.y); doc.moveDown(0.2); }
                    drawExerciseTable(doc, tableRows, margin, contentW, pageW, pageH, COLORS);
                    doc.moveDown(0.5); i = j; continue;
                }
            }

            // CASO D: bullets con patron de ejercicio "* Press de banca: 4 series x 8-12 reps"
            // Agrupa lineas consecutivas de este tipo en una tabla
            if (/^[*\-]\s+/.test(line) && !/^\*\s+\*\*/.test(line) && isExerciseLine(line)) {
                const tableRows = [];
                let j = i;
                while (j < lines.length) {
                    const r = lines[j].trim();
                    if (/^[*\-]\s+/.test(r) && !/^\*\s+\*\*/.test(r) && isExerciseLine(r)) {
                        const cleaned = r.replace(/^[*\-]\s+/, '').replace(/\*\*/g, '');
                        const colonIdx = cleaned.indexOf(':');
                        if (colonIdx > -1) {
                            tableRows.push({ ejercicio: cleaned.substring(0, colonIdx).trim(), detalle: cleaned.substring(colonIdx + 1).trim() });
                        } else {
                            const match = cleaned.match(/^(.+?)\s*[\(]?\s*(\d+\s+series.+|\d+\s*x\s*\d+.+)/i);
                            if (match) tableRows.push({ ejercicio: match[1].trim(), detalle: match[2].trim() });
                            else tableRows.push({ ejercicio: cleaned, detalle: '' });
                        }
                        j++;
                    } else if (r === '') {
                        j++;
                        if (j < lines.length && isExerciseLine(lines[j].trim())) continue;
                        break;
                    }
                    else { break; }
                }
                if (tableRows.length > 0) {
                    drawExerciseTable(doc, tableRows, margin, contentW, pageW, pageH, COLORS);
                    doc.moveDown(0.5); i = j; continue;
                }
            }

            // Bullet normal (sin patron de ejercicio)
            if (/^[*\-]\s+/.test(line) && !/^\*\s+\*\*/.test(line)) {
                const text = line.replace(/^[*\-]\s+/, '').replace(/\*\*/g, '');
                doc.fontSize(10).font('Helvetica').fillColor(COLORS.medGray).text('*  ' + text, margin + 10, doc.y, { width: contentW - 10, lineGap: 2 });
                doc.moveDown(0.2); i++; continue;
            }

            if (/\*\*/.test(line) && line !== '') {
                doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.medGray).text(line.replace(/\*\*/g, ''), margin, doc.y, { width: contentW, lineGap: 2 });
                doc.moveDown(0.2); i++; continue;
            }

            if (line === '') { doc.moveDown(0.3); i++; continue; }

            doc.fontSize(10).font('Helvetica').fillColor(COLORS.medGray).text(line, margin, doc.y, { width: contentW, lineGap: 2 });
            doc.moveDown(0.2); i++;
        }

        // FOOTER todas las paginas
        const range = doc.bufferedPageRange();
        for (let p = range.start; p < range.start + range.count; p++) {
            doc.switchToPage(p);
            doc.rect(0, pageH - 35, pageW, 35).fill(COLORS.black);
            doc.fontSize(8).font('Helvetica').fillColor(COLORS.lime).text(
                'GOLIAT GYM  *  ' + planType + '  *  ' + memberName + '  *  ' + new Date().toLocaleDateString('es-MX'),
                margin, pageH - 22, { align: 'center', width: contentW }
            );
        }
        doc.end();
    });
}


function drawSectionHeader(doc, text, margin, contentW, pageW, COLORS) {
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(margin - 8, y - 4, contentW + 16, 26).fill(COLORS.sectionBg);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.lime).text(text.toUpperCase(), margin, y + 2, { width: contentW });
    doc.y = y + 30;
}

function drawExerciseTable(doc, rows, margin, contentW, pageW, pageH, COLORS) {
    const colW1 = contentW * 0.42;
    const colW2 = contentW * 0.58;
    const headerH = 22;
    const pad = 5;

    doc.fontSize(8.5);
    const rowHeights = rows.map(row => {
        const h1 = Math.ceil(doc.heightOfString(row.ejercicio || '', { width: colW1 - 12 }));
        const h2 = Math.ceil(doc.heightOfString(row.detalle || '', { width: colW2 - 12 }));
        return Math.max(20, Math.max(h1, h2) + pad * 2);
    });

    const totalH = headerH + rowHeights.reduce((a, b) => a + b, 0);
    if (doc.y + totalH > pageH - 80) { doc.addPage(); drawPageHeader(doc, pageW, COLORS); doc.y = 60; }

    const startY = doc.y;
    doc.rect(margin, startY, contentW, headerH).fill(COLORS.tableHead);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.lime)
        .text('EJERCICIO', margin + 6, startY + 6, { width: colW1 - 6 })
        .text('SERIES / REPS / DETALLE', margin + colW1 + 6, startY + 6, { width: colW2 - 6 });

    let currentY = startY + headerH;
    rows.forEach((row, idx) => {
        const rh = rowHeights[idx];
        doc.rect(margin, currentY, contentW, rh).fill(idx % 2 === 0 ? COLORS.white : COLORS.tableAlt);
        doc.rect(margin, currentY, contentW, rh).strokeColor(COLORS.borderGray).lineWidth(0.3).stroke();
        doc.moveTo(margin + colW1, currentY).lineTo(margin + colW1, currentY + rh).strokeColor(COLORS.borderGray).lineWidth(0.3).stroke();
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.darkGray).text(row.ejercicio || '', margin + 6, currentY + pad, { width: colW1 - 12, lineGap: 1 });
        doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.medGray).text(row.detalle || '', margin + colW1 + 6, currentY + pad, { width: colW2 - 12, lineGap: 1 });
        currentY += rh;
    });

    doc.rect(margin, startY, contentW, currentY - startY).strokeColor(COLORS.darkGray).lineWidth(0.8).stroke();
    doc.y = currentY + 4;
}

function drawMealTable(doc, meal, margin, contentW, pageW, pageH, COLORS) {
    const colA = contentW * 0.60;
    const colP = contentW * 0.40;
    const headH = 24; const titleH = 26;
    doc.fontSize(8.5);
    const rowHeights = (meal.alimentos || []).map(item => {
        const h = Math.ceil(doc.heightOfString(item.nombre || '', { width: contentW * 0.60 - 16 }));
        return Math.max(22, h + 12);
    });
    const totalH = titleH + headH + rowHeights.reduce((a, b) => a + b, 0);

    if (doc.y + totalH > pageH - 80) { doc.addPage(); drawPageHeader(doc, pageW, COLORS); doc.y = 60; }

    const startY = doc.y;

    doc.rect(margin, startY, contentW, titleH).fill(COLORS.lime);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.black).text((meal.comida || '').toUpperCase(), margin + 8, startY + 7, { width: colA - 8 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.darkGray).text(meal.horario || '', margin + colA, startY + 8, { width: colP - 8, align: 'right' });

  const headY = startY + titleH;
    doc.rect(margin, headY, contentW, headH).fill(COLORS.tableHead);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.white)
        .text('ALIMENTO', margin + 8, headY + 7, { width: colA - 8 })
        .text('PORCION', margin + colA + 8, headY + 7, { width: colP - 10 });

    let currentRowY = headY + headH;
    (meal.alimentos || []).forEach((item, idx) => {
        const rh = rowHeights[idx];
        doc.rect(margin, currentRowY, contentW, rh).fill(idx % 2 === 0 ? COLORS.white : COLORS.tableAlt);
        doc.rect(margin, currentRowY, contentW, rh).strokeColor(COLORS.borderGray).lineWidth(0.3).stroke();
        doc.moveTo(margin + colA, currentRowY).lineTo(margin + colA, currentRowY + rh).strokeColor(COLORS.borderGray).lineWidth(0.3).stroke();
        doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.darkGray).text(item.nombre || '', margin + 8, currentRowY + 5, { width: colA - 16, lineGap: 1 });
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.medGray).text(item.porcion || '', margin + colA + 8, currentRowY + 5, { width: colP - 10, ellipsis: true });
        currentRowY += rh;
    });

    doc.rect(margin, startY, contentW, currentRowY - startY).strokeColor(COLORS.darkGray).lineWidth(0.8).stroke();
    doc.y = currentRowY + 4;
}

function drawPageHeader(doc, pageW, COLORS) {
    doc.rect(0, 0, pageW, 38).fill(COLORS.black);
    doc.rect(0, 36, pageW, 2).fill(COLORS.lime);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.lime).text('GOLIAT GYM', 50, 12, { align: 'center', width: pageW - 100 });
}
whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp Conectado');
    isWhatsAppReady = true;
    io.emit('whatsapp_status', 'connected');


    cron.schedule('0 8 * * *', async () => {
        try {
            const result = await pool.request().query(`
                SELECT m.FullName, m.Phone, p.PlanName
                FROM Members m
                JOIN Subscriptions s ON m.MemberID = s.MemberID
                JOIN Plans p ON s.PlanID = p.PlanID
                WHERE DATEDIFF(day, GETDATE(), s.EndDate) = 3 AND s.IsActive = 1
            `);
            for (const member of result.recordset) {
                const chatId = `${member.Phone}@c.us`;
                const message = ` Hola ${member.FullName}, tu plan ${member.PlanName} vence en 3 días.`;
                await whatsappClient.sendMessage(chatId, message);
            }
        } catch (err) {
            console.error("Error Cron WhatsApp:", err);
        }
    });
});

cron.schedule('*/5 * * * *', async () => {
    try {
        const result = await pool.request().query(`
            SELECT m.FullName, p.PlanName,
            DATEDIFF(day, GETDATE(), s.EndDate) as DaysLeft
            FROM Members m
            JOIN Subscriptions s ON m.MemberID = s.MemberID
            JOIN Plans p ON s.PlanID = p.PlanID
            WHERE s.IsActive = 1
            AND DATEDIFF(day, GETDATE(), s.EndDate) BETWEEN 0 AND 3
        `);
        for (const member of result.recordset) {
            io.emit('expiring_alert', {
                name: member.FullName,
                plan: member.PlanName,
                daysLeft: member.DaysLeft
            });
        }
    } catch (error) {
        console.error("Error Socket Cron:", error);
    }
});


app.get('/api/healthz', (req, res) => {
    res.status(200).send('OK');
});


process.on('uncaughtException', (err) => {
    console.error('❌ Error no capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promesa rechazada:', err);
});

const PORT = 3001;
server.listen(PORT, () => console.log(`🚀 Server corriendo en puerto ${PORT}`));