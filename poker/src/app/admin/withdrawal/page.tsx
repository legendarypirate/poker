'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  message,
  Tag,
  Input,
  Select,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { confirm } = Modal;
const { RangePicker } = DatePicker;

interface WithdrawalRequest {
  withdrawal_id: number;
  id?: number; // Alias for withdrawal_id
  user_id: number;
  user?: {
    username: string;
    phone?: string;
    email?: string;
  };
  username?: string; // From user relation
  amount: number;
  status: string; // 'pending' | 'approved' | 'rejected' | 'completed'
  bank_name: string;
  bank_account: string;
  account_number?: string; // Alias for bank_account
  account_holder_name: string;
  account_holder?: string; // Alias for account_holder_name
  phone: string;
  request_date?: string; // Alias for createdAt
  processed_date: string | null;
  processed_at?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WithdrawalPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Нэвтрэх шаардлагатай');
        return;
      }

      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawal`;
      const params = new URLSearchParams();
      
      if (statusFilter !== null) {
        params.append('status', typeof statusFilter === 'number' ? statusFilter.toString() : statusFilter);
      }
      if (dateRange[0] && dateRange[1]) {
        params.append('start_date', dateRange[0].format('YYYY-MM-DD'));
        params.append('end_date', dateRange[1].format('YYYY-MM-DD'));
      }
      if (searchText) {
        params.append('search', searchText);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await res.json();
      if (result.success) {
        setWithdrawals(result.data);
      } else {
        console.error('Failed to load withdrawals:', result.message);
        message.error('Мөнгө авах хүсэлтийн мэдээллийг ачааллахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      message.error('Сүлжээний алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Мөнгө авах хүсэлт';
    fetchData();
  }, []);

  const handleApprove = (record: WithdrawalRequest) => {
    const withdrawalId = record.withdrawal_id || record.id;
    const username = record.username || record.user?.username || 'Unknown';
    confirm({
      title: 'Мөнгө авах хүсэлтийг баталгаажуулахдаа итгэлтэй байна уу?',
      icon: <ExclamationCircleOutlined />,
      content: `"${username}" хэрэглэгчийн ₮${Number(record.amount).toLocaleString()} мөнгө авах хүсэлтийг баталгаажуулах уу?`,
      okText: 'Тийм',
      okType: 'primary',
      cancelText: 'Үгүй',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            message.error('Нэвтрэх шаардлагатай');
            return;
          }

          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawal/${withdrawalId}/approve`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
          message.success('Мөнгө авах хүсэлт амжилттай баталгаажлаа');
          fetchData();
        } catch (err) {
          console.error(err);
          message.error('Мөнгө авах хүсэлт баталгаажуулахад алдаа гарлаа');
        }
      },
    });
  };

  const handleReject = (record: WithdrawalRequest) => {
    const withdrawalId = record.withdrawal_id || record.id;
    const username = record.username || record.user?.username || 'Unknown';
    confirm({
      title: 'Мөнгө авах хүсэлтийг татгалзахдаа итгэлтэй байна уу?',
      icon: <ExclamationCircleOutlined />,
      content: `"${username}" хэрэглэгчийн ₮${Number(record.amount).toLocaleString()} мөнгө авах хүсэлтийг татгалзах уу?`,
      okText: 'Тийм',
      okType: 'danger',
      cancelText: 'Үгүй',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            message.error('Нэвтрэх шаардлагатай');
            return;
          }

          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawal/${withdrawalId}/reject`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
          message.success('Мөнгө авах хүсэлт амжилттай татгалзлаа');
          fetchData();
        } catch (err) {
          console.error(err);
          message.error('Мөнгө авах хүсэлт татгалзахад алдаа гарлаа');
        }
      },
    });
  };

  const getStatusTag = (status: string | number) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'pending': { color: 'orange', text: 'Хүлээгдэж байна' },
      'approved': { color: 'green', text: 'Баталгаажсан' },
      'completed': { color: 'green', text: 'Дууссан' },
      'rejected': { color: 'red', text: 'Татгалзсан' },
      // Legacy number support
      '0': { color: 'orange', text: 'Хүлээгдэж байна' },
      '1': { color: 'green', text: 'Баталгаажсан' },
      '2': { color: 'red', text: 'Татгалзсан' },
    };
    const statusStr = typeof status === 'number' ? status.toString() : status;
    const statusInfo = statusMap[statusStr] || { color: 'default', text: 'Тодорхойгүй' };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const columns: ColumnsType<WithdrawalRequest> = [
    {
      title: 'ID',
      dataIndex: 'withdrawal_id',
      key: 'withdrawal_id',
      width: 60,
      render: (_, record) => record.withdrawal_id || record.id,
    },
    {
      title: 'Хэрэглэгч',
      key: 'username',
      render: (_, record) => record.username || record.user?.username || 'Unknown',
    },
    {
      title: 'Дүн',
      dataIndex: 'amount',
      render: (value: number) => `₮${Number(value).toLocaleString()}`,
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
    },
    {
      title: 'Банк',
      dataIndex: 'bank_name',
    },
    {
      title: 'Дансны дугаар',
      key: 'bank_account',
      render: (_, record) => record.bank_account || record.account_number || '-',
    },
    {
      title: 'Дансны эзэмшлийн нэр',
      key: 'account_holder_name',
      render: (_, record) => record.account_holder_name || record.account_holder || '-',
    },
    {
      title: 'Утас',
      dataIndex: 'phone',
    },
    {
      title: 'Хүсэлтийн огноо',
      key: 'createdAt',
      render: (_, record) => {
        const date = record.request_date || record.createdAt;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-';
      },
      sorter: (a, b) => {
        const dateA = a.request_date || a.createdAt;
        const dateB = b.request_date || b.createdAt;
        return dayjs(dateA).unix() - dayjs(dateB).unix();
      },
    },
    {
      title: 'Боловсруулсан огноо',
      key: 'processed_at',
      render: (_, record) => {
        const date = record.processed_date || record.processed_at;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-';
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (status: string | number) => getStatusTag(status),
      filters: [
        { text: 'Хүлээгдэж байна', value: 'pending' },
        { text: 'Баталгаажсан', value: 'completed' },
        { text: 'Татгалзсан', value: 'rejected' },
      ],
      onFilter: (value, record) => {
        const statusStr = typeof record.status === 'number' ? record.status.toString() : record.status;
        return statusStr === value;
      },
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        const status = typeof record.status === 'number' ? record.status.toString() : record.status;
        const isPending = status === 'pending' || status === '0';
        return (
          <Space>
            {isPending && (
              <>
                <Button
                  type="link"
                  icon={<CheckOutlined />}
                  onClick={() => handleApprove(record)}
                  style={{ color: 'green' }}
                >
                  Баталгаажуулах
                </Button>
                <Button
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => handleReject(record)}
                >
                  Татгалзах
                </Button>
              </>
            )}
            {!isPending && (
              <Tag color={status === 'completed' || status === 'approved' || status === '1' ? 'green' : 'red'}>
                {status === 'completed' || status === 'approved' || status === '1' ? 'Баталгаажсан' : 'Татгалзсан'}
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Мөнгө авах хүсэлт</h1>
      
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Хэрэглэгчийн нэр эсвэл дансны дугаар хайх"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 300 }}
          onPressEnter={fetchData}
        />
        <Select
          placeholder="Статус сонгох"
          allowClear
          style={{ width: 200 }}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
        >
          <Option value="pending">Хүлээгдэж байна</Option>
          <Option value="completed">Баталгаажсан</Option>
          <Option value="rejected">Татгалзсан</Option>
        </Select>
        <RangePicker
          value={dateRange}
          onChange={(range) => setDateRange(range ?? [null, null])}
        />
        <Button type="primary" onClick={fetchData}>
          Хайх
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={withdrawals}
        rowKey={(record) => (record.withdrawal_id || record.id)?.toString() || ''}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '50', '100'],
        }}
      />
    </div>
  );
}

