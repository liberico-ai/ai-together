import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {identityService,SESSION_COOKIE} from '@/server/identity';
import {database} from '@/server/db';
import {teamCatalog} from '@/server/team-catalog';
import {AppError} from '@/server/errors';
export const dynamic='force-dynamic';
const sourceUrl='https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit';
const buOrder=['LBRC','XECA','IBS HI'];

export default async function PortfolioPage() {
 let principal;
 try {principal=await identityService().session((await cookies()).get(SESSION_COOKIE)?.value);}
 catch(error){if(error instanceof AppError&&error.status===401) redirect('/login');throw error;}
 const {tasks,platforms}=await teamCatalog(await database(),principal);
 return <main className="team-page"><a href="/">← Không gian LibeTech</a>
  <h1>Dự án và việc Team Tech</h1>
  <p>Bản đọc bảng việc ngày 11/11/2026. Trạng thái, người phụ trách và hạn dưới đây là thông tin nguồn, chưa phải giao việc hoặc nghiệm thu trên AI OS.</p>
  <p><a href={sourceUrl} target="_blank" rel="noreferrer">Mở bảng việc của team</a></p>
  {tasks.length===0?<section className="panel"><p>Chưa có danh mục nguồn trong các dự án được cấp cho tài khoản này.</p></section>:
   buOrder.filter(bu=>tasks.some(t=>t.bu===bu)).map(bu=>{
    const work=tasks.filter(t=>t.bu===bu),systems=platforms.filter(s=>s.bu===bu);
    return <section key={bu} className="panel team-form"><h2>{bu} · {work.length} việc</h2>
      <p>Danh mục nền tảng từ nguồn 26/10: {systems.length?systems.map(s=>s.name).join(' · '):'chưa có trong bảng nền tảng'}</p>
      <div style={{overflowX:'auto'}}><table><thead><tr><th>STT</th><th>Đầu việc</th><th>Phụ trách nguồn</th><th>Trạng thái nguồn</th><th>Hạn nguồn</th><th>Căn cứ</th></tr></thead>
      <tbody>{work.map(t=><tr key={t.source_ref}><td>{t.stt}</td><td><strong>{t.title}</strong>
       {(t.collaborators||t.source_note)&&<details><summary>Phối hợp và ghi chú nguồn</summary>
        {t.collaborators&&<p>Phối hợp: {t.collaborators}</p>}{t.source_note&&<p>{t.source_note}</p>}</details>}</td>
       <td>{t.source_owner||'Chưa ghi'}</td><td>{t.source_status}</td><td>{t.due_raw||'Chưa ghi'}</td>
       <td><a href={`${sourceUrl}#range=A${t.source_row}:H${t.source_row}`} target="_blank" rel="noreferrer">Dòng {t.source_row}</a></td></tr>)}</tbody></table></div>
    </section>;
   })}
  <p>Danh mục nguồn chỉ đọc. Việc bổ sung hoặc đổi phân công chính thức đi qua quy trình BoM; kết quả nghiệm thu cần bằng chứng riêng.</p>
 </main>;
}
