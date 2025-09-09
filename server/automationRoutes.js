const express = require('express');
const { db, run, get, all } = require('./database');
const auth = require('./auth');
const { logActivity } = require('./activityLogger');

const router = express.Router();

// Get all automations for a board
router.get('/boards/:boardId/automations', auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const automations = await all(
      'SELECT * FROM automations WHERE board_id = ? ORDER BY created_at DESC',
      [boardId]
    );
    
    res.json({ success: true, data: automations });
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch automations' });
  }
});

// Create new automation
router.post('/automations', auth, async (req, res) => {
  try {
    const {
      board_id,
      name,
      trigger_type,
      trigger_config,
      conditions,
      actions
    } = req.body;

    if (!board_id || !name || !trigger_type) {
      return res.status(400).json({
        success: false,
        error: 'Board ID, name, and trigger type are required'
      });
    }

    const result = await run(`
      INSERT INTO automations (
        board_id, name, trigger_type, trigger_config, 
        conditions, actions, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `, [
      board_id,
      name,
      trigger_type,
      JSON.stringify(trigger_config || {}),
      JSON.stringify(conditions || []),
      JSON.stringify(actions || [])
    ]);

    const automation = await get('SELECT * FROM automations WHERE id = ?', [result.id]);
    
    // Log activity
    await logActivity(
      req.user.id,
      board_id,
      null,
      'create',
      'automation',
      result.id,
      null,
      { name, trigger_type },
      `Automação "${name}" criada`
    );

    res.json({ success: true, data: automation });
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ success: false, error: 'Failed to create automation' });
  }
});

// Update automation
router.put('/automations/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      trigger_type,
      trigger_config,
      conditions,
      actions,
      is_active
    } = req.body;

    const existingAutomation = await get('SELECT * FROM automations WHERE id = ?', [id]);
    if (!existingAutomation) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }

    await run(`
      UPDATE automations 
      SET name = ?, trigger_type = ?, trigger_config = ?, 
          conditions = ?, actions = ?, is_active = ?, 
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      name || existingAutomation.name,
      trigger_type || existingAutomation.trigger_type,
      JSON.stringify(trigger_config || JSON.parse(existingAutomation.trigger_config || '{}')),
      JSON.stringify(conditions || JSON.parse(existingAutomation.conditions || '[]')),
      JSON.stringify(actions || JSON.parse(existingAutomation.actions || '[]')),
      is_active !== undefined ? is_active : existingAutomation.is_active,
      id
    ]);

    const updatedAutomation = await get('SELECT * FROM automations WHERE id = ?', [id]);
    
    // Log activity
    await logActivity(
      req.user.id,
      existingAutomation.board_id,
      null,
      'update',
      'automation',
      id,
      { name: existingAutomation.name, is_active: existingAutomation.is_active },
      { name: updatedAutomation.name, is_active: updatedAutomation.is_active },
      `Automação "${updatedAutomation.name}" atualizada`
    );

    res.json({ success: true, data: updatedAutomation });
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ success: false, error: 'Failed to update automation' });
  }
});

// Delete automation
router.delete('/automations/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const automation = await get('SELECT * FROM automations WHERE id = ?', [id]);
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }

    await run('DELETE FROM automations WHERE id = ?', [id]);
    
    // Log activity
    await logActivity(
      req.user.id,
      automation.board_id,
      null,
      'delete',
      'automation',
      id,
      { name: automation.name },
      null,
      `Automação "${automation.name}" deletada`
    );

    res.json({ success: true, message: 'Automation deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ success: false, error: 'Failed to delete automation' });
  }
});

// Test automation
router.post('/automations/:id/test', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { testData } = req.body;

    const automation = await get('SELECT * FROM automations WHERE id = ?', [id]);
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }

    // Simulate automation execution
    const result = await simulateAutomationExecution(automation, testData || {});
    
    // Log test execution
    await run(`
      INSERT INTO automation_logs (automation_id, trigger_data, execution_result, executed_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [id, JSON.stringify(testData || {}), 'test_success']);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error testing automation:', error);
    res.status(500).json({ success: false, error: 'Failed to test automation' });
  }
});

// Get automation logs
router.get('/automations/:id/logs', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    const logs = await all(`
      SELECT * FROM automation_logs 
      WHERE automation_id = ? 
      ORDER BY executed_at DESC 
      LIMIT ?
    `, [id, parseInt(limit)]);

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching automation logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

// Card template endpoints
router.get('/boards/:boardId/templates', auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const templates = await all(
      'SELECT * FROM card_templates WHERE board_id = ? ORDER BY created_at DESC',
      [boardId]
    );
    
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

router.post('/templates', auth, async (req, res) => {
  try {
    const {
      board_id,
      name,
      title,
      description,
      priority,
      labels
    } = req.body;

    if (!board_id || !name || !title) {
      return res.status(400).json({
        success: false,
        error: 'Board ID, name, and title are required'
      });
    }

    const result = await run(`
      INSERT INTO card_templates (
        name, title, description, priority, labels, board_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      name,
      title,
      description || null,
      priority || 'medium',
      JSON.stringify(labels || []),
      board_id
    ]);

    const template = await get('SELECT * FROM card_templates WHERE id = ?', [result.id]);
    
    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

router.delete('/templates/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await get('SELECT * FROM card_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    await run('DELETE FROM card_templates WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

// Update column with WIP limits
router.put('/columns/:id/config', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { wip_limit, is_collapsed } = req.body;
    
    const column = await get('SELECT * FROM columns WHERE id = ?', [id]);
    if (!column) {
      return res.status(404).json({ success: false, error: 'Column not found' });
    }

    await run(`
      UPDATE columns 
      SET wip_limit = ?, is_collapsed = ?
      WHERE id = ?
    `, [
      wip_limit,
      is_collapsed !== undefined ? is_collapsed : column.is_collapsed,
      id
    ]);

    const updatedColumn = await get('SELECT * FROM columns WHERE id = ?', [id]);
    
    res.json({ success: true, data: updatedColumn });
  } catch (error) {
    console.error('Error updating column config:', error);
    res.status(500).json({ success: false, error: 'Failed to update column' });
  }
});

// Simulation function for automation testing
async function simulateAutomationExecution(automation, testData) {
  const triggerConfig = JSON.parse(automation.trigger_config || '{}');
  const conditions = JSON.parse(automation.conditions || '[]');
  const actions = JSON.parse(automation.actions || '[]');

  const result = {
    automation_id: automation.id,
    automation_name: automation.name,
    trigger_type: automation.trigger_type,
    test_data: testData,
    conditions_met: true,
    actions_executed: [],
    simulation: true
  };

  // Simulate condition checking
  for (const condition of conditions) {
    // This would contain actual condition logic in production
    result.actions_executed.push({
      condition: condition,
      result: 'simulated_pass'
    });
  }

  // Simulate action execution
  for (const action of actions) {
    result.actions_executed.push({
      action: action,
      result: 'simulated_success'
    });
  }

  return result;
}

// Execute automations (this would be called by triggers)
async function executeAutomations(boardId, triggerType, triggerData) {
  try {
    const automations = await all(`
      SELECT * FROM automations 
      WHERE board_id = ? AND trigger_type = ? AND is_active = 1
    `, [boardId, triggerType]);

    const results = [];
    
    for (const automation of automations) {
      try {
        const result = await executeAutomation(automation, triggerData);
        results.push(result);
        
        // Log execution
        await run(`
          INSERT INTO automation_logs (automation_id, trigger_data, execution_result, executed_at)
          VALUES (?, ?, ?, datetime('now'))
        `, [automation.id, JSON.stringify(triggerData), 'success']);
        
      } catch (error) {
        console.error(`Error executing automation ${automation.id}:`, error);
        
        // Log failure
        await run(`
          INSERT INTO automation_logs (automation_id, trigger_data, execution_result, error_message, executed_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `, [automation.id, JSON.stringify(triggerData), 'error', error.message]);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error executing automations:', error);
    throw error;
  }
}

async function executeAutomation(automation, triggerData) {
  const conditions = JSON.parse(automation.conditions || '[]');
  const actions = JSON.parse(automation.actions || '[]');

  // Check conditions
  const conditionsMet = await checkConditions(conditions, triggerData);
  if (!conditionsMet) {
    return { automation_id: automation.id, skipped: true, reason: 'conditions_not_met' };
  }

  // Execute actions
  const actionResults = [];
  for (const action of actions) {
    try {
      const result = await executeAction(action, triggerData);
      actionResults.push(result);
    } catch (error) {
      actionResults.push({ action, error: error.message });
    }
  }

  return {
    automation_id: automation.id,
    executed: true,
    action_results: actionResults
  };
}

async function checkConditions(conditions, triggerData) {
  // Implementation would depend on condition types
  // For now, return true for simulation
  return true;
}

async function executeAction(action, triggerData) {
  // Implementation would depend on action types
  // Examples: send notification, move card, update field, etc.
  switch (action.type) {
    case 'move_card':
      // Implementation for moving card
      break;
    case 'send_notification':
      // Implementation for sending notification
      break;
    case 'update_field':
      // Implementation for updating field
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
  
  return { action, result: 'simulated_success' };
}

// Export the function to be used by other modules
module.exports = { router, executeAutomations };