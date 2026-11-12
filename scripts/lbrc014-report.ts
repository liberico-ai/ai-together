import scope from '../deploy/pilot-scope.json';
import snapshot from '../docs/LBRC014-RECONCILIATION-20261108.json';
import type { EvidenceFact,ReportInput } from '../src/server/evidence-scores';

const observed='2026-11-09T15:19:49+07:00';
const releaseSha='5b38598de8bca1b258be7ee4b7086a993810478a';
const iosReportedSha='751327b853b50ed7b06f87c747198a4a731b0ac6';
const caseNote='docs/LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md';
type FactFields=Pick<EvidenceFact,'id'|'source_id'|'source_type'|'occurredAt'|'title'|'detail'|'confidence'|'sourceSha'|'quality_score'>;
const fact=(fields:FactFields):EvidenceFact=>({...fields,workCode:snapshot.code,ingested_at:observed});

export const lbrc014Report:ReportInput={
  tenantId:scope.tenantId,projectId:scope.projectId,synthetic:false,
  period:{start:'2026-11-09T00:00:00+07:00',end:'2026-11-16T00:00:00+07:00',asOf:observed},
  policy:{version:'SPEC-003-LBRC014-observation',approvedRef:null,weights:{K1:.35,K2:.2,K3:.25,K4:.2},
    minimum:{K1:2,K2:2,K3:2},coverage:1,reviewCoverage:1},
  subjects:[],deliveries:[],requests:[],replies:[],reviews:[],contributions:[],
  works:[{code:snapshot.code,title:snapshot.title,sourceStatus:snapshot.workbookClaim.stateReported,
    sourceSha:snapshot.sourceSha,sourceObservedAt:observed,dueAt:null,technical:'pending',business:'pending',
    gaps:[
      'Xác nhận hạn giao và thời hạn phản hồi trước khi tính điểm đúng hạn.',
      'Bổ sung log test đúng SHA và kết quả review spec/code.',
      'Đối soát bản iOS thực cài với SHA và số phiên bản trong báo cáo.',
      'Bổ sung bằng chứng đích U4/U6 và xác nhận của người dùng nghiệp vụ.',
    ]}],
  evidence:[
    fact({id:'board-a31',source_id:caseNote+':321',source_type:'workbook',occurredAt:observed,quality_score:1,
      title:'Bảng việc ghi Hoàn thành',detail:'Đọc hàng A31:H31 ngày 09/11 lúc 15:19:49. Trạng thái nguồn được lưu riêng với nghiệm thu.',
      confidence:'observed'}),
    fact({id:'feature-sha',source_id:snapshot.sourceId,source_type:'github',occurredAt:snapshot.ingestedAt,quality_score:.75,
      title:'Đã đối soát SHA chức năng',detail:'Snapshot đã lưu có commit chức năng và 0 check runs. Chưa có SHA nghiệm thu trong snapshot.',
      confidence:'verified',sourceSha:snapshot.sourceSha}),
    fact({id:'release-sha',source_id:'docs/lbrc014-supplements-20261109/github-feature-compare-20261109T1337.json',
      source_type:'release',occurredAt:'2026-11-09T13:37:00+07:00',quality_score:.75,
      title:'Đối chiếu SHA chức năng và SHA phát hành',detail:'Hai tệp xử lý chỉ đường khớp. Gói cài và môi trường cần đối soát riêng.',
      confidence:'verified',sourceSha:releaseSha}),
    fact({id:'android-lab',source_id:'docs/lbrc014-supplements-20261109/uat-1131-inspection.json',
      source_type:'uat',occurredAt:'2026-11-09T11:31:00+07:00',quality_score:.7,
      title:'Hồ sơ thử Android',detail:'Đã xem gói Android 1.0.27+29, ảnh ba màn và mở Maps. Bản thử debug/dev và gói release cần nối nguồn.',
      confidence:'observed',sourceSha:releaseSha}),
    fact({id:'quan-u7',source_id:caseNote+':253',source_type:'telegram',occurredAt:'2026-11-09T13:37:00+07:00',quality_score:.7,
      title:'Quân bổ sung ảnh U7',detail:'Ảnh có thông báo không mở được ứng dụng bản đồ. Thao tác tắt ứng dụng và kết quả dùng tiếp là lời người thử.',
      confidence:'observed'}),
    fact({id:'phuong-ios',source_id:'docs/lbrc014-supplements-20261109/phuong-ios-1502-inspection.json',source_type:'uat',
      occurredAt:'2026-11-09T15:02:00+07:00',quality_score:.7,title:'Phương bổ sung hồ sơ iOS',
      detail:'Đã xem báo cáo và tám ảnh. Báo cáo nội bộ ghi 7/7, còn thiếu bằng chứng U4/U6 và xác minh bản thực cài. CVKD chưa sử dụng.',
      confidence:'observed',sourceSha:iosReportedSha}),
  ],
};
if(process.argv[1]?.endsWith('lbrc014-report.ts')) process.stdout.write(JSON.stringify(lbrc014Report,null,2)+'\n');
