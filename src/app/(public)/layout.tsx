export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {children}
    </div>
  );
}
