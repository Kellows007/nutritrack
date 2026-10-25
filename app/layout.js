import "./globals.css";

export const metadata = {
  title: "Nutritrack",
  description: "Add your groceries with one receipt photo.",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#2f6b3f" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
