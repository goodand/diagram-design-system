// View purpose is independent of the reader and file format.
export function viewStem(type,audience) {
 const unit={Function_Definition:'function',Process_Summary_Linear:'summary',Process_Summary_Router:'summary',Process_Core:'core',Process_Full:'full',l0_summary:'summary',l1_partial:'core',l1_full:'full'}[type];
 if(!unit)return 'diagram'; // Historical untyped IR.
 return `${unit}.${audience || (['function','summary'].includes(unit)?'common':'human')}`;
}
export const viewOutputNames=['diagram', 'function.common','summary.common','core.human','core.agent','full.human'].flatMap(stem=>['svg','png','html'].map(ext=>`${stem}.${ext}`));
