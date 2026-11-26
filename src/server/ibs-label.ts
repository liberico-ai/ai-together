// AGENTS.md: IBS HI keeps pointers, hashes and Tech work metadata only. The one TypeScript rule for «is this an IBS HI label», and what follows from it.

/** Fail-closed IBS test of a label or a project BU: anything that contains «ibs» once normalised (NFKC, lower case, letters and digits only). SQL twin: work_import_is_ibs_text. */
export const ibsLabel = (v: string | null | undefined) => (v ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').includes('ibs');

/** The free-text note a source row is stored with: none for IBS HI (OQ-62 câu 4 (1)). */
export const storedSourceNote = (bu: string, note: string) => ibsLabel(bu) ? '' : note;

/** What the source catalog says where it shows no note on purpose. */
export const sourceNoteNotice = (bu: string) => ibsLabel(bu) ? 'Dòng IBS HI không hiện ghi chú nguồn; xem bảng nguồn.' : '';
