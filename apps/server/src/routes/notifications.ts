import { Express } from 'express';
import { isAuthenticated } from '../googleAuth';
import { storage } from '../storage';
import { insertNotificationPreferencesSchema } from '@email-task-router/shared';

export function registerNotificationRoutes(app: Express) {
  
  // Get user's notification preferences
  app.get('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      let preferences = await storage.getNotificationPreferences(userId);
      
      // If no preferences exist, create default ones
      if (!preferences) {
        preferences = await storage.upsertNotificationPreferences(userId, {
          emailNotifications: true,
          newTaskAlerts: true,
          projectUpdates: true,
          taskStatusChanges: true,
          taskAssignments: true,
          taskDueReminders: true,
          weeklyDigest: false
        });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({ message: 'Failed to get notification preferences' });
    }
  });

  // Update user's notification preferences
  app.patch('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate the request body
      const validatedData = insertNotificationPreferencesSchema.parse({
        userId,
        ...req.body
      });

      const preferences = await storage.upsertNotificationPreferences(userId, validatedData);
      
      res.json({
        message: 'Notification preferences updated successfully',
        preferences
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  });

  // Update a specific notification setting
  app.patch('/api/notifications/preferences/:setting', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { setting } = req.params;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled must be a boolean' });
      }
      
      // Validate setting name
      const validSettings = [
        'emailNotifications',
        'newTaskAlerts', 
        'projectUpdates',
        'taskStatusChanges',
        'taskAssignments',
        'taskDueReminders',
        'weeklyDigest'
      ];
      
      if (!validSettings.includes(setting)) {
        return res.status(400).json({ 
          message: 'Invalid setting name',
          validSettings
        });
      }
      
      // Update just this setting
      const updateData = { [setting]: enabled };
      const preferences = await storage.upsertNotificationPreferences(userId, updateData);
      
      res.json({
        message: `${setting} ${enabled ? 'enabled' : 'disabled'} successfully`,
        preferences
      });
    } catch (error) {
      console.error('Error updating notification setting:', error);
      res.status(500).json({ message: 'Failed to update notification setting' });
    }
  });
}