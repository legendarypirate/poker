'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Card,
  Space,
  DatePicker,
  Button,
  message,
  Tag,
  Statistic,
  Row,
  Col,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, ExportOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface PlatformCharge {
  charge_id: number;
  game_id: number;
  total_pot: number;
  platform_fee: number;
  winner_payout: number;
  created_at: string;
  updated_at: string;
  game?: {
    game_id: number;
    room_id: number;
    buy_in: number;
    game_type: string;
    start_time: string;
    end_time: string | null;
    winner: number | null;
    winnerUser?: {
      id: number;
      username: string;
      display_name: string;
    };
  };
}

interface Totals {
  totalPot: number;
  totalPlatformFee: number;
  totalWinnerPayout: number;
  count: number;
}

export default function PlatformChargesPage() {
  const [charges, setCharges] = useState<PlatformCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [totals, setTotals] = useState<Totals>({
    totalPot: 0,
    totalPlatformFee: 0,
    totalWinnerPayout: 0,
    count: 0,
  });
  const [searchText, setSearchText] = useState('');

  const fetchCharges = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Нэвтрэх шаардлагатай');
        return;
      }

      const params = new URLSearchParams();
      if (dateRange[0]) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
      }
      if (dateRange[1]) {
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'));
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/platform-charges${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await res.json();
      if (result.success) {
        setCharges(result.data || []);
        setTotals(result.totals || {
          totalPot: 0,
          totalPlatformFee: 0,
          totalWinnerPayout: 0,
          count: 0,
        });
      } else {
        message.error('Платформын хураамжийн мэдээллийг ачааллахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Error fetching platform charges:', err);
      message.error('Сүлжээний алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Платформын хураамж';
    fetchCharges();
  }, []);

  const filteredCharges = useMemo(() => {
    let filtered = [...charges];

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (charge) =>
          charge.game_id.toString().includes(searchLower) ||
          charge.game?.room_id.toString().includes(searchLower) ||
          charge.game?.winnerUser?.username?.toLowerCase().includes(searchLower) ||
          charge.game?.winnerUser?.display_name?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [charges, searchText]);

  const columns: ColumnsType<PlatformCharge> = [
    {
      title: 'ID',
      dataIndex: 'charge_id',
      width: 80,
      sorter: (a, b) => a.charge_id - b.charge_id,
    },
    {
      title: 'Тоглоом ID',
      dataIndex: ['game', 'game_id'],
      width: 120,
      sorter: (a, b) => (a.game?.game_id || 0) - (b.game?.game_id || 0),
    },
    {
      title: 'Өрөөний ID',
      dataIndex: ['game', 'room_id'],
      width: 120,
      sorter: (a, b) => (a.game?.room_id || 0) - (b.game?.room_id || 0),
    },
    {
      title: 'Buy In',
      dataIndex: ['game', 'buy_in'],
      width: 120,
      render: (value: number) => value ? `${value.toLocaleString()}₮` : '-',
    },
    {
      title: 'Нийт сав',
      dataIndex: 'total_pot',
      width: 150,
      sorter: (a, b) => parseFloat(a.total_pot.toString()) - parseFloat(b.total_pot.toString()),
      render: (value: number) => `${parseFloat(value.toString()).toLocaleString()}₮`,
    },
    {
      title: 'Платформын хураамж',
      dataIndex: 'platform_fee',
      width: 180,
      sorter: (a, b) => parseFloat(a.platform_fee.toString()) - parseFloat(b.platform_fee.toString()),
      render: (value: number) => (
        <Tag color="red">{parseFloat(value.toString()).toLocaleString()}₮</Tag>
      ),
    },
    {
      title: 'Ялагчид олгосон',
      dataIndex: 'winner_payout',
      width: 180,
      sorter: (a, b) => parseFloat(a.winner_payout.toString()) - parseFloat(b.winner_payout.toString()),
      render: (value: number) => (
        <Tag color="green">{parseFloat(value.toString()).toLocaleString()}₮</Tag>
      ),
    },
    {
      title: 'Ялагч',
      dataIndex: ['game', 'winnerUser'],
      width: 150,
      render: (winnerUser: any) => {
        if (!winnerUser) return <Tag color="default">Тодорхойгүй</Tag>;
        return (
          <Tag color="gold">
            {winnerUser.username || winnerUser.display_name || `User ${winnerUser.id}`}
          </Tag>
        );
      },
    },
    {
      title: 'Огноо',
      dataIndex: 'created_at',
      width: 180,
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const exportToCSV = () => {
    const headers = ['ID', 'Тоглоом ID', 'Өрөөний ID', 'Buy In', 'Нийт сав', 'Платформын хураамж', 'Ялагчид олгосон', 'Ялагч', 'Огноо'];
    const rows = filteredCharges.map((charge) => [
      charge.charge_id,
      charge.game?.game_id || '',
      charge.game?.room_id || '',
      charge.game?.buy_in || '',
      parseFloat(charge.total_pot.toString()).toLocaleString(),
      parseFloat(charge.platform_fee.toString()).toLocaleString(),
      parseFloat(charge.winner_payout.toString()).toLocaleString(),
      charge.game?.winnerUser?.username || charge.game?.winnerUser?.display_name || '',
      dayjs(charge.created_at).format('YYYY-MM-DD HH:mm:ss'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `platform_charges_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('CSV файл татагдлаа');
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 24, fontSize: '24px', fontWeight: 'bold' }}>
        Платформын хураамж
      </h1>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Нийт сав"
              value={totals.totalPot}
              suffix="₮"
              valueStyle={{ color: '#1890ff' }}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Нийт платформын хураамж"
              value={totals.totalPlatformFee}
              suffix="₮"
              valueStyle={{ color: '#cf1322' }}
              precision={2}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Ялагчид олгосон"
              value={totals.totalWinnerPayout}
              suffix="₮"
              valueStyle={{ color: '#52c41a' }}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Нийт тоглолт"
              value={totals.count}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                placeholder="Хайх (Тоглоом ID, Өрөө, Ялагч)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <RangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range ?? [null, null])}
                showTime
                style={{ width: '100%' }}
                format="YYYY-MM-DD HH:mm"
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={fetchCharges}
                  loading={loading}
                >
                  Шинэчлэх
                </Button>
                <Button
                  icon={<ExportOutlined />}
                  onClick={exportToCSV}
                  disabled={filteredCharges.length === 0}
                >
                  CSV татах
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Charges Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredCharges}
          rowKey="charge_id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `Нийт ${total} хураамж`,
          }}
        />
      </Card>
    </div>
  );
}

