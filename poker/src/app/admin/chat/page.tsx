'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  List,
  Avatar,
  Input,
  Button,
  Typography,
  Space,
  Badge,
  Tag,
  Divider,
  Row,
  Col,
  Layout,
  Menu,
  Dropdown,
  message,
  Empty,
  Spin
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  MoreOutlined,
  SearchOutlined,
  WechatOutlined,
  DeleteOutlined,
  PhoneOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Sider, Content } = Layout;

interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  isAdmin: boolean;
  read: boolean;
}

interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  lastSeen?: Date;
}

const AdminChatSection: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('✅ Admin WebSocket connected');
      // Send admin connection message
      ws.send(JSON.stringify({
        type: 'adminConnect'
      }));
    };

    ws.onmessage = (event) => {
      console.log('📥 Admin received:', event.data);
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'adminChatUsers':
  console.log('👥 Received chat users:', data.users);
  // Convert server users to ChatUser format
  const chatUsers: ChatUser[] = data.users.map((user: any) => ({
    id: user.id,
    name: user.name,
    lastMessage: user.lastMessage || 'No messages yet',
    lastMessageTime: user.lastMessageTime ? new Date(user.lastMessageTime) : new Date(),
    unreadCount: user.unreadCount || 0,
    isOnline: false,
    lastSeen: user.lastSeen ? new Date(user.lastSeen) : undefined
  }));
  setUsers(chatUsers);
  break;

          case 'adminNewMessage':
            console.log('💬 New message received:', data.message);
            const newMessage: Message = {
              id: data.message.id,
              userId: data.message.userId,
              userName: data.message.userName || 'Unknown User',
              content: data.message.content,
              timestamp: new Date(data.message.timestamp || Date.now()),
              isAdmin: data.message.isAdmin,
              read: data.message.read
            };
            
            // Get the recipient userId - this is the user whose chat this message belongs to
            // For admin messages, recipientUserId is the user the admin sent to
            // For user messages, recipientUserId is the user who sent it
            const recipientUserId = data.recipientUserId || (data.message.isAdmin ? null : String(data.message.userId));
            
            // Add message to state if this user is selected OR if no user is selected yet (will be shown when user is selected)
            // Check if the message belongs to the selected user's chat
            if (selectedUser && recipientUserId && String(selectedUser.id) === String(recipientUserId)) {
              setMessages(prev => {
                // Check if message already exists to avoid duplicates
                // Check by id first, then by content + timestamp if id is temp
                const exists = prev.some(msg => {
                  if (msg.id === newMessage.id) return true;
                  // For optimistic messages, check by content and timestamp
                  if (msg.id.startsWith('temp-') && newMessage.id.startsWith('temp-')) {
                    return false; // Different temp IDs
                  }
                  if (msg.content === newMessage.content && 
                      Math.abs(msg.timestamp.getTime() - newMessage.timestamp.getTime()) < 2000) {
                    return true; // Same content within 2 seconds
                  }
                  return false;
                });
                if (exists) return prev;
                // Sort messages by timestamp after adding
                const updated = [...prev, newMessage].sort((a, b) => 
                  a.timestamp.getTime() - b.timestamp.getTime()
                );
                return updated;
              });
            } else if (!selectedUser && recipientUserId) {
              // Store message for when user is selected - add to a pending messages map
              // This will be merged when user is selected
              console.log('📝 Storing message for user', recipientUserId, 'to be shown when selected');
            }
            
            // Update users list with new message (for both admin and user messages)
            // For user messages, the userId is the sender
            // For admin messages, we need recipientUserId to know which user's chat to update
            const targetUserId = data.message.isAdmin ? recipientUserId : String(data.message.userId);
            
            if (targetUserId && targetUserId !== 'admin') {
              setUsers(prev => {
                const userExists = prev.some(u => String(u.id) === String(targetUserId));
                if (!userExists) {
                  // Add new user to the list
                  return [...prev, {
                    id: targetUserId,
                    name: data.message.isAdmin ? (prev.find(u => String(u.id) === String(targetUserId))?.name || 'User') : (data.message.userName || 'Unknown User'),
                    lastMessage: data.message.content,
                    lastMessageTime: new Date(data.message.timestamp),
                    unreadCount: selectedUser && String(selectedUser.id) === String(targetUserId) ? 0 : (data.message.isAdmin ? 0 : 1),
                    isOnline: false
                  }];
                }
                return prev.map(user => {
                  if (String(user.id) === String(targetUserId)) {
                    return {
                      ...user,
                      lastMessage: data.message.content,
                      lastMessageTime: new Date(data.message.timestamp),
                      unreadCount: String(user.id) === String(selectedUser?.id) ? 0 : (data.message.isAdmin ? user.unreadCount : user.unreadCount + 1)
                    };
                  }
                  return user;
                });
              });
            }
            break;

          case 'adminUserMessages':
            console.log('📚 Received message history:', {
              receivedUserId: data.userId,
              selectedUserId: selectedUser?.id,
              messageCount: data.messages?.length || 0
            });
            // Always set messages if we have a selected user matching the userId
            // Handle both string and number comparison
            const receivedUserId = String(data.userId || '');
            const currentUserId = String(selectedUser?.id || '');
            
            // Set messages if userId matches
            if (data.userId && receivedUserId === currentUserId) {
              // Merge with existing messages to avoid losing websocket messages
              setMessages(prev => {
                const historyMessages: Message[] = (data.messages || [])
                  .map((msg: any) => {
                    // Handle both Date objects and ISO strings
                    let timestamp: Date;
                    if (msg.timestamp instanceof Date) {
                      timestamp = msg.timestamp;
                    } else if (typeof msg.timestamp === 'string') {
                      timestamp = new Date(msg.timestamp);
                    } else {
                      timestamp = new Date();
                    }
                    
                    return {
                      id: msg.id || `${msg.userId || 'unknown'}-${timestamp.getTime()}`,
                      userId: String(msg.userId || 'unknown'),
                      userName: msg.userName || (msg.isAdmin ? 'Admin' : 'Unknown User'),
                      content: msg.content || msg.message || '',
                      timestamp: timestamp,
                      isAdmin: msg.isAdmin || msg.userId === 'admin',
                      read: msg.read !== undefined ? msg.read : true
                    };
                  })
                  .filter((msg: Message) => msg.content); // Filter out empty messages
                
                // Merge with existing messages, avoiding duplicates
                const messageMap = new Map<string, Message>();
                
                // Add existing messages first (these might be from websocket)
                prev.forEach(msg => {
                  messageMap.set(msg.id, msg);
                });
                
                // Add history messages, overwriting duplicates by id
                historyMessages.forEach(msg => {
                  messageMap.set(msg.id, msg);
                });
                
                // Convert to array and sort by timestamp
                const merged = Array.from(messageMap.values()).sort((a, b) => 
                  a.timestamp.getTime() - b.timestamp.getTime()
                );
                
                console.log('✅ Merged messages:', {
                  existing: prev.length,
                  history: historyMessages.length,
                  merged: merged.length
                });
                
                return merged;
              });
              setLoading(false);
            } else {
              console.warn('⚠️ User ID mismatch or no selected user:', {
                receivedUserId,
                currentUserId,
                hasSelectedUser: !!selectedUser
              });
              // Still set loading to false to prevent infinite loading
              setLoading(false);
            }
            break;

          default:
            console.log('❓ Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket connection closed');
    };

    setWebSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  // Load messages when user is selected
  useEffect(() => {
    if (selectedUser && webSocket) {
      setLoading(true);
      // Keep existing messages temporarily to avoid flicker
      // They will be merged with history or replaced if needed
      
      // Request messages for selected user
      webSocket.send(JSON.stringify({
        type: 'adminGetUserMessages',
        userId: selectedUser.id
      }));

      // Mark messages as read
      setUsers(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, unreadCount: 0 }
          : user
      ));
      
      // Fallback: set loading to false after 3 seconds if no response
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 3000);
      
      // Cleanup timeout if component unmounts or user changes
      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      // Clear messages when no user is selected
      setMessages([]);
      setLoading(false);
    }
  }, [selectedUser, webSocket]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

 const handleSendMessage = () => {
  if (!newMessage.trim() || !selectedUser || !webSocket) return;

  const messageContent = newMessage.trim();
  
  // Send message to user
  webSocket.send(JSON.stringify({
    type: 'adminSendMessage',
    userId: selectedUser.id,
    message: messageContent
  }));

  // Optimistically add message to local state for immediate UI update
  // The server will also broadcast it back via 'adminNewMessage' which will handle deduplication
  const optimisticMessage: Message = {
    id: `temp-${Date.now()}`,
    userId: 'admin',
    userName: 'Admin',
    content: messageContent,
    timestamp: new Date(),
    isAdmin: true,
    read: true
  };
  
  setMessages(prev => {
    // Check if message already exists to avoid duplicates
    const exists = prev.some(msg => msg.content === messageContent && msg.isAdmin && Math.abs(msg.timestamp.getTime() - optimisticMessage.timestamp.getTime()) < 1000);
    if (exists) return prev;
    return [...prev, optimisticMessage];
  });

  setNewMessage('');

  // Update user's last message in the list
  setUsers(prev => prev.map(user => 
    user.id === selectedUser.id 
      ? { ...user, lastMessage: messageContent, lastMessageTime: new Date() }
      : user
  ));

  message.success('Message sent!');
};
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const formatTime = (date: Date | undefined) => {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

  const getMenuItems = (user: ChatUser): MenuProps['items'] => [
    {
      key: '1',
      icon: <PhoneOutlined />,
      label: 'Call User',
    },
    {
      key: '2',
      icon: <VideoCameraOutlined />,
      label: 'Video Call',
    },
    {
      type: 'divider',
    },
    {
      key: '3',
      icon: <DeleteOutlined />,
      label: 'Delete Chat',
      danger: true,
    },
  ];

  return (
    <Card 
      title={
        <Space>
          <WechatOutlined />
          <span>Admin Chat</span>
          <Badge count={users.reduce((sum, user) => sum + user.unreadCount, 0)} />
        </Space>
      }
      style={{ height: '80vh' }}
      bodyStyle={{ padding: 0 }}
    >
      <Layout style={{ height: '70vh' }}>
        {/* Left Sidebar - Users List */}
        <Sider 
          width={350} 
          style={{ 
            background: '#fff', 
            borderRight: '1px solid #f0f0f0',
            overflow: 'auto'
          }}
        >
          <div style={{ padding: '16px' }}>
            <Input
              placeholder="Search users..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ marginBottom: '16px' }}
            />
          </div>

          <List
            dataSource={filteredUsers}
            renderItem={(user) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedUser?.id === user.id ? '#f0f7ff' : 'transparent',
                  borderRight: selectedUser?.id === user.id ? '3px solid #1890ff' : 'none'
                }}
                onClick={() => setSelectedUser(user)}
                actions={[
                  <Dropdown 
                    menu={{ items: getMenuItems(user) }} 
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button type="text" icon={<MoreOutlined />} />
                  </Dropdown>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Badge 
                      dot={user.isOnline} 
                      status="success" 
                      offset={[-2, 32]}
                    >
                      <Avatar 
                        icon={<UserOutlined />} 
                        src={user.avatar}
                        style={{ background: user.isOnline ? '#52c41a' : '#ccc' }}
                      />
                    </Badge>
                  }
                  title={
                    <Space>
                      <Text strong>{user.name}</Text>
                      {user.unreadCount > 0 && (
                        <Badge count={user.unreadCount} />
                      )}
                    </Space>
                  }
                  description={
  <div>
    <Text 
      ellipsis={{ tooltip: user.lastMessage }}
      style={{ 
        fontSize: '12px',
        color: user.unreadCount > 0 ? '#000' : '#666'
      }}
    >
      {user.lastMessage || 'No messages yet'}
    </Text>
    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
      {formatTime(user.lastMessageTime)}
      {!user.isOnline && user.lastSeen && (
        <span> • Last seen {formatTime(user.lastSeen)}</span>
      )}
    </div>
  </div>
}
                />
              </List.Item>
            )}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No users found"
                />
              )
            }}
          />
        </Sider>

        {/* Right Side - Chat Area */}
        <Layout>
          <Content style={{ background: '#f5f5f5', position: 'relative' }}>
            {selectedUser ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Chat Header */}
                <div style={{ 
                  padding: '16px 24px', 
                  background: '#fff', 
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Space>
                    <Avatar 
                      icon={<UserOutlined />} 
                      src={selectedUser.avatar}
                      style={{ background: selectedUser.isOnline ? '#52c41a' : '#ccc' }}
                    />
                    <div>
                      <Text strong>{selectedUser.name}</Text>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {selectedUser.isOnline ? (
                          <Tag color="green">Online</Tag>
                        ) : (
                          <span>Last seen {formatTime(selectedUser.lastSeen!)}</span>
                        )}
                      </div>
                    </div>
                  </Space>
                  <Space>
                    <Button type="text" icon={<PhoneOutlined />} />
                    <Button type="text" icon={<VideoCameraOutlined />} />
                  </Space>
                </div>

                {/* Messages Area */}
                <div style={{ 
                  flex: 1, 
                  padding: '24px', 
                  overflow: 'auto',
                  background: 'url("data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\" fill=\"%239C92AC\" fill-opacity=\"0.05\" fill-rule=\"evenodd\"/%3E%3C/svg%3E")'
                }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <Spin size="large" />
                    </div>
                  ) : (
                    <>
                      {messages.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '40px',
                          color: '#999'
                        }}>
                          <WechatOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                          <div>No messages yet. Start the conversation!</div>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            style={{
                              display: 'flex',
                              justifyContent: message.isAdmin ? 'flex-end' : 'flex-start',
                              marginBottom: '16px'
                            }}
                          >
                            <div
                              style={{
                                maxWidth: '70%',
                                background: message.isAdmin ? '#1890ff' : '#fff',
                                color: message.isAdmin ? '#fff' : '#000',
                                padding: '12px 16px',
                                borderRadius: '18px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                border: !message.isAdmin ? '1px solid #f0f0f0' : 'none'
                              }}
                            >
                              {!message.isAdmin && (
                                <div style={{ fontSize: '12px', marginBottom: '4px', opacity: 0.7 }}>
                                  {message.userName}
                                </div>
                              )}
                              <div>{message.content}</div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  marginTop: '4px',
                                  opacity: 0.6,
                                  textAlign: 'right'
                                }}
                              >
                                {formatTime(message.timestamp)}
                                {message.isAdmin && ' • ✓'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <div style={{ 
                  padding: '16px 24px', 
                  background: '#fff', 
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <TextArea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      style={{ resize: 'none' }}
                    />
                    <Button 
                      type="primary" 
                      icon={<SendOutlined />}
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                    >
                      Send
                    </Button>
                  </Space.Compact>
                </div>
              </div>
            ) : (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <WechatOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
                <Text type="secondary">Select a user to start chatting</Text>
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
    </Card>
  );
};

export default AdminChatSection;