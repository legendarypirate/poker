'use client';

import React from 'react';
import { Card, Col, Row } from 'antd';

type Stat = {
  id: number;
  label: string;
  value: number | string;
  color: string;
  description?: string;
};

const PokerDashboard = () => {
  // Static statistics for the poker website
  const stats: Stat[] = [
    {
      id: 1,
      label: 'Active Players',
      value: 3245,
      color: '#1890ff',
      description: 'Currently playing online',
    },
    {
      id: 2,
      label: 'Ongoing Tournaments',
      value: 18,
      color: '#faad14',
      description: 'Live events running now',
    },
    {
      id: 3,
      label: 'Total Pots Today',
      value: '₮1.3M',
      color: '#52c41a',
      description: 'Total amount wagered today',
    },
    {
      id: 4,
      label: 'Hands Played',
      value: '482,910',
      color: '#722ed1',
      description: 'Hands dealt across all tables',
    },
    {
      id: 5,
      label: 'Top Winner',
      value: 'bayakaa',
      color: '#eb2f96',
      description: 'Player leading today’s leaderboard',
    },
    {
      id: 6,
      label: 'Average Pot Size',
      value: '₮320,000',
      color: '#13c2c2',
      description: 'Average hand pot across all tables',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>♠ Poker Statistics Dashboard</h1>

      <Row gutter={[16, 16]}>
        {stats.map((item) => (
          <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              title={item.label}
              bordered
              style={{
                cursor: 'default',
                textAlign: 'center',
                borderLeft: `5px solid ${item.color}`,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,.06)',
              }}
              headStyle={{
                background: '#f5f5f5',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 'bold', color: item.color }}>
                {item.value}
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>{item.description}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default PokerDashboard;
