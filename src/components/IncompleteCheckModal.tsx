import React from 'react';
import { AlertCircle, X, ChevronRight, CheckCircle2 } from 'lucide-react';

export interface MissingItemInfo {
  sectionTitle: string;
  itemId: string;
  code: string;
  title: string;
  targetDirectorName?: string;
  deptName?: string;
}

interface IncompleteCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingItems: MissingItemInfo[];
  onProceedAnyway: () => void;
  onJumpToItem: (itemId: string) => void;
}

export const IncompleteCheckModal: React.FC<IncompleteCheckModalProps> = ({
  isOpen,
  onClose,
  missingItems,
  onProceedAnyway,
  onJumpToItem,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-900 text-white p-5 flex items-center justify-between border-b border-amber-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-800 text-amber-200">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                แจ้งเตือน: ยังมีข้อคำถามที่ไม่ได้ตอบ ({missingItems.length} ข้อ)
              </h3>
              <p className="text-xs text-amber-200/80">
                ตามหลักธรรมาภิบาล คณะกรรมการควรประเมินให้ครบถ้วนทุกข้อ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing items list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          <div className="text-xs text-slate-600 mb-2 font-medium">
            คลิกที่รายการด้านล่างเพื่อไปยังข้อคำถามที่ยังไม่ได้ตอบโดยตรง:
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {missingItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onJumpToItem(item.itemId);
                  onClose();
                }}
                className="w-full p-3 text-left hover:bg-amber-50/60 transition-colors flex items-center justify-between gap-3 text-xs group"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px]">
                      {item.code}
                    </span>
                    <span className="truncate">{item.sectionTitle}</span>
                    {item.targetDirectorName && (
                      <span className="text-slate-500 font-normal truncate">
                        (ประเมิน: {item.targetDirectorName})
                      </span>
                    )}
                    {item.deptName && (
                      <span className="text-slate-500 font-normal">
                        ({item.deptName})
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 truncate mt-0.5">{item.title}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-800 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            กลับไปทำต่อให้ครบ (แนะนำ)
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ยืนยันส่งผลเท่านี้
          </button>
        </div>
      </div>
    </div>
  );
};
