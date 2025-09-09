const express = require('express');
const db = require('./database.js');
const verifyToken = require('./auth');
const { apiLimiter } = require('./apiMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Dashboard de analytics geral
 *     description: Retorna métricas gerais de produtividade do usuário
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período para análise
 *     responses:
 *       200:
 *         description: Métricas de dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Analytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/dashboard', apiLimiter, verifyToken, async (req, res) => {
  const period = req.query.period || 'month';
  const userId = req.userId;
  
  try {
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    const startDateISO = startDate.toISOString();
    const endDateISO = now.toISOString();
    
    // Get basic counts
    const totalBoards = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM boards WHERE userId = ?", [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    const totalCards = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count 
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ?
      `, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    // Get completed cards (assuming cards in "Done" or "Completed" columns are completed)
    const completedCards = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count 
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? AND LOWER(col.name) IN ('done', 'completed', 'finished')
      `, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    // Get overdue cards
    const overdueCards = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count 
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND c.dueDate IS NOT NULL 
        AND c.dueDate < ? 
        AND LOWER(col.name) NOT IN ('done', 'completed', 'finished')
      `, [userId, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    // Get productivity data (cards created per day in period)
    const cardsCreated = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DATE(c.createdAt) as date, COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND c.createdAt >= ? AND c.createdAt <= ?
        GROUP BY DATE(c.createdAt)
        ORDER BY date ASC
      `, [userId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    // Get cards completed per day (using updatedAt as proxy for completion)
    const cardsCompleted = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DATE(c.updatedAt) as date, COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND c.updatedAt >= ? AND c.updatedAt <= ?
        AND LOWER(col.name) IN ('done', 'completed', 'finished')
        GROUP BY DATE(c.updatedAt)
        ORDER BY date ASC
      `, [userId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    // Get cards by priority distribution
    const priorityDistribution = await new Promise((resolve, reject) => {
      db.all(`
        SELECT c.priority, COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ?
        GROUP BY c.priority
      `, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    // Get average completion time (time from creation to moving to done column)
    const avgCompletionTime = await new Promise((resolve, reject) => {
      db.get(`
        SELECT AVG(
          (julianday(c.updatedAt) - julianday(c.createdAt)) * 24 * 60 * 60
        ) as avgSeconds
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND LOWER(col.name) IN ('done', 'completed', 'finished')
        AND c.updatedAt >= ? AND c.updatedAt <= ?
      `, [userId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result.avgSeconds || 0);
      });
    });
    
    res.json({
      period,
      dateRange: {
        start: startDateISO,
        end: endDateISO
      },
      totals: {
        totalBoards,
        totalCards,
        completedCards,
        overdueCards,
        completionRate: totalCards > 0 ? (completedCards / totalCards * 100).toFixed(2) : 0
      },
      productivity: {
        cardsCreated,
        cardsCompleted,
        averageCompletionTimeHours: (avgCompletionTime / 3600).toFixed(2)
      },
      distributions: {
        priority: priorityDistribution
      }
    });
    
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/v1/analytics/boards/{id}:
 *   get:
 *     tags: [Analytics]
 *     summary: Analytics específicas de um quadro
 *     description: Retorna métricas detalhadas de um quadro específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do quadro
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período para análise
 *     responses:
 *       200:
 *         description: Analytics do quadro
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 boardId:
 *                   type: integer
 *                 boardName:
 *                   type: string
 *                 period:
 *                   type: string
 *                 columns:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       cardCount:
 *                         type: integer
 *                       avgTimeInColumn:
 *                         type: number
 *                 cardFlow:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: array
 *                     moved:
 *                       type: array
 *                     completed:
 *                       type: array
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/boards/:id', apiLimiter, verifyToken, async (req, res) => {
  const boardId = parseInt(req.params.id);
  const period = req.query.period || 'month';
  const userId = req.userId;
  
  try {
    // Check if board exists and user has permission
    const board = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM boards WHERE id = ? AND userId = ?", [boardId, userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    if (!board) {
      return res.status(404).json({ error: "Quadro não encontrado" });
    }
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    const startDateISO = startDate.toISOString();
    const endDateISO = now.toISOString();
    
    // Get column statistics
    const columnStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          col.name,
          col.id,
          COUNT(c.id) as cardCount,
          AVG(CASE 
            WHEN c.updatedAt > c.createdAt 
            THEN (julianday(c.updatedAt) - julianday(c.createdAt)) * 24 
            ELSE 0 
          END) as avgTimeInColumnHours
        FROM columns col
        LEFT JOIN cards c ON col.id = c.columnId
        WHERE col.boardId = ?
        GROUP BY col.id, col.name
        ORDER BY col.position
      `, [boardId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    // Get card flow data
    const cardsCreated = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DATE(c.createdAt) as date, COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        WHERE col.boardId = ? 
        AND c.createdAt >= ? AND c.createdAt <= ?
        GROUP BY DATE(c.createdAt)
        ORDER BY date ASC
      `, [boardId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    // Get velocity (cards completed per day)
    const cardsCompleted = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DATE(c.updatedAt) as date, COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        WHERE col.boardId = ? 
        AND c.updatedAt >= ? AND c.updatedAt <= ?
        AND LOWER(col.name) IN ('done', 'completed', 'finished')
        GROUP BY DATE(c.updatedAt)
        ORDER BY date ASC
      `, [boardId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    // Get bottleneck analysis (columns with most cards and longest avg time)
    const bottlenecks = columnStats
      .filter(col => col.cardCount > 0)
      .sort((a, b) => (b.avgTimeInColumnHours || 0) - (a.avgTimeInColumnHours || 0))
      .slice(0, 3);
    
    res.json({
      boardId,
      boardName: board.name,
      period,
      dateRange: {
        start: startDateISO,
        end: endDateISO
      },
      columns: columnStats.map(col => ({
        name: col.name,
        cardCount: col.cardCount,
        avgTimeInColumnHours: parseFloat((col.avgTimeInColumnHours || 0).toFixed(2))
      })),
      cardFlow: {
        created: cardsCreated,
        completed: cardsCompleted
      },
      bottlenecks,
      totalCards: columnStats.reduce((sum, col) => sum + col.cardCount, 0)
    });
    
  } catch (error) {
    console.error('Board analytics error:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/v1/analytics/users/{id}:
 *   get:
 *     tags: [Analytics]
 *     summary: Analytics de usuário
 *     description: Retorna métricas de produtividade de um usuário específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período para análise
 *     responses:
 *       200:
 *         description: Analytics do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 period:
 *                   type: string
 *                 activityLevel:
 *                   type: string
 *                   enum: [low, medium, high]
 *                 productivity:
 *                   type: object
 *                   properties:
 *                     cardsCreated:
 *                       type: integer
 *                     cardsCompleted:
 *                       type: integer
 *                     averageDailyActivity:
 *                       type: number
 *                 timeDistribution:
 *                   type: object
 *                   properties:
 *                     mostActiveHour:
 *                       type: integer
 *                     mostActiveDay:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Sem permissão para ver analytics de outro usuário
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/users/:id', apiLimiter, verifyToken, async (req, res) => {
  const targetUserId = parseInt(req.params.id);
  const period = req.query.period || 'month';
  
  // Users can only see their own analytics (unless admin feature is added later)
  if (targetUserId !== req.userId) {
    return res.status(403).json({ error: "Sem permissão para ver analytics de outro usuário" });
  }
  
  try {
    // Get user info
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT id, username FROM users WHERE id = ?", [targetUserId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    const startDateISO = startDate.toISOString();
    const endDateISO = now.toISOString();
    
    // Get activity metrics
    const cardsCreated = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND c.createdAt >= ? AND c.createdAt <= ?
      `, [targetUserId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    const cardsCompleted = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND c.updatedAt >= ? AND c.updatedAt <= ?
        AND LOWER(col.name) IN ('done', 'completed', 'finished')
      `, [targetUserId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    // Calculate activity level
    const daysDiff = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const averageDailyActivity = (cardsCreated + cardsCompleted) / daysDiff;
    
    let activityLevel;
    if (averageDailyActivity >= 5) activityLevel = 'high';
    else if (averageDailyActivity >= 2) activityLevel = 'medium';
    else activityLevel = 'low';
    
    // Get time distribution (most active hour and day)
    const timeDistribution = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          strftime('%H', c.createdAt) as hour,
          strftime('%w', c.createdAt) as dayOfWeek,
          COUNT(*) as activity_count
        FROM cards c 
        JOIN columns col ON c.columnId = col.id 
        JOIN boards b ON col.boardId = b.id 
        WHERE b.userId = ? 
        AND c.createdAt >= ? AND c.createdAt <= ?
        GROUP BY strftime('%H', c.createdAt), strftime('%w', c.createdAt)
        ORDER BY activity_count DESC
      `, [targetUserId, startDateISO, endDateISO], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    const mostActiveHour = timeDistribution.length > 0 ? parseInt(timeDistribution[0].hour) : null;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mostActiveDay = timeDistribution.length > 0 ? dayNames[parseInt(timeDistribution[0].dayOfWeek)] : null;
    
    res.json({
      userId: targetUserId,
      username: user.username,
      period,
      dateRange: {
        start: startDateISO,
        end: endDateISO
      },
      activityLevel,
      productivity: {
        cardsCreated,
        cardsCompleted,
        averageDailyActivity: parseFloat(averageDailyActivity.toFixed(2))
      },
      timeDistribution: {
        mostActiveHour,
        mostActiveDay
      }
    });
    
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;