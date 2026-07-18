const { getSqlPool, sql } = require('../config/sqlServer');
const { AppError } = require('../core/AppError');

class GymRepository {
  async findUserByUsername(username) {
    const pool = await getSqlPool();
    const result = await pool.request()
      .input('Username', sql.NVarChar(100), username)
      .query('SELECT UserID, Username, PasswordHash, Role FROM Users WHERE Username = @Username');
    return result.recordset[0] || null;
  }

  async hasUsers() {
    const pool = await getSqlPool();
    const result = await pool.request().query('SELECT TOP 1 UserID FROM Users');
    return result.recordset.length > 0;
  }

  async createUser({ username, passwordHash }) {
    const pool = await getSqlPool();
    await pool.request()
      .input('Username', sql.NVarChar(100), username)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .query("INSERT INTO Users (Username, PasswordHash, Role) VALUES (@Username, @PasswordHash, 'Admin')");
  }

  async getPlans() {
    const pool = await getSqlPool();
    const result = await pool.request().query(
      'SELECT PlanID, PlanName, Price, DurationDays FROM Plans ORDER BY Price ASC',
    );
    return result.recordset;
  }

  async getMembers() {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT m.MemberID, m.FullName, m.Phone, active.PlanName, active.EndDate,
             DATEDIFF(day, CAST(GETDATE() AS date), CAST(active.EndDate AS date)) AS DaysLeft
      FROM Members m
      OUTER APPLY (
        SELECT TOP 1 p.PlanName, s.EndDate
        FROM Subscriptions s
        JOIN Plans p ON p.PlanID = s.PlanID
        WHERE s.MemberID = m.MemberID AND s.IsActive = 1
        ORDER BY s.EndDate DESC
      ) active
      WHERE EXISTS (
        SELECT 1 FROM Subscriptions visible
        WHERE visible.MemberID = m.MemberID AND visible.IsActive = 1
      )
      ORDER BY m.FullName ASC
    `);
    return result.recordset;
  }

  async createMember({ fullName, phone, planId, method }) {
    const pool = await getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const planResult = await transaction.request()
        .input('PlanID', sql.Int, planId)
        .query('SELECT PlanID, DurationDays, Price FROM Plans WHERE PlanID = @PlanID');
      const plan = planResult.recordset[0];
      if (!plan) throw new AppError(404, 'El plan seleccionado no existe');

      const existingMember = await transaction.request()
        .input('Phone', sql.NVarChar(20), phone)
        .query(`
          SELECT TOP 1 m.MemberID,
                 CASE WHEN EXISTS (
                   SELECT 1 FROM Subscriptions active
                   WHERE active.MemberID = m.MemberID AND active.IsActive = 1
                 ) THEN 1 ELSE 0 END AS HasActiveSubscription
          FROM Members m
          WHERE m.Phone = @Phone
          ORDER BY m.MemberID DESC
        `);
      const previousMember = existingMember.recordset[0];
      if (previousMember?.HasActiveSubscription) throw new AppError(409, 'Ya existe un atleta activo con ese teléfono');

      let memberId = previousMember?.MemberID;
      if (memberId) {
        await transaction.request()
          .input('MemberID', sql.Int, memberId)
          .input('FullName', sql.NVarChar(200), fullName)
          .input('Phone', sql.NVarChar(20), phone)
          .query('UPDATE Members SET FullName = @FullName, Phone = @Phone WHERE MemberID = @MemberID');
      } else {
        const memberResult = await transaction.request()
          .input('FullName', sql.NVarChar(200), fullName)
          .input('Phone', sql.NVarChar(20), phone)
          .query('INSERT INTO Members (FullName, Phone) OUTPUT INSERTED.MemberID VALUES (@FullName, @Phone)');
        memberId = memberResult.recordset[0].MemberID;
      }

      await transaction.request()
        .input('MemberID', sql.Int, memberId)
        .input('PlanID', sql.Int, planId)
        .input('DurationDays', sql.Int, plan.DurationDays)
        .query(`
          INSERT INTO Subscriptions (MemberID, PlanID, StartDate, EndDate, IsActive)
          VALUES (@MemberID, @PlanID, GETDATE(), DATEADD(day, @DurationDays, GETDATE()), 1)
        `);

      await transaction.request()
        .input('MemberID', sql.Int, memberId)
        .input('Amount', sql.Decimal(10, 2), plan.Price)
        .input('Method', sql.NVarChar(30), method)
        .query(`
          INSERT INTO Payments (MemberID, Amount, PaymentMethod, PaymentDate)
          VALUES (@MemberID, @Amount, @Method, GETDATE())
        `);

      await transaction.commit();
      return { memberId, amount: plan.Price };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateMember({ memberId, fullName, phone }) {
    const pool = await getSqlPool();
    const duplicate = await pool.request()
      .input('MemberID', sql.Int, memberId)
      .input('Phone', sql.NVarChar(20), phone)
      .query(`
        SELECT TOP 1 m.MemberID FROM Members m
        WHERE m.Phone = @Phone AND m.MemberID <> @MemberID AND EXISTS (
          SELECT 1 FROM Subscriptions s
          WHERE s.MemberID = m.MemberID AND s.IsActive = 1
        )
      `);
    if (duplicate.recordset.length) throw new AppError(409, 'Ya existe otro atleta con ese teléfono');

    const result = await pool.request()
      .input('MemberID', sql.Int, memberId)
      .input('FullName', sql.NVarChar(200), fullName)
      .input('Phone', sql.NVarChar(20), phone)
      .query('UPDATE Members SET FullName = @FullName, Phone = @Phone WHERE MemberID = @MemberID');
    if (!result.rowsAffected[0]) throw new AppError(404, 'Atleta no encontrado');
  }

  async renewMember({ memberId, planId, method }) {
    const pool = await getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const planResult = await transaction.request()
        .input('PlanID', sql.Int, planId)
        .query('SELECT PlanID, DurationDays, Price FROM Plans WHERE PlanID = @PlanID');
      const plan = planResult.recordset[0];
      if (!plan) throw new AppError(404, 'El plan seleccionado no existe');

      const memberResult = await transaction.request()
        .input('MemberID', sql.Int, memberId)
        .query('SELECT MemberID FROM Members WHERE MemberID = @MemberID');
      if (!memberResult.recordset.length) throw new AppError(404, 'Atleta no encontrado');

      const subscriptionResult = await transaction.request()
        .input('MemberID', sql.Int, memberId)
        .query(`
          SELECT TOP 1 EndDate FROM Subscriptions
          WHERE MemberID = @MemberID AND IsActive = 1
          ORDER BY EndDate DESC
        `);
      const currentSubscription = subscriptionResult.recordset[0];
      const currentEnd = currentSubscription?.EndDate;
      const startDate = currentEnd && new Date(currentEnd) > new Date() ? new Date(currentEnd) : new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.DurationDays);

      if (currentSubscription) {
        await transaction.request()
          .input('MemberID', sql.Int, memberId)
          .input('PlanID', sql.Int, planId)
          .input('EndDate', sql.DateTime2, endDate)
          .query(`
            WITH CurrentSubscription AS (
              SELECT TOP (1) * FROM Subscriptions
              WHERE MemberID = @MemberID AND IsActive = 1
              ORDER BY EndDate DESC
            )
            UPDATE CurrentSubscription
            SET PlanID = @PlanID, EndDate = @EndDate
          `);
      } else {
        await transaction.request()
          .input('MemberID', sql.Int, memberId)
          .input('PlanID', sql.Int, planId)
          .input('EndDate', sql.DateTime2, endDate)
          .query(`
            INSERT INTO Subscriptions (MemberID, PlanID, StartDate, EndDate, IsActive)
            VALUES (@MemberID, @PlanID, GETDATE(), @EndDate, 1)
          `);
      }
      await transaction.request()
        .input('MemberID', sql.Int, memberId)
        .input('Amount', sql.Decimal(10, 2), plan.Price)
        .input('Method', sql.NVarChar(30), method)
        .query(`
          INSERT INTO Payments (MemberID, Amount, PaymentMethod, PaymentDate)
          VALUES (@MemberID, @Amount, @Method, GETDATE())
        `);

      await transaction.commit();
      return { newEndDate: endDate, amount: plan.Price };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async archiveMember(memberId) {
    const pool = await getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const member = await transaction.request().input('MemberID', sql.Int, memberId)
        .query('SELECT MemberID FROM Members WHERE MemberID = @MemberID');
      if (!member.recordset.length) throw new AppError(404, 'Atleta no encontrado');
      await transaction.request().input('MemberID', sql.Int, memberId)
        .query('UPDATE Subscriptions SET IsActive = 0 WHERE MemberID = @MemberID AND IsActive = 1');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getPayments() {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT pay.PaymentID, pay.Amount, pay.PaymentMethod, pay.PaymentDate,
             m.FullName, currentPlan.PlanName
      FROM Payments pay
      LEFT JOIN Members m ON m.MemberID = pay.MemberID
      OUTER APPLY (
        SELECT TOP 1 p.PlanName
        FROM Subscriptions s
        JOIN Plans p ON p.PlanID = s.PlanID
        WHERE s.MemberID = pay.MemberID
        ORDER BY CASE WHEN s.IsActive = 1 THEN 0 ELSE 1 END, s.EndDate DESC
      ) currentPlan
      ORDER BY pay.PaymentDate DESC, pay.PaymentID DESC
    `);
    return result.recordset;
  }

  async getDashboardStats() {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(DISTINCT MemberID) FROM Subscriptions WHERE IsActive = 1 AND EndDate >= GETDATE()) AS ActiveMembers,
        (SELECT COUNT(DISTINCT MemberID) FROM Subscriptions WHERE IsActive = 1 AND DATEDIFF(day, GETDATE(), EndDate) BETWEEN 0 AND 5) AS ExpiringSoon,
        (SELECT COALESCE(SUM(Amount), 0) FROM Payments WHERE PaymentDate >= DATEADD(day, -30, GETDATE())) AS MonthlyRevenue,
        (SELECT COALESCE(SUM(Amount), 0) FROM Payments) AS LifetimeRevenue,
        (SELECT COALESCE(SUM(Amount), 0) FROM Payments WHERE CAST(PaymentDate AS date) = CAST(GETDATE() AS date)) AS TodayRevenue,
        (SELECT COUNT(*) FROM Payments) AS PaymentsCount,
        (SELECT COALESCE(AVG(CAST(Amount AS decimal(18,2))), 0) FROM Payments) AS AverageTicket;

      SELECT TOP 6 m.MemberID, m.FullName, p.PlanName,
             DATEDIFF(day, CAST(GETDATE() AS date), CAST(s.EndDate AS date)) AS DaysLeft
      FROM Subscriptions s
      JOIN Members m ON m.MemberID = s.MemberID
      JOIN Plans p ON p.PlanID = s.PlanID
      WHERE s.IsActive = 1 AND DATEDIFF(day, GETDATE(), s.EndDate) BETWEEN 0 AND 30
      ORDER BY s.EndDate ASC;

      SELECT CONVERT(char(7), PaymentDate, 120) AS MonthKey, SUM(Amount) AS Total
      FROM Payments
      WHERE PaymentDate >= DATEADD(month, -5, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
      GROUP BY CONVERT(char(7), PaymentDate, 120)
      ORDER BY MonthKey ASC;
    `);
    const summary = result.recordsets[0][0];
    return {
      activeMembers: summary.ActiveMembers,
      expiringSoon: summary.ExpiringSoon,
      monthlyRevenue: summary.MonthlyRevenue,
      lifetimeRevenue: summary.LifetimeRevenue,
      todayRevenue: summary.TodayRevenue,
      paymentsCount: summary.PaymentsCount,
      averageTicket: summary.AverageTicket,
      expiringList: result.recordsets[1],
      revenueHistory: result.recordsets[2],
    };
  }

  async getPlanHistory(memberId, limit = 5) {
    const pool = await getSqlPool();
    const result = await pool.request()
      .input('MemberID', sql.Int, memberId)
      .input('Limit', sql.Int, limit)
      .query(`
        SELECT TOP (@Limit) PlanID, PlanType, PlanContent, CreatedAt
        FROM AthletsPlans WHERE MemberID = @MemberID
        ORDER BY CreatedAt DESC
      `);
    return result.recordset;
  }

  async savePlan({ memberId, planType, planContent }) {
    const pool = await getSqlPool();
    await pool.request()
      .input('MemberID', sql.Int, memberId)
      .input('PlanType', sql.NVarChar(50), planType)
      .input('PlanContent', sql.NVarChar(sql.MAX), planContent)
      .query(`
        INSERT INTO AthletsPlans (MemberID, PlanType, PlanContent, CreatedAt)
        VALUES (@MemberID, @PlanType, @PlanContent, GETDATE())
      `);
  }

  async getMember(memberId) {
    const pool = await getSqlPool();
    const result = await pool.request()
      .input('MemberID', sql.Int, memberId)
      .query('SELECT MemberID, FullName, Phone FROM Members WHERE MemberID = @MemberID');
    return result.recordset[0] || null;
  }

  async listExpiringInDays(days) {
    const pool = await getSqlPool();
    const result = await pool.request()
      .input('Days', sql.Int, days)
      .query(`
        SELECT m.MemberID, m.FullName, m.Phone, p.PlanName,
               DATEDIFF(day, CAST(GETDATE() AS date), CAST(s.EndDate AS date)) AS DaysLeft
        FROM Subscriptions s
        JOIN Members m ON m.MemberID = s.MemberID
        JOIN Plans p ON p.PlanID = s.PlanID
        WHERE s.IsActive = 1 AND DATEDIFF(day, GETDATE(), s.EndDate) BETWEEN 0 AND @Days
      `);
    return result.recordset;
  }
}

module.exports = { GymRepository };
