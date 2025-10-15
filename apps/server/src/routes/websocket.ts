import { createServer, type Server } from 'http';
import { WebSocketServer } from 'ws';
import { Express } from 'express';
import { storage } from '../storage';
import { emailService } from '../services/emailService';
import { wsManager } from '../services/websocketManager';

export function setupWebSocket(app: Express): Server {
  // WebSocket setup for real-time task updates with user authentication
  const wss = new WebSocketServer({ noServer: true });
  const server = createServer(app);
  
  server.on('upgrade', async (request, socket, head) => {
    try {
      // Parse session from cookies to authenticate WebSocket connection
      const cookieHeader = request.headers.cookie;
      if (!cookieHeader) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Simple session parsing
      const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('connect.sid='));
      if (!sessionCookie) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // Listen to email service events for real-time updates (with security)
  emailService.on('tasksCreated', async (data) => {
    console.log('📡 Broadcasting tasks created event via WebSocket (secure)');
    
    const projectId = data.projectId || (data.tasks && data.tasks[0]?.projectId);
    if (projectId) {
      await wsManager.broadcastToProjectUsers({
        type: 'tasks_created',
        data: data
      }, projectId);
    }
  });

  emailService.on('reply_processed', async (data) => {
    console.log('📡 Broadcasting reply processed event via WebSocket (secure)');
    
    const projectId = data.projectId;
    if (projectId) {
      await wsManager.broadcastToProjectUsers({
        type: 'reply_processed',
        data: data
      }, projectId);
    }
  });

  // Connection established with authentication
  wss.on('connection', async (ws, request) => {
    try {
      const cookieHeader = request.headers.cookie;
      if (!cookieHeader) {
        console.warn('WebSocket connection rejected: No cookies');
        ws.close(1008, 'Authentication required');
        return;
      }

      // Send auth request
      ws.send(JSON.stringify({
        type: 'auth_required',
        message: 'Please authenticate your WebSocket connection'
      }));

      // Handle authentication message
      const authTimeout = setTimeout(() => {
        console.warn('WebSocket connection timeout: No authentication received');
        ws.close(1008, 'Authentication timeout');
      }, 10000);

      const authHandler = async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'authenticate') {
            let userInfo = null;
            
            if (data.sessionId) {
              userInfo = await wsManager.validateSession(data.sessionId);
            }
            
            if (!userInfo && data.userId && data.email) {
              try {
                const user = await storage.getUser(data.userId);
                if (user && user.email === data.email && user.email) {
                  userInfo = {
                    userId: user.id,
                    email: user.email
                  };
                }
              } catch (error) {
                console.error('User lookup error during WebSocket auth:', error);
              }
            }
            
            if (userInfo) {
              clearTimeout(authTimeout);
              ws.removeListener('message', authHandler);
              
              wsManager.registerConnection(ws, userInfo);
              
              ws.send(JSON.stringify({
                type: 'authenticated',
                message: 'WebSocket connection authenticated successfully'
              }));
              
              console.log(`✅ WebSocket authenticated for user: ${userInfo.email}`);
            } else {
              ws.close(1008, 'Invalid authentication credentials');
            }
          } else {
            ws.close(1008, 'Invalid authentication message format');
          }
        } catch (error) {
          console.error('WebSocket auth error:', error);
          ws.close(1008, 'Authentication failed');
        }
      };

      ws.on('message', authHandler);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return server;
}
