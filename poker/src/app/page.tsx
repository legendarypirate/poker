'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Form, Input, Button, Checkbox, Card, notification } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation'; // for Next.js 13 app router

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const router = useRouter();

  useEffect(() => {
    setTitle('Нэвтрэх');
    document.title = 'Нэвтрэх';
  }, []);

  const openNotification = (type: 'success' | 'error', messageText: string) => {
    notification.open({
      message: null,
      description: <div style={{ color: 'white' }}>{messageText}</div>,
      duration: 4,
      style: {
        backgroundColor: type === 'success' ? '#52c41a' : '#ff4d4f',
        borderRadius: '4px',
      },
      closeIcon: <CloseOutlined style={{ color: '#fff' }} />,
    });
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        openNotification('success', 'Амжилттай нэвтэрлээ!');

        // Optionally store token and user info (e.g., in localStorage)
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/admin'); // Navigate after success

        // You can redirect here if needed, e.g., using next/router
        // router.push('/dashboard');
      } else {
        openNotification('error', 'Нэвтрэх нэр эсвэл нууц үг буруу байна!');
      }
    } catch (error) {
      openNotification('error', 'Сервертэй холбогдож чадсангүй!');
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = () => {
    openNotification('error', 'Та бүх талбарыг зөв бөглөнө үү!');
  };

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <div
          style={{
            height: '50vh',
            backgroundImage: 'url(/poker.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        <div style={{ height: '50vh', backgroundColor: '#fafafa' }} />

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: 340,
            padding: '0 16px',
          }}
        >
          <Card
            title={<div style={{ textAlign: 'center', fontWeight: 'bold' }}>{title}</div>}
            bordered={false}
          >
            <Form
              name="basic"
              initialValues={{ remember: true }}
              onFinish={onFinish}
              onFinishFailed={onFinishFailed}
              autoComplete="off"
              layout="vertical"
            >
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Please input your username!' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please input your password!' }]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item name="remember" valuePropName="checked">
                <Checkbox>Remember me</Checkbox>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  Login
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </>
  );
}
