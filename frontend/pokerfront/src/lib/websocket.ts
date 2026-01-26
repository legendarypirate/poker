import { WS_URL } from './config';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private readonly CONNECTION_TIMEOUT = 10000; // 10 seconds

  constructor(url?: string) {
    this.url = url || WS_URL;
  }

  connect(username: string, roomId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket already connected');
      return;
    }

    // Close existing connection if any
    if (this.ws) {
      console.log('🔌 Closing existing WebSocket connection');
      this.ws.close();
      this.ws = null;
    }

    try {
      const wsUrl = `${this.url}?username=${encodeURIComponent(username)}&roomId=${encodeURIComponent(roomId)}`;
      console.log(`🔌 Attempting to connect to: ${wsUrl}`);
      console.log(`📡 Server URL: ${this.url}`);
      
      // Validate URL format
      if (!this.url.startsWith('ws://') && !this.url.startsWith('wss://')) {
        const errorMsg = `Invalid WebSocket URL format: ${this.url}. Must start with ws:// or wss://`;
        console.error('❌', errorMsg);
        this.emit('error', { 
          error: { message: errorMsg },
          message: errorMsg,
          readyState: -1 
        });
        return;
      }
      
      // Create WebSocket connection
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error: any) {
        const errorMsg = `Failed to create WebSocket: ${error?.message || 'Unknown error'}`;
        console.error('❌ WebSocket constructor error:', errorMsg);
        console.error('   Error details:', error);
        this.emit('error', { 
          error: { message: errorMsg, originalError: error },
          message: errorMsg,
          readyState: -1 
        });
        return;
      }

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.error(`❌ WebSocket connection timeout after ${this.CONNECTION_TIMEOUT}ms`);
          this.ws.close();
          const errorMsg = `Connection timeout: Server at ${this.url} did not respond within ${this.CONNECTION_TIMEOUT / 1000} seconds. Please check if the server is running.`;
          this.emit('error', {
            error: { message: errorMsg, type: 'timeout' },
            message: errorMsg,
            readyState: WebSocket.CONNECTING
          });
        }
      }, this.CONNECTION_TIMEOUT);

      this.ws.onopen = () => {
        const wasReconnecting = this.isReconnecting;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        if (wasReconnecting) {
          console.log('✅ WebSocket reconnected successfully');
        } else {
          console.log('✅ WebSocket connected');
        }
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

      this.ws.onerror = (event: Event) => {
        // WebSocket error events don't provide detailed error information
        // We can only extract what's available from the event target
        const ws = event.target as WebSocket;
        const readyState = ws?.readyState ?? this.ws?.readyState ?? -1;
        const url = ws?.url || this.ws?.url || this.url;
        
        // Get ready state name
        const readyStateNames: Record<number, string> = {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSING',
          3: 'CLOSED'
        };
        const readyStateName = readyStateNames[readyState] || 'UNKNOWN';
        
        const errorDetails: any = {
          type: event.type || 'error',
          readyState: readyState,
          readyStateName: readyStateName,
          url: url,
          timestamp: new Date().toISOString(),
          hasWebSocket: !!this.ws,
          hasEventTarget: !!event.target,
        };

        // Only log detailed errors if we're not going to retry, or if it's a connection error while already connected
        // Connection failures during initial connect will be handled by onclose with retry logic
        const willRetry = this.reconnectAttempts < this.maxReconnectAttempts && 
                         (readyState === WebSocket.CLOSED || readyState === 3 || readyState === WebSocket.CONNECTING);
        
        // Determine error message based on readyState
        let errorMessage = 'WebSocket connection error occurred.';
        
        if (readyState === WebSocket.CLOSED || readyState === 3) {
          if (willRetry) {
            // Less alarming message when we'll retry
            errorMessage = `Connection failed, will retry...`;
          } else {
            errorMessage = `WebSocket server is not running or unreachable at ${url}. Please check if the server is running on port 3001.`;
          }
        } else if (readyState === WebSocket.CONNECTING || readyState === 0) {
          if (willRetry) {
            errorMessage = `Connection attempt failed, will retry...`;
          } else {
            errorMessage = `Failed to establish WebSocket connection to ${url}. Please check your network connection and ensure the server is running.`;
          }
        } else if (readyState === WebSocket.OPEN || readyState === 1) {
          errorMessage = 'WebSocket connection error occurred while connected.';
        } else {
          errorMessage = `WebSocket error with unknown state. Server may not be running at ${url}.`;
        }

        // Only log detailed errors if we won't retry or if it's an error while connected
        const isConnected = readyState === WebSocket.OPEN || readyState === 1;
        if (!willRetry || isConnected) {
          console.error('❌ WebSocket error occurred');
          console.error('   Message:', errorMessage);
          console.error('   URL:', url);
          console.error('   Ready State:', `${readyState} (${readyStateName})`);
        } else {
          // Just log a brief message that we'll retry
          console.warn(`⚠️ Connection failed, will retry (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
        }

        this.emit('error', { 
          error: errorDetails, 
          message: errorMessage,
          readyState: readyState 
        });
      };

      this.ws.onclose = (event) => {
        // Clear connection timeout if still active
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        // Only log close if it wasn't a clean disconnect or if we're not retrying
        if (event.code !== 1000 || !this.isReconnecting) {
          console.log('🔌 WebSocket closed', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        }
        this.stopHeartbeat();
        
        // Only attempt reconnect if it wasn't a manual close
        if (event.code !== 1000) {
          this.emit('disconnected', { code: event.code, reason: event.reason });
          this.attemptReconnect(username, roomId);
        } else {
          this.isReconnecting = false;
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
      this.isReconnecting = true;
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`🔄 Retrying connection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(username, roomId);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.isReconnecting = false;
      console.error('❌ Max reconnection attempts reached. Please check if the server is running.');
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
    // Clear connection timeout if still active
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
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

