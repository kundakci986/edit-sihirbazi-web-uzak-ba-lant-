export const metadata = {
  title: "Edit Sihirbazı",
  description: "CapCut Benzeri Video Editörü",
}

import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className="bg-black text-white min-h-screen overflow-y-scroll">
{children}</body>
    </html>
  )
}
