import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@/components/ui/tabs';

export default function MailStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/mail-stats', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4">Yükleniyor...</div>;

  return (
    <div className="p-4 grid gap-4">
      <h1 className="text-xl font-bold">📊 Mail Gönderim İstatistikleri</h1>

      <Tabs defaultValue="grafik">
        <TabsList>
          <TabsTrigger value="grafik">Günlük Grafik</TabsTrigger>
          <TabsTrigger value="loglar">Gönderim Logları</TabsTrigger>
        </TabsList>

        <TabsContent value="grafik">
          <Card>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyStats.slice().reverse()}>
                  <XAxis dataKey="tarih" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sayi" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loglar">
          <Card>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>📧 E-Posta</TableHead>
                    <TableHead>Konu</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Gönderildi</TableHead>
                    <TableHead>Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.logs.map((log, i) => (
                    <TableRow key={i}>
                      <TableCell>{log.to_email}</TableCell>
                      <TableCell>{log.subject}</TableCell>
                      <TableCell>{log.status}</TableCell>
                      <TableCell>{log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-red-600 text-xs">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
