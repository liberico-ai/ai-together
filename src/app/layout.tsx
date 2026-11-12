import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LibeTech AI OS · Không gian vận hành',description:'Bản thử nghiệm cục bộ cho điều phối, bằng chứng và vận hành LibeTech.'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="vi"><body>{children}</body></html>; }
