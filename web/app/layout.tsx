export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">
        <header className="p-4 bg-green-700 text-white font-bold">🌱 VerdantOps Dashboard</header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
