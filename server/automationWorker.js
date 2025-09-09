const { executeAutomations } = require('./automationRoutes');
const { db, run, get, all } = require('./database');
const { logActivity } = require('./activityLogger');

class AutomationWorker {
  constructor() {
    this.isRunning = false;
    this.interval = null;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🤖 Automation Worker started');
    
    // Check for scheduled automations every minute
    this.interval = setInterval(async () => {
      await this.processDueDateAutomations();
    }, 60000); // 60 seconds
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('🤖 Automation Worker stopped');
  }

  async triggerAutomation(boardId, triggerType, triggerData) {
    try {
      console.log(`🤖 Triggering automations for board ${boardId}, type: ${triggerType}`);
      
      const results = await executeAutomations(boardId, triggerType, triggerData);
      
      console.log(`🤖 Executed ${results.length} automations`);
      return results;
    } catch (error) {
      console.error('🤖 Error triggering automations:', error);
      return [];
    }
  }

  async processDueDateAutomations() {
    try {
      // Find cards with approaching due dates
      const cards = await all(`
        SELECT c.*, co.board_id 
        FROM cards c
        JOIN columns co ON c.column_id = co.id
        WHERE c.due_date IS NOT NULL 
        AND date(c.due_date) IN (
          date('now', '+1 day'),
          date('now', '+3 days'),
          date('now', '+7 days'),
          date('now')
        )
      `);

      for (const card of cards) {
        const daysDiff = this.getDaysDifference(new Date(), new Date(card.due_date));
        
        if ([0, 1, 3, 7].includes(daysDiff)) {
          await this.triggerAutomation(card.board_id, 'due_date_approaching', {
            card,
            days_until_due: daysDiff
          });
        }
      }
    } catch (error) {
      console.error('🤖 Error processing due date automations:', error);
    }
  }

  getDaysDifference(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((date2 - date1) / oneDay);
  }

  // Event handlers for real-time triggers
  async onCardCreated(card, boardId) {
    return await this.triggerAutomation(boardId, 'card_created', { card });
  }

  async onCardMoved(card, fromColumn, toColumn, boardId) {
    return await this.triggerAutomation(boardId, 'card_moved', {
      card,
      from_column: fromColumn,
      to_column: toColumn
    });
  }

  async onCardUpdated(oldCard, newCard, boardId) {
    return await this.triggerAutomation(boardId, 'card_updated', {
      old_card: oldCard,
      new_card: newCard,
      changes: this.getCardChanges(oldCard, newCard)
    });
  }

  async onCardCompleted(card, boardId) {
    return await this.triggerAutomation(boardId, 'card_completed', { card });
  }

  async onChecklistCompleted(card, checklist, boardId) {
    return await this.triggerAutomation(boardId, 'checklist_completed', {
      card,
      checklist
    });
  }

  getCardChanges(oldCard, newCard) {
    const changes = {};
    
    const fields = ['title', 'description', 'priority', 'assignee_id', 'due_date', 'status'];
    
    fields.forEach(field => {
      if (oldCard[field] !== newCard[field]) {
        changes[field] = {
          from: oldCard[field],
          to: newCard[field]
        };
      }
    });

    return changes;
  }
}

// Singleton instance
const automationWorker = new AutomationWorker();

// Auto-start when module is loaded
automationWorker.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🤖 Shutting down automation worker...');
  automationWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🤖 Shutting down automation worker...');
  automationWorker.stop();
  process.exit(0);
});

module.exports = automationWorker;