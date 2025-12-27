'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Table, 
  Space, 
  Input, 
  DatePicker, 
  Tag, 
  Tooltip, 
  Select, 
  Button, 
  Card, 
  Row, 
  Col, 
  Modal, 
  Descriptions, 
  Statistic,
  Badge,
  message,
  Divider
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { ReloadOutlined, ExportOutlined, EyeOutlined, TrophyOutlined, StopOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface Player {
  player_id: number;
  username: string;
  ready: boolean;
}

interface PlayerState {
  user_id: number;
  username: string;
  is_connected: boolean;
  last_action_time: string;
  disconnect_time: string | null;
}

interface GameStatic {
  total_rounds?: number;
  total_turns?: number;
  average_points?: number;
  highest_score?: number;
  lowest_score?: number;
  cards_played?: number;
  [key: string]: any;
}

interface Game {
  game_id: number;
  room_id: number;
  status: number;
  players: Player[];
  buy_in: number;
  start_time: string;
  end_time: string | null;
  createdAt: string;
  updatedAt: string;
  winner?: number | null;
  winner_username?: string;
  gameStatic?: GameStatic;
  game_type?: string;
  player_states?: PlayerState[];
}

export default function GamePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [roomFilter, setRoomFilter] = useState<number | undefined>(undefined);
  const [buyInRange, setBuyInRange] = useState<[number | undefined, number | undefined]>([undefined, undefined]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const getStatusTag = (status: number) => {
    const statusMap: Record<number, { text: string; color: string }> = {
      0: { text: 'Хүлээгдэж буй', color: 'default' },
      1: { text: 'Идэвхтэй', color: 'processing' },
      2: { text: 'Дууссан', color: 'success' },
      3: { text: 'Цуцлагдсан', color: 'error' },
    };
    const statusInfo = statusMap[status] || { text: `Статус ${status}`, color: 'default' };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const columns: ColumnsType<Game> = [
    {
      title: 'Тоглоом ID',
      dataIndex: 'game_id',
      sorter: (a, b) => a.game_id - b.game_id,
      width: 100,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 120,
      filters: [
        { text: 'Хүлээгдэж буй', value: 0 },
        { text: 'Идэвхтэй', value: 1 },
        { text: 'Дууссан', value: 2 },
        { text: 'Цуцлагдсан', value: 3 },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: number) => getStatusTag(status),
    },
    {
      title: 'Өрөө',
      dataIndex: 'room_id',
      sorter: (a, b) => a.room_id - b.room_id,
      width: 100,
    },
    {
      title: 'Төрөл',
      dataIndex: 'game_type',
      width: 120,
      render: (type: string) => type || 'mongol_13',
    },
    {
      title: 'Buy In',
      dataIndex: 'buy_in',
      sorter: (a, b) => a.buy_in - b.buy_in,
      width: 100,
      render: (amount: number) => `${amount.toLocaleString()}₮`,
    },
    {
      title: 'Эхэлсэн огноо',
      dataIndex: 'start_time',
      sorter: (a, b) => dayjs(a.start_time).unix() - dayjs(b.start_time).unix(),
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
      width: 160,
    },
    {
      title: 'Дууссан огноо',
      dataIndex: 'end_time',
      render: (text: string | null) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'),
      width: 160,
    },
    {
      title: 'Ялагч',
      dataIndex: 'winner',
      width: 150,
      render: (winner: number | null, record: Game) => {
        if (winner === null || winner === undefined) {
          return <Tag color="default">Тодорхойгүй</Tag>;
        }
        const winnerPlayer = record.players?.find((p: any) => p.player_id === winner);
        return (
          <Space>
            <TrophyOutlined style={{ color: '#faad14' }} />
            <Tag color="gold">{winnerPlayer?.username || `Player ${winner}`}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Тоглогчид',
      dataIndex: 'players',
      width: 200,
      render: (players: Player[], record: Game) => {
        // Get player states for active games
        const playerStates = record.player_states || [];
        const playerStateMap = new Map(playerStates.map(ps => [ps.user_id, ps]));
        
        return (
          <Space direction="vertical" size={0}>
            {players?.map((p) => {
              const playerState = playerStateMap.get(p.player_id);
              const isConnected = playerState ? playerState.is_connected : true;
              const isDisconnected = playerState && !playerState.is_connected;
              
              return (
                <Tooltip 
                  key={p.player_id} 
                  title={
                    isDisconnected 
                      ? `Холбогдолоо (${playerState?.disconnect_time ? new Date(playerState.disconnect_time).toLocaleString() : ''})`
                      : p.ready ? 'Бэлэн' : 'Бэлэн биш'
                  }
                >
                  <Tag 
                    color={
                      isDisconnected 
                        ? 'red' 
                        : p.ready 
                          ? 'green' 
                          : 'volcano'
                    }
                  >
                    {p.username} {isDisconnected && '⚠️'}
                  </Tag>
                </Tooltip>
              );
            }) || <Tag>Тоглогч байхгүй</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Статистик',
      dataIndex: 'gameStatic',
      width: 120,
      render: (gameStatic: GameStatic) => {
        if (!gameStatic || Object.keys(gameStatic).length === 0) {
          return <Tag color="default">Байхгүй</Tag>;
        }
        return (
          <Tooltip
            title={
              <div>
                {Object.entries(gameStatic).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}:</strong> {String(value)}
                  </div>
                ))}
              </div>
            }
          >
            <Badge count={Object.keys(gameStatic).length} showZero>
              <Tag color="blue">Харах</Tag>
            </Badge>
          </Tooltip>
        );
      },
    },
    {
      title: 'Үйлдэл',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: Game) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedGame(record);
              setModalVisible(true);
            }}
          >
            Дэлгэрэнгүй
          </Button>
          {record.status === 1 && (
            <Button
              type="link"
              danger
              icon={<StopOutlined />}
              onClick={() => handleEndGame(record.game_id)}
              loading={loading}
            >
              Тоглоом дуусгах
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const fetchGames = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== undefined) params.append('status', statusFilter.toString());
      if (roomFilter !== undefined) params.append('room_id', roomFilter.toString());
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/game${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setGames(result.data);
      } else {
        message.error('Тоглолтуудыг авахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Error fetching games:', err);
      message.error('Тоглолтуудыг авахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const handleEndGame = async (gameId: number) => {
    Modal.confirm({
      title: 'Тоглоом дуусгах',
      content: 'Та энэ тоглоомыг дуусгахдаа итгэлтэй байна уу? Энэ үйлдэл нь бүх тоглогчдын current_game_id-г цэвэрлэж, тэднийг шинэ тоглоомд оролцох боломжийг нээх болно.',
      okText: 'Тийм, дуусгах',
      cancelText: 'Цуцлах',
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            message.error('Нэвтрэх шаардлагатай');
            return;
          }

          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/games/${gameId}/end`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          const result = await res.json();
          if (result.success) {
            message.success('Тоглоом амжилттай дууслаа');
            fetchGames(); // Refresh the games list
          } else {
            message.error(result.message || 'Тоглоом дуусгахад алдаа гарлаа');
          }
        } catch (err) {
          console.error('Error ending game:', err);
          message.error('Тоглоом дуусгахад алдаа гарлаа');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const filteredGames = useMemo(() => {
    let filtered = [...games];

    // Search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (game) =>
          game.game_id.toString().includes(searchLower) ||
          game.room_id.toString().includes(searchLower) ||
          game.players?.some((p) => p.username.toLowerCase().includes(searchLower)) ||
          game.winner_username?.toLowerCase().includes(searchLower)
      );
    }

    // Date range filter
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter((game) => {
        const startTime = dayjs(game.start_time);
        return startTime.isAfter(dateRange[0]!) && startTime.isBefore(dateRange[1]!);
      });
    }

    // Buy-in range filter
    if (buyInRange[0] !== undefined || buyInRange[1] !== undefined) {
      filtered = filtered.filter((game) => {
        if (buyInRange[0] !== undefined && game.buy_in < buyInRange[0]) return false;
        if (buyInRange[1] !== undefined && game.buy_in > buyInRange[1]) return false;
        return true;
      });
    }

    return filtered;
  }, [games, searchText, dateRange, buyInRange]);

  const statistics = useMemo(() => {
    const total = filteredGames.length;
    const finished = filteredGames.filter((g) => g.status === 2).length;
    const active = filteredGames.filter((g) => g.status === 1).length;
    const pending = filteredGames.filter((g) => g.status === 0).length;
    const totalBuyIn = filteredGames.reduce((sum, g) => sum + g.buy_in, 0);
    const gamesWithWinners = filteredGames.filter((g) => g.winner !== null && g.winner !== undefined).length;

    return { total, finished, active, pending, totalBuyIn, gamesWithWinners };
  }, [filteredGames]);

  const exportToCSV = () => {
    const headers = ['Game ID', 'Room ID', 'Status', 'Buy In', 'Start Time', 'End Time', 'Winner', 'Players', 'Game Type'];
    const rows = filteredGames.map((game) => [
      game.game_id,
      game.room_id,
      game.status,
      game.buy_in,
      dayjs(game.start_time).format('YYYY-MM-DD HH:mm'),
      game.end_time ? dayjs(game.end_time).format('YYYY-MM-DD HH:mm') : '',
      game.winner_username || game.winner || '',
      game.players?.map((p) => p.username).join(', ') || '',
      game.game_type || 'mongol_13',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `games_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('CSV файл татагдлаа');
  };

  useEffect(() => {
    document.title = 'Тоглолтууд';
    fetchGames();
  }, [statusFilter, roomFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchGames();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [statusFilter, roomFilter]);

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 24, fontSize: '24px', fontWeight: 'bold' }}>Тоглолтууд</h1>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Нийт тоглолт"
              value={statistics.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Дууссан"
              value={statistics.finished}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Идэвхтэй"
              value={statistics.active}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Нийт Buy In"
              value={statistics.totalBuyIn}
              suffix="₮"
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
                placeholder="Хайх (ID, өрөө, тоглогч)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Статусаар шүүх"
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
              >
                <Option value={0}>Хүлээгдэж буй</Option>
                <Option value={1}>Идэвхтэй</Option>
                <Option value={2}>Дууссан</Option>
                <Option value={3}>Цуцлагдсан</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                type="number"
                placeholder="Өрөөний ID"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value ? Number(e.target.value) : undefined)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space>
                <Input
                  type="number"
                  placeholder="Buy In Min"
                  value={buyInRange[0]}
                  onChange={(e) => setBuyInRange([e.target.value ? Number(e.target.value) : undefined, buyInRange[1]])}
                  style={{ width: 100 }}
                />
                <Input
                  type="number"
                  placeholder="Buy In Max"
                  value={buyInRange[1]}
                  onChange={(e) => setBuyInRange([buyInRange[0], e.target.value ? Number(e.target.value) : undefined])}
                  style={{ width: 100 }}
                />
              </Space>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <RangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range ?? [null, null])}
                showTime
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={fetchGames}
                  loading={loading}
                >
                  Шинэчлэх
                </Button>
                <Button
                  icon={<ExportOutlined />}
                  onClick={exportToCSV}
                  disabled={filteredGames.length === 0}
                >
                  CSV татах
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Games Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredGames}
          rowKey="game_id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `Нийт ${total} тоглолт`,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Тоглолтын дэлгэрэнгүй мэдээлэл"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={
          selectedGame && selectedGame.status === 1 ? (
            <Button
              type="primary"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setModalVisible(false);
                handleEndGame(selectedGame.game_id);
              }}
              loading={loading}
            >
              Тоглоом дуусгах
            </Button>
          ) : null
        }
        width={800}
      >
        {selectedGame && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Тоглоом ID">{selectedGame.game_id}</Descriptions.Item>
              <Descriptions.Item label="Өрөөний ID">{selectedGame.room_id}</Descriptions.Item>
              <Descriptions.Item label="Статус">{getStatusTag(selectedGame.status)}</Descriptions.Item>
              <Descriptions.Item label="Төрөл">{selectedGame.game_type || 'mongol_13'}</Descriptions.Item>
              <Descriptions.Item label="Buy In">{selectedGame.buy_in.toLocaleString()}₮</Descriptions.Item>
              <Descriptions.Item label="Эхэлсэн огноо">
                {dayjs(selectedGame.start_time).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Дууссан огноо">
                {selectedGame.end_time ? dayjs(selectedGame.end_time).format('YYYY-MM-DD HH:mm:ss') : 'Дуусаагүй'}
              </Descriptions.Item>
              <Descriptions.Item label="Ялагч">
                {selectedGame.winner !== null && selectedGame.winner !== undefined ? (
                  <Space>
                    <TrophyOutlined style={{ color: '#faad14' }} />
                    <Tag color="gold">
                      {selectedGame.winner_username ||
                        selectedGame.players?.find((p: any) => p.player_id === selectedGame.winner)?.username ||
                        `Player ${selectedGame.winner}`}
                    </Tag>
                  </Space>
                ) : (
                  <Tag color="default">Тодорхойгүй</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Тоглогчид</Divider>
            <Space wrap>
              {selectedGame.players?.map((player) => {
                const playerState = selectedGame.player_states?.find(ps => ps.user_id === player.player_id);
                const isConnected = playerState ? playerState.is_connected : true;
                const isDisconnected = playerState && !playerState.is_connected;
                
                return (
                  <div key={player.player_id} style={{ marginBottom: 8 }}>
                    <Tag
                      color={
                        isDisconnected 
                          ? 'red' 
                          : player.player_id === selectedGame.winner 
                            ? 'gold' 
                            : player.ready 
                              ? 'green' 
                              : 'volcano'
                      }
                    >
                      {player.username} {player.player_id === selectedGame.winner && '👑'} {isDisconnected && '⚠️ Холбогдолоо'}
                    </Tag>
                    {isDisconnected && playerState && (
                      <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                        Холбогдсон: {new Date(playerState.disconnect_time || '').toLocaleString()}
                      </div>
                    )}
                    {playerState && isConnected && (
                      <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                        Сүүлд идэвхтэй: {new Date(playerState.last_action_time).toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </Space>

            {selectedGame.gameStatic && Object.keys(selectedGame.gameStatic).length > 0 && (
              <>
                <Divider>Статистик</Divider>
                <Descriptions bordered column={2}>
                  {Object.entries(selectedGame.gameStatic).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key.replace(/_/g, ' ').toUpperCase()}>
                      {String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            <Divider>Бусад мэдээлэл</Divider>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Үүсгэсэн огноо">
                {dayjs(selectedGame.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Шинэчлэгдсэн огноо">
                {dayjs(selectedGame.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
