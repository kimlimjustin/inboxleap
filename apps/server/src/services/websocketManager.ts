import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse as parseCookie } from 'cookie';
import { storage } from '../storage.js';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  email?: string;
  isAuthenticated?: boolean;
}

export class SecureWebSocketManager {
  private authenticatedConnections = new Map<WebSocket, { userId: string; email: string }>();

  /**
   * Validate session and extract user info from session data
   * This should be integrated with your existing session middleware
   */
  async validateSession(sessionId: string): Promise<{ userId: string; email: string } | null> {
    try {
      // TODO: Integrate with your actual session store
      // This is a placeholder implementation
      // You should replace this with code that:
      // 1. Validates the session ID against your session store (Redis, memory, etc.)
      // 2. Extracts user information from the session
      // 3. Returns user info if valid, null if invalid
      
      // For now, return null to force explicit authentication
      return null;
      
      // Example of what this might look like:
      // const sessionData = await yourSessionStore.get(sessionId);
      // if (!sessionData || !sessionData.user) {
      //   return null;
      // }
      // return {
      //   userId: sessionData.user.id,
      //   email: sessionData.user.email
      // };
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Authenticate a WebSocket connection using session cookies
   */
  async authenticateConnection(ws: AuthenticatedWebSocket, request: IncomingMessage): Promise<boolean> {
    try {
      const cookieHeader = request.headers.cookie;
      if (!cookieHeader) {
        return false;
      }

      const cookies = parseCookie(cookieHeader);
      const sessionId = cookies['connect.sid'];
      
      if (!sessionId) {
        return false;
      }

      // TODO: Validate session against your session store
      // For now, this is a simplified implementation
      // You should integrate this with your existing session middleware
      
      // Extract session data (this would come from your session store)
      // const sessionData = await getSessionData(sessionId);
      // if (!sessionData || !sessionData.user) {
      //   return false;
      // }

      // For now, we'll use a different approach - require explicit auth message
      return false; // Force explicit authentication
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      return false;
    }
  }

  /**
   * Register an authenticated WebSocket connection
   */
  registerConnection(ws: WebSocket, userInfo: { userId: string; email: string }): void {
    this.authenticatedConnections.set(ws, userInfo);
    
    // Set up cleanup on close
    ws.on('close', () => {
      this.authenticatedConnections.delete(ws);
    });
    
    ws.on('error', () => {
      this.authenticatedConnections.delete(ws);
    });
  }

  /**
   * Get user info for a WebSocket connection
   */
  getUserInfo(ws: WebSocket): { userId: string; email: string } | undefined {
    return this.authenticatedConnections.get(ws);
  }

  /**
   * Broadcast message to users who have access to a specific project
   */
  async broadcastToProjectUsers(message: any, projectId: number): Promise<void> {
    try {
      const authorizedUserIds = new Set<string>();
      
      // Get project and its participants
      const project = await storage.getProject(projectId);
      if (project) {
        authorizedUserIds.add(project.createdBy);
        
        const participants = await storage.getProjectParticipants(projectId);
        participants.forEach(p => authorizedUserIds.add(p.userId));
      }

      const messageStr = JSON.stringify(message);
      
      this.authenticatedConnections.forEach((userInfo, client) => {
        if (client.readyState === WebSocket.OPEN && authorizedUserIds.has(userInfo.userId)) {
          client.send(messageStr);
        }
      });

      console.log(`📡 Broadcasted to ${authorizedUserIds.size} users for project ${projectId}`);
    } catch (error) {
      console.error('Error in project broadcast:', error);
    }
  }

  /**
   * Broadcast message to users who have access to a specific task
   */
  async broadcastToTaskUsers(message: any, taskId: number): Promise<void> {
    try {
      const task = await storage.getTask(taskId);
      if (!task) {
        console.warn(`Task ${taskId} not found for broadcast`);
        return;
      }

      const authorizedUserIds = new Set<string>();
      
      // Add task creator
      authorizedUserIds.add(task.createdBy);

      // Add project users
      if (task.projectId) {
        const project = await storage.getProject(task.projectId);
        if (project) {
          authorizedUserIds.add(project.createdBy);
          
          const participants = await storage.getProjectParticipants(task.projectId);
          participants.forEach(p => authorizedUserIds.add(p.userId));
        }
      }

      // Add task assignees
      const assignees = await storage.getTaskAssignees(taskId);
      assignees.forEach(assignee => authorizedUserIds.add(assignee.userId));

      const messageStr = JSON.stringify(message);
      
      this.authenticatedConnections.forEach((userInfo, client) => {
        if (client.readyState === WebSocket.OPEN && authorizedUserIds.has(userInfo.userId)) {
          client.send(messageStr);
        }
      });

      console.log(`📡 Broadcasted task update to ${authorizedUserIds.size} authorized users`);
    } catch (error) {
      console.error('Error in task broadcast:', error);
    }
  }

  /**
   * Broadcast to specific users only
   */
  broadcastToUsers(message: any, userIds: string[]): void {
    const messageStr = JSON.stringify(message);
    const targetUserIds = new Set(userIds);
    
    this.authenticatedConnections.forEach((userInfo, client) => {
      if (client.readyState === WebSocket.OPEN && targetUserIds.has(userInfo.userId)) {
        client.send(messageStr);
      }
    });

    console.log(`📡 Broadcasted to ${userIds.length} specific users`);
  }

  /**
   * Get connection statistics
   */
  getStats(): { totalConnections: number; authenticatedConnections: number } {
    return {
      totalConnections: this.authenticatedConnections.size,
      authenticatedConnections: this.authenticatedConnections.size
    };
  }
}

export const wsManager = new SecureWebSocketManager();
