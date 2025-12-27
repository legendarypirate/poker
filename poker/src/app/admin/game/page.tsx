// app/admin/delivery/page.tsx  (Server Component by default)
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Spin } from 'antd';

// ⚡ make sure the heavy client code only runs in the browser
const DeliveryClient = dynamic(() => import('./DeliveryClient'), { ssr: false });

export default function DeliveryPage() {
  return (
    <Suspense fallback={<Spin size="large" />}>
      <DeliveryClient />
    </Suspense>
  );
}
