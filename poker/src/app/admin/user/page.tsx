'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Drawer,
  Form,
  Input,
  Select,
  Modal,
  message,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons';

const { Option } = Select;
const { confirm } = Modal;

interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  role_id: number;
  status: number;
  account_balance?: number;
  role?: string;
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [balanceModalVisible, setBalanceModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [balanceForm] = Form.useForm();

  // ✅ Reusable fetch function
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Нэвтрэх шаардлагатай');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        console.error('Failed to load users:', result.message);
        message.error('Хэрэглэгчдийн мэдээллийг ачааллахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      message.error('Сүлжээний алдаа');
    } finally {
      setLoading(false);
    }
  };

  // Load users on page load
  useEffect(() => {
    document.title = 'Хэрэглэгч';
    fetchData();
  }, []);

  const handleDelete = (record: User) => {
    confirm({
      title: 'Хэрэглэгчийг устгахдаа итгэлтэй байна уу?',
      icon: <ExclamationCircleOutlined />,
      content: `"${record.username}" хэрэглэгч бүрмөсөн устгагддах болно.`,
      okText: 'Тийм',
      okType: 'danger',
      cancelText: 'Үгүй',
      onOk: async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/user/${record.id}`,
            {
              method: 'DELETE',
            }
          );
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
          message.success('Хэрэглэгч амжилттай устгагдлаа');
          fetchData();
        } catch (err) {
          console.error(err);
          message.error('Хэрэглэгч устгахад алдаа гарлаа');
        }
      },
    });
  };

  const handleStatusChange = (record: User) => {
    const newStatus = record.status === 1 ? 2 : 1;
    const statusText = newStatus === 1 ? 'идэвхгүй' : 'идэвхтэй';
    
    confirm({
      title: 'Статус өөрчлөх',
      icon: <ExclamationCircleOutlined />,
      content: `"${record.username}" хэрэглэгчийг ${statusText} болгох уу?`,
      okText: 'Тийм',
      cancelText: 'Үгүй',
      onOk: async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/user/${record.id}/status`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            }
          );
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
          message.success(`Статус амжилттай ${statusText} боллоо`);
          fetchData();
        } catch (err) {
          console.error(err);
          message.error('Статус өөрчлөхөд алдаа гарлаа');
        }
      },
    });
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = (record: User) => {
    setEditingUser(record);
    setDrawerVisible(true);
    form.setFieldsValue({
      username: record.username,
      email: record.email,
      phone: record.phone,
      role_id: record.role_id,
      // Don't set password for edit
    });
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();

      const url = editingUser 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/user/${editingUser.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/user`;

      const method = editingUser ? 'PATCH' : 'POST';

      // Remove password if it's empty during edit
      if (editingUser && (!values.password || values.password === '')) {
        delete values.password;
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        message.success(
          editingUser 
            ? 'Хэрэглэгч амжилттай шинэчлэгдлээ' 
            : 'Хэрэглэгч амжилттай үүслээ'
        );
        fetchData();
        handleDrawerClose();
      } else {
        console.error('Failed to save user:', result.message);
        message.error(result.message || 'Алдаа гарлаа');
      }
    } catch (error) {
      console.error('Validation or request failed:', error);
      message.error('Хэлбэр буруу байна');
    }
  };

  const handleChargeBalance = (record: User) => {
    setSelectedUser(record);
    setBalanceModalVisible(true);
    balanceForm.setFieldsValue({
      amount: '',
      operation: 'add',
    });
  };

  const handleBalanceSubmit = async () => {
    try {
      const values = await balanceForm.validateFields();
      const token = localStorage.getItem('token');
      
      if (!token) {
        message.error('Нэвтрэх шаардлагатай');
        return;
      }

      if (!selectedUser) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${selectedUser.id}/balance`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parseFloat(values.amount),
            operation: values.operation,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        message.success(
          `Дансны үлдэгдэл амжилттай ${values.operation === 'add' ? 'нэмэгдлээ' : 'хасагдлаа'}. Шинэ үлдэгдэл: ₮${result.data.new_balance.toLocaleString()}`
        );
        fetchData();
        setBalanceModalVisible(false);
        balanceForm.resetFields();
        setSelectedUser(null);
      } else {
        console.error('Failed to update balance:', result.message);
        message.error(result.message || 'Дансны үлдэгдэл шинэчлэхэд алдаа гарлаа');
      }
    } catch (error) {
      console.error('Validation or request failed:', error);
      message.error('Хэлбэр буруу байна');
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: 'Username',
      dataIndex: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
    },
    {
      title: 'Account Balance',
      dataIndex: 'account_balance',
      render: (balance: number | undefined) => {
        const amount = balance ?? 0;
        return <span style={{ fontWeight: 600, color: amount >= 0 ? '#52c41a' : '#ff4d4f' }}>
          ₮{amount.toLocaleString()}
        </span>;
      },
      sorter: (a, b) => (a.account_balance ?? 0) - (b.account_balance ?? 0),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (role: string | undefined, record: User) => {
        if (role) {
          return <Tag color="blue">{role}</Tag>;
        }
        // Fallback to role_id if role is not available
        const roles: Record<number, string> = {
          1: 'Admin',
          2: 'Customer',
          3: 'Driver',
        };
        return <Tag color="blue">{roles[record.role_id] || `Role ${record.role_id}`}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: number, record: User) => (
        <Button 
          type="link" 
          onClick={() => handleStatusChange(record)}
          style={{ 
            color: status === 1 ? 'red' : 'green', 
            fontWeight: 500,
            padding: 0 
          }}
        >
          {status === 1 ? 'Идэвхгүй' : 'Идэвхтэй'}
        </Button>
      ),
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<DollarOutlined />}
            onClick={() => handleChargeBalance(record)}
            style={{ color: '#52c41a' }}
          >
            Данс цэнэглэх
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Засах
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Устгах
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Хэрэглэгч</h1>
      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        <Button
          type="primary"
          style={{ marginLeft: 'auto' }}
          onClick={handleCreateUser}
        >
          + Хэрэглэгч үүсгэх
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800 }}
      />

      <Drawer
        title={editingUser ? 'Хэрэглэгч засах' : 'Хэрэглэгч үүсгэх'}
        width={400}
        onClose={handleDrawerClose}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80 }}
      >
        <Form layout="vertical" form={form} onFinish={handleFormSubmit}>
          <Form.Item 
            name="username" 
            label="Username" 
            rules={[{ required: true, message: 'Username оруулна уу' }]}
          >
            <Input placeholder="Username" />
          </Form.Item>
          <Form.Item 
            name="email" 
            label="Email"
            rules={[
              { required: true, message: 'Email оруулна уу' },
              { type: 'email', message: 'Зөв email оруулна уу' }
            ]}
          >
            <Input placeholder="Email" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="Phone" />
          </Form.Item>
          <Form.Item 
            name="role_id" 
            label="Role" 
            rules={[{ required: true, message: 'Role сонгоно уу' }]}
          >
            <Select placeholder="Select role">
              <Option value={1}>Admin</Option>
              <Option value={2}>Customer</Option>
              <Option value={3}>Driver</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              editingUser ? {} : { required: true, message: 'Password оруулна уу' },
              { min: 6, message: 'Password хамгийн багадаа 6 тэмдэгт байх ёстой' }
            ]}
          >
            <Input.Password 
              placeholder={editingUser ? "Шинэ password (өөрчлөхгүй бол хоосон орхих)" : "Password"} 
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingUser ? 'Шинэчлэх' : 'Үүсгэх'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title={`Дансны үлдэгдэл засах - ${selectedUser?.username}`}
        open={balanceModalVisible}
        onOk={handleBalanceSubmit}
        onCancel={() => {
          setBalanceModalVisible(false);
          balanceForm.resetFields();
          setSelectedUser(null);
        }}
        okText="Хадгалах"
        cancelText="Цуцлах"
      >
        <Form form={balanceForm} layout="vertical">
          <Form.Item label="Одоогийн үлдэгдэл">
            <Input
              value={selectedUser?.account_balance ? `₮${selectedUser.account_balance.toLocaleString()}` : '₮0'}
              disabled
            />
          </Form.Item>
          <Form.Item
            name="operation"
            label="Үйлдэл"
            rules={[{ required: true, message: 'Үйлдэл сонгоно уу' }]}
          >
            <Select>
              <Option value="add">Нэмэх</Option>
              <Option value="subtract">Хасах</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="Дүн"
            rules={[
              { required: true, message: 'Дүн оруулна уу' },
              { 
                validator: (_, value) => {
                  if (value && parseFloat(value) > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Дүн 0-ээс их байх ёстой'));
                }
              }
            ]}
          >
            <Input type="number" placeholder="Дүн оруулна уу" min={0} step="0.01" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}