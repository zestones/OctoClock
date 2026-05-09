import { IconX } from '../icons.jsx';

export function Modal({ title, message, confirmLabel = 'Confirm', confirmVariant = 'primary', onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl w-[320px] shadow-2xl shadow-black/20 p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[14px] font-semibold text-primary">{title}</h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-muted hover:text-secondary cursor-pointer p-0.5 rounded-md hover:bg-raised transition-colors"
                    >
                        <IconX size={16} />
                    </button>
                </div>
                <p className="text-[13px] text-tertiary mb-5 leading-relaxed">{message}</p>
                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg bg-raised text-secondary hover:bg-overlay cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`text-[13px] font-medium px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors text-white ${
                            confirmVariant === 'danger'
                                ? 'bg-danger-muted hover:bg-danger-hover'
                                : 'bg-accent hover:bg-accent-hover'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
