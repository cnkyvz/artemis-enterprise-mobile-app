import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function IstatistikPaneli() {
  const [data, setData] = useState([]);
  const [firmalar, setFirmalar] = useState([]);

  useEffect(() => {
    fetch("/api/mail-istatistikleri")
      .then((res) => res.json())
      .then((json) => {
        setData(json.gunlukSayilar);
        setFirmalar(json.firmaBazli);
      });
  }, []);

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold">📊 Mail Gönderim İstatistikleri</h1>

      <Tabs defaultValue="gunluk" className="w-full">
        <TabsList>
          <TabsTrigger value="gunluk">Günlük Gönderim</TabsTrigger>
          <TabsTrigger value="firma">Firma Bazlı</TabsTrigger>
        </TabsList>

        <TabsContent value="gunluk">
          <Card>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis dataKey="tarih" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="randevu" name="Randevu Maili" />
                  <Bar dataKey="pdf" name="PDF Maili" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firma">
          <Card>
            <CardContent>
              <table className="w-full text-sm text-left border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Firma</th>
                    <th className="p-2 border">Randevu Maili</th>
                    <th className="p-2 border">PDF Maili</th>
                    <th className="p-2 border">Randevu Tarihleri</th>
                  </tr>
                </thead>
                <tbody>
                  {firmalar.map((f, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border font-semibold">{f.company_name}</td>
                      <td className="p-2 border">{f.randevu_sayisi}</td>
                      <td className="p-2 border">{f.pdf_sayisi}</td>
                      <td className="p-2 border text-xs">
                        {f.randevu_tarihleri?.join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
