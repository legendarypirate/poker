import { WS_URL } from './config';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url?: string) {
    this.url = url || WS_URL;
  }

  connect(username: string, roomId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      const wsUrl = `${this.url}?username=${encodeURIComponent(username)}&roomId=${encodeURIComponent(roomId)}`;
      console.log(`🔌 Attempting to connect to: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        // Provide more detailed error information
        const errorMessage = this.ws?.readyState === WebSocket.CLOSED 
          ? 'WebSocket server is not running or unreachable. Please check if the server is running on port 3001.'
          : 'WebSocket connection error occurred.';
        this.emit('error', { 
          error, 
          message: errorMessage,
          readyState: this.ws?.readyState 
        });
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket closed', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        this.stopHeartbeat();
        
        // Only attempt reconnect if it wasn't a manual close
        if (event.code !== 1000) {
          this.emit('disconnected', { code: event.code, reason: event.reason });
          this.attemptReconnect(username, roomId);
        } else {
          this.emit('disconnected', { code: event.code, reason: event.reason });
        }
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.emit('error', { 
        error, 
        message: 'Failed to create WebSocket connection. Please check your network and server status.' 
      });
      this.attemptReconnect(username, roomId);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(username: string, roomId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Retrying connection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(username, roomId);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttempts', {});
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  private handleMessage(data: any) {
    if (data.type) {
      this.emit(data.type, data);
    }
    this.emit('message', data);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      // Use code 1000 to indicate normal closure (won't trigger reconnect)
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

