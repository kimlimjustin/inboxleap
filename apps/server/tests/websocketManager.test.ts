import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SecureWebSocketManager, AuthenticatedWebSocket } from '../src/services/websocketManager';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createMockStorage } from './helpers';

// Mock dependencies
vi.mock('../src/storage', () => ({
  storage: createMockStorage(),
}));

vi.mock('cookie', () => ({
  parse: vi.fn(),
}));

describe('SecureWebSocketManager', () => {
  let wsManager: SecureWebSocketManager;
  let mockStorage: any;
  let mockCookieParse: any;

  beforeEach(async () => {
    wsManager = new SecureWebSocketManager();
    
    const { storage } = await import('../src/storage');
    const { parse } = await import('cookie');
    
    mockStorage = storage;
    mockCookieParse = parse;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSession', () => {
    it('should return null for invalid session (placeholder implementation)', async () => {
      const result = await wsManager.validateSession('invalid-session-id');
      expect(result).toBeNull();
    });

    it('should handle session validation errors', async () => {
      // This tests the error handling in the current placeholder implementation
      const result = await wsManager.validateSession('any-session-id');
      expect(result).toBeNull();
    });
  });

  describe('authenticateConnection', () => {
    let mockWs: AuthenticatedWebSocket;
    let mockRequest: IncomingMessage;

    beforeEach(() => {
      mockWs = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as any;

      mockRequest = {
        headers: {},
      } as IncomingMessage;
    });

    it('should return false when no cookies present', async () => {
      mockRequest.headers.cookie = undefined;
      
      const result = await wsManager.authenticateConnection(mockWs, mockRequest);
      expect(result).toBe(false);
    });

    it('should return false when no session cookie present', async () => {
      mockRequest.headers.cookie = 'other=value';
      mockCookieParse.mockReturnValue({ other: 'value' });
      
      const result = await wsManager.authenticateConnection(mockWs, mockRequest);
      expect(result).toBe(false);
    });

    it('should return false for valid session cookie (placeholder implementation)', async () => {
      mockRequest.headers.cookie = 'connect.sid=valid-session-id';
      mockCookieParse.mockReturnValue({ 'connect.sid': 'valid-session-id' });
      
      const result = await wsManager.authenticateConnection(mockWs, mockRequest);
      expect(result).toBe(false); // Current implementation always returns false
    });

    it('should handle authentication errors gracefully', async () => {
      mockRequest.headers.cookie = 'connect.sid=valid-session-id';
      mockCookieParse.mockImplementation(() => {
        throw new Error('Cookie parsing failed');
      });
      
      const result = await wsManager.authenticateConnection(mockWs, mockRequest);
      expect(result).toBe(false);
    });
  });

  describe('registerConnection', () => {
    let mockWs: WebSocket;

    beforeEach(() => {
      mockWs = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as any;
    });

    it('should register authenticated connection', () => {
      const userInfo = { userId: 'user-1', email: 'user@example.com' };
      
      wsManager.registerConnection(mockWs, userInfo);
      
      const retrievedInfo = wsManager.getUserInfo(mockWs);
      expect(retrievedInfo).toEqual(userInfo);
    });

    it('should set up cleanup handlers', () => {
      const userInfo = { userId: 'user-1', email: 'user@example.com' };
      
      wsManager.registerConnection(mockWs, userInfo);
      
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should clean up on connection close', () => {
      const userInfo = { userId: 'user-1', email: 'user@example.com' };
      
      wsManager.registerConnection(mockWs, userInfo);
      
      // Simulate close event
      const closeHandler = (mockWs.on as any).mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler();
      
      const retrievedInfo = wsManager.getUserInfo(mockWs);
      expect(retrievedInfo).toBeUndefined();
    });

    it('should clean up on connection error', () => {
      const userInfo = { userId: 'user-1', email: 'user@example.com' };
      
      wsManager.registerConnection(mockWs, userInfo);
      
      // Simulate error event
      const errorHandler = (mockWs.on as any).mock.calls.find((call: any) => call[0] === 'error')[1];
      errorHandler();
      
      const retrievedInfo = wsManager.getUserInfo(mockWs);
      expect(retrievedInfo).toBeUndefined();
    });
  });

  describe('getUserInfo', () => {
    let mockWs: WebSocket;

    beforeEach(() => {
      mockWs = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as any;
    });

    it('should return undefined for unregistered connection', () => {
      const result = wsManager.getUserInfo(mockWs);
      expect(result).toBeUndefined();
    });

    it('should return user info for registered connection', () => {
      const userInfo = { userId: 'user-1', email: 'user@example.com' };
      
      wsManager.registerConnection(mockWs, userInfo);
      
      const result = wsManager.getUserInfo(mockWs);
      expect(result).toEqual(userInfo);
    });
  });

  describe('broadcastToUser', () => {
    let mockWs1: WebSocket;
    let mockWs2: WebSocket;
    let mockWs3: WebSocket;

    beforeEach(() => {
      mockWs1 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
      } as any;
      
      mockWs2 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
      } as any;
      
      mockWs3 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 3, // CLOSED
      } as any;
    });

    it('should broadcast to all connections for a user', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      wsManager.registerConnection(mockWs2, { userId: 'user-1', email: 'user1@example.com' });
      wsManager.registerConnection(mockWs3, { userId: 'user-2', email: 'user2@example.com' });
      
      const message = { type: 'test', data: 'hello' };
      wsManager.broadcastToUser('user-1', message);
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should skip closed connections', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      wsManager.registerConnection(mockWs3, { userId: 'user-1', email: 'user1@example.com' });
      
      const message = { type: 'test', data: 'hello' };
      wsManager.broadcastToUser('user-1', message);
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs3.send).not.toHaveBeenCalled(); // Closed connection
    });

    it('should handle send errors gracefully', () => {
      mockWs1.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      
      const message = { type: 'test', data: 'hello' };
      
      // Should not throw
      expect(() => wsManager.broadcastToUser('user-1', message)).not.toThrow();
    });

    it('should not broadcast to non-existent user', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      
      const message = { type: 'test', data: 'hello' };
      wsManager.broadcastToUser('non-existent-user', message);
      
      expect(mockWs1.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToAll', () => {
    let mockWs1: WebSocket;
    let mockWs2: WebSocket;
    let mockWs3: WebSocket;

    beforeEach(() => {
      mockWs1 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
      } as any;
      
      mockWs2 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
      } as any;
      
      mockWs3 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 3, // CLOSED
      } as any;
    });

    it('should broadcast to all open connections', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      wsManager.registerConnection(mockWs2, { userId: 'user-2', email: 'user2@example.com' });
      wsManager.registerConnection(mockWs3, { userId: 'user-3', email: 'user3@example.com' });
      
      const message = { type: 'broadcast', data: 'hello all' };
      wsManager.broadcastToAll(message);
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs3.send).not.toHaveBeenCalled(); // Closed connection
    });

    it('should handle empty connections list', () => {
      const message = { type: 'broadcast', data: 'hello all' };
      
      // Should not throw
      expect(() => wsManager.broadcastToAll(message)).not.toThrow();
    });
  });

  describe('getConnectedUsers', () => {
    let mockWs1: WebSocket;
    let mockWs2: WebSocket;

    beforeEach(() => {
      mockWs1 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as any;
      
      mockWs2 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as any;
    });

    it('should return list of connected users', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      wsManager.registerConnection(mockWs2, { userId: 'user-2', email: 'user2@example.com' });
      
      const connectedUsers = wsManager.getConnectedUsers();
      
      expect(connectedUsers).toEqual([
        { userId: 'user-1', email: 'user1@example.com' },
        { userId: 'user-2', email: 'user2@example.com' },
      ]);
    });

    it('should return empty array when no connections', () => {
      const connectedUsers = wsManager.getConnectedUsers();
      expect(connectedUsers).toEqual([]);
    });

    it('should handle duplicate users with multiple connections', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      wsManager.registerConnection(mockWs2, { userId: 'user-1', email: 'user1@example.com' });
      
      const connectedUsers = wsManager.getConnectedUsers();
      
      // Should include both connections (not deduplicated)
      expect(connectedUsers).toHaveLength(2);
      expect(connectedUsers[0]).toEqual({ userId: 'user-1', email: 'user1@example.com' });
      expect(connectedUsers[1]).toEqual({ userId: 'user-1', email: 'user1@example.com' });
    });
  });

  describe('isUserConnected', () => {
    let mockWs1: WebSocket;

    beforeEach(() => {
      mockWs1 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as any;
    });

    it('should return true for connected user', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      
      const isConnected = wsManager.isUserConnected('user-1');
      expect(isConnected).toBe(true);
    });

    it('should return false for non-connected user', () => {
      const isConnected = wsManager.isUserConnected('non-existent-user');
      expect(isConnected).toBe(false);
    });

    it('should return false after user disconnects', () => {
      wsManager.registerConnection(mockWs1, { userId: 'user-1', email: 'user1@example.com' });
      
      expect(wsManager.isUserConnected('user-1')).toBe(true);
      
      // Simulate close event
      const closeHandler = (mockWs1.on as any).mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler();
      
      expect(wsManager.isUserConnected('user-1')).toBe(false);
    });
  });
});
