'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Layout, Menu, message, Spin, Modal, Dropdown, Avatar, MenuProps } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
  TrophyOutlined,
  DollarOutlined,
  PlayCircleOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';

const { Header, Sider, Content } = Layout;

// ✅ Define menu item type manually (instead of importing from AntD internals)
type MenuItem = Required<MenuProps>['items'][number];

interface CustomMenuItem {
  key: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  permission?: string;
  children?: CustomMenuItem[];
}

function getUserPermissions(): string[] {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return [];
    const user = JSON.parse(userStr);
    return user.permissions || [];
  } catch (e) {
    console.error('Failed to parse user from localStorage', e);
    return [];
  }
}

function getUserName(): string {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return 'Хэрэглэгч';
    const user = JSON.parse(userStr);
    return user.name || 'Хэрэглэгч';
  } catch {
    return 'Хэрэглэгч';
  }
}

function hasPermission(permission: string, userPermissions: string[]): boolean {
  if (!permission) return true;
  return userPermissions.includes(permission);
}

function filterMenuByPermission(
  items: CustomMenuItem[],
  userPermissions: string[]
): CustomMenuItem[] {
  return items
    .filter(item => hasPermission(item.permission || '', userPermissions))
    .map(item => {
      if (item.children) {
        return { ...item, children: filterMenuByPermission(item.children, userPermissions) };
      }
      return item;
    });
}

// ✅ Convert our custom menu to AntD menu-compatible items
const convertToAntdItems = (items: CustomMenuItem[]): MenuItem[] => {
  return items.map(item => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children ? convertToAntdItems(item.children) : undefined,
  }));
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('Хэрэглэгч');

  useEffect(() => {
    setUserPermissions(getUserPermissions());
    setUserName(getUserName());
  }, []);

  const handleLogout = () => {
    message.success('Амжилттай гарлаа');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/');
  };

  const showConfirm = () => {
    Modal.confirm({
      title: 'Та гарахдаа итгэлтэй байна уу?',
      okText: 'Тийм',
      cancelText: 'Үгүй',
      centered: true,
      width: 500,
      onOk: handleLogout,
    });
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="userinfo" icon={<UserOutlined />} disabled>
        Таны нэр: {userName}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={showConfirm} danger>
        Гарах
      </Menu.Item>
    </Menu>
  );

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    if (e.key === '/admin/logout') return;
    setLoading(true);
    router.push(e.key);
    setTimeout(() => setLoading(false), 500);
  };

  const menuItems: CustomMenuItem[] = [
    { key: '/admin', icon: <DashboardOutlined />, label: 'Хянах самбар' },
    { key: '/admin/game', icon: <PlayCircleOutlined />, label: 'Тоглолтууд' },
    { key: '/admin/tournament', icon: <TrophyOutlined />, label: 'Тэмцээн' },
    { key: '/admin/withdrawal', icon: <DollarOutlined />, label: 'Мөнгө авах хүсэлт' },
    { key: '/admin/platform-charges', icon: <BankOutlined />, label: 'Платформын хураамж' },
    { key: '/admin/chat', icon: <DollarOutlined />, label: 'Чат' },
    {
      key: 'user',
      icon: <UserOutlined />,
      label: 'Хэрэглэгч',
      children: [
        { key: '/admin/user', icon: <UserOutlined />, label: 'Хэрэглэгч нар' },
      ],
    },
  ];

  const filteredMenuItems = filterMenuByPermission(menuItems, userPermissions);
  const antdMenuItems = convertToAntdItems(filteredMenuItems);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div
          className="logo"
          style={{ color: 'white', padding: '16px', textAlign: 'center' }}
        >
          Poker
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          onClick={handleMenuClick}
          items={antdMenuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight" arrow>
            <Avatar
              size="large"
              style={{ cursor: 'pointer', backgroundColor: '#1890ff' }}
              icon={<UserOutlined />}
            />
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <Spin spinning={loading || isPending} tip="Ачааллаж байна..." size="large">
            <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
              {children}
            </div>
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}
