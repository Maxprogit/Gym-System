require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sql = require('mssql');
const cors = require('cors');
const cron = require('node-cron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------
// 1. CONFIGURACIÓN
// ---------------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

// Local SQL Database Configuration
// const dbConfig = {
//     user: "MaxProGit", 
//     password: "Vizicsaczi1*",
//     server: 'localhost',
//     database: 'GoliadDB', 
//     options: {
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };


const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};


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
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', 
            '--disable-gpu'
        ]
  },
});
whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Error de Autenticación de WhatsApp:', msg);
});

let isWhatsAppReady = false;

whatsappClient.on('qr', (qr) => {
    console.log('QR Generado');
    io.emit('qr_code', qr);
    isWhatsAppReady = false;
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp Conectado');
    isWhatsAppReady = true;
    io.emit('whatsapp_status', 'connected');
});

whatsappClient.initialize();

io.on('connection', (socket) => {
    if (isWhatsAppReady) socket.emit('whatsapp_status', 'connected');
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
        // 1. Encriptar contraseña antes de guardar
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Guardar en BD
        await pool.request()
            .input('Username', sql.NVarChar, username)
            .input('PasswordHash', sql.NVarChar, hashedPassword)
            .query('INSERT INTO Users (Username, PasswordHash, Role) VALUES (@Username, @PasswordHash, "Admin")');

        res.json({ success: true, message: "Usuario admin creado con seguridad robusta" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


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
            .input('Amount', sql.Decimal(10,2), Price) 
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
            .input('Amount', sql.Decimal(10,2), amount)
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


cron.schedule('0 8 * * *', async () => {
    if (!isWhatsAppReady) return;
    try {
        const result = await pool.request().query(`
            SELECT m.FullName, m.Phone, p.PlanName, s.EndDate 
            FROM Members m
            JOIN Subscriptions s ON m.MemberID = s.MemberID
            JOIN Plans p ON s.PlanID = p.PlanID
            WHERE DATEDIFF(day, GETDATE(), s.EndDate) = 3 AND s.IsActive = 1
        `);
        for (const member of result.recordset) {
            const chatId = `${member.Phone}@c.us`; 
            const message = `🤖 *GOLIAT GYM*: Hola ${member.FullName}, tu plan ${member.PlanName} vence en 3 días.`;
            await whatsappClient.sendMessage(chatId, message);
        }
    } catch (err) { console.error("Error Cron:", err); }
});



app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

const PORT = 3001;
server.listen(PORT, () => console.log(`🚀 Server corriendo en puerto ${PORT}`));