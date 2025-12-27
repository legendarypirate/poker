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
  InputNumber,
  Modal,
  message,
  Tag,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { confirm } = Modal;
const { RangePicker } = DatePicker;

interface Tournament {
  id: number;
  name: string;
  buy_in: number;
  prize_pool: number;
  max_players: number;
  current_players: number;
  status: number;
  start_time: string;
  end_time: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TournamentPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tournament`);
      const result = await res.json();
      if (result.success) {
        setTournaments(result.data);
      } else {
        console.error('Failed to load tournaments:', result.message);
        message.error('Тэмцээний мэдээллийг ачааллахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      message.error('Сүлжээний алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Тэмцээн';
    fetchData();
  }, []);

  const handleDelete = (record: Tournament) => {
    confirm({
      title: 'Тэмцээнийг устгахдаа итгэлтэй байна уу?',
      icon: <ExclamationCircleOutlined />,
      content: `"${record.name}" тэмцээн бүрмөсөн устгагддах болно.`,
      okText: 'Тийм',
      okType: 'danger',
      cancelText: 'Үгүй',
      onOk: async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tournament/${record.id}`,
            {
              method: 'DELETE',
            }
          );
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
          message.success('Тэмцээн амжилттай устгагдлаа');
          fetchData();
        } catch (err) {
          console.error(err);
          message.error('Тэмцээн устгахад алдаа гарлаа');
        }
      },
    });
  };

  const handleStatusChange = (record: Tournament) => {
    const newStatus = record.status === 1 ? 2 : 1;
    const statusText = newStatus === 1 ? 'идэвхгүй' : 'идэвхтэй';
    
    confirm({
      title: 'Статус өөрчлөх',
      icon: <ExclamationCircleOutlined />,
      content: `"${record.name}" тэмцээнийг ${statusText} болгох уу?`,
      okText: 'Тийм',
      cancelText: 'Үгүй',
      onOk: async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tournament/${record.id}/status`,
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

  const handleCreateTournament = () => {
    setEditingTournament(null);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = (record: Tournament) => {
    setEditingTournament(record);
    setDrawerVisible(true);
    form.setFieldsValue({
      name: record.name,
      buy_in: record.buy_in,
      prize_pool: record.prize_pool,
      max_players: record.max_players,
      status: record.status,
      start_time: record.start_time ? dayjs(record.start_time) : null,
    });
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
    setEditingTournament(null);
    form.resetFields();
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Format date for API
      if (values.start_time) {
        values.start_time = values.start_time.format('YYYY-MM-DD HH:mm:ss');
      }

      const url = editingTournament 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/tournament/${editingTournament.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/tournament`;

      const method = editingTournament ? 'PATCH' : 'POST';

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
          editingTournament 
            ? 'Тэмцээн амжилттай шинэчлэгдлээ' 
            : 'Тэмцээн амжилттай үүслээ'
        );
        fetchData();
        handleDrawerClose();
      } else {
        console.error('Failed to save tournament:', result.message);
        message.error(result.message || 'Алдаа гарлаа');
      }
    } catch (error) {
      console.error('Validation or request failed:', error);
      message.error('Хэлбэр буруу байна');
    }
  };

  const columns: ColumnsType<Tournament> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: 'Нэр',
      dataIndex: 'name',
    },
    {
      title: 'Buy In',
      dataIndex: 'buy_in',
      render: (value: number) => `₮${value.toLocaleString()}`,
    },
    {
      title: 'Шагнал',
      dataIndex: 'prize_pool',
      render: (value: number) => `₮${value.toLocaleString()}`,
    },
    {
      title: 'Тоглогчид',
      render: (_, record) => `${record.current_players}/${record.max_players}`,
    },
    {
      title: 'Эхлэх цаг',
      dataIndex: 'start_time',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (status: number, record: Tournament) => (
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
      width: 200,
      render: (_, record) => (
        <Space>
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
      <h1 style={{ marginBottom: 24 }}>Тэмцээн</h1>
      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ marginLeft: 'auto' }}
          onClick={handleCreateTournament}
        >
          + Тэмцээн үүсгэх
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={tournaments}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800 }}
      />

      <Drawer
        title={editingTournament ? 'Тэмцээн засах' : 'Тэмцээн үүсгэх'}
        width={400}
        onClose={handleDrawerClose}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80 }}
      >
        <Form layout="vertical" form={form} onFinish={handleFormSubmit}>
          <Form.Item 
            name="name" 
            label="Нэр" 
            rules={[{ required: true, message: 'Нэр оруулна уу' }]}
          >
            <Input placeholder="Тэмцээний нэр" />
          </Form.Item>
          <Form.Item 
            name="buy_in" 
            label="Buy In"
            rules={[{ required: true, message: 'Buy In оруулна уу' }]}
          >
            <InputNumber 
              placeholder="Buy In" 
              style={{ width: '100%' }}
              min={0}
              formatter={(value) => `₮ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/₮\s?|(,*)/g, '')}
            />
          </Form.Item>
          <Form.Item 
            name="prize_pool" 
            label="Шагнал"
            rules={[{ required: true, message: 'Шагнал оруулна уу' }]}
          >
            <InputNumber 
              placeholder="Шагнал" 
              style={{ width: '100%' }}
              min={0}
              formatter={(value) => `₮ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/₮\s?|(,*)/g, '')}
            />
          </Form.Item>
          <Form.Item 
            name="max_players" 
            label="Хамгийн их тоглогч"
            rules={[{ required: true, message: 'Тоглогчийн тоо оруулна уу' }]}
          >
            <InputNumber 
              placeholder="Тоглогчийн тоо" 
              style={{ width: '100%' }}
              min={2}
              max={100}
            />
          </Form.Item>
          <Form.Item 
            name="start_time" 
            label="Эхлэх цаг"
            rules={[{ required: true, message: 'Эхлэх цаг сонгоно уу' }]}
          >
            <DatePicker 
              showTime 
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="Эхлэх цаг сонгох"
            />
          </Form.Item>
          <Form.Item 
            name="status" 
            label="Статус" 
            rules={[{ required: true, message: 'Статус сонгоно уу' }]}
          >
            <Select placeholder="Статус сонгох">
              <Option value={1}>Идэвхгүй</Option>
              <Option value={2}>Идэвхтэй</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingTournament ? 'Шинэчлэх' : 'Үүсгэх'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

