import { useState } from 'preact/hooks';
import { IconX } from '../icons.jsx';

export function EditTimeModal({ date, seconds, onConfirm, onCancel }) {
    const [hours, setHours] = useState(Math.floor(seconds / 3600));
    const [minutes, setMinutes] = useState(Math.floor((seconds % 3600) / 60));
    const [secs, setSecs] = useState(Math.floor(seconds % 60));

    const totalSeconds = hours * 3600 + minutes * 60 + secs;
    const isValid = totalSeconds > 0;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.floor(value) || 0));

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl w-75 shadow-2xl shadow-black/20 p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[14px] font-semibold text-primary">Edit Time</h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-muted hover:text-secondary cursor-pointer p-0.5 rounded-md hover:bg-raised transition-colors"
                    >
                        <IconX size={16} />
                    </button>
                </div>
                <p className="text-[12px] text-tertiary mb-4">
                    Session on <span className="font-medium text-secondary">{date}</span>
                </p>

                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 text-center">
                        <label
                            htmlFor="edit-hours"
                            className="text-[10px] text-tertiary uppercase tracking-wider font-medium block mb-1"
                        >
                            Hours
                        </label>
                        <div className="time-segment-field">
                            <input
                                id="edit-hours"
                                type="number"
                                min="0"
                                max="999"
                                inputMode="numeric"
                                value={hours}
                                onFocus={(e) => e.currentTarget.select()}
                                onInput={(e) => setHours(clamp(e.currentTarget.value, 0, 999))}
                                className="time-segment-input"
                            />
                        </div>
                    </div>
                    <span className="text-[18px] text-muted font-bold mt-4">:</span>
                    <div className="flex-1 text-center">
                        <label
                            htmlFor="edit-minutes"
                            className="text-[10px] text-tertiary uppercase tracking-wider font-medium block mb-1"
                        >
                            Min
                        </label>
                        <div className="time-segment-field">
                            <input
                                id="edit-minutes"
                                type="number"
                                min="0"
                                max="59"
                                inputMode="numeric"
                                value={minutes}
                                onFocus={(e) => e.currentTarget.select()}
                                onInput={(e) => setMinutes(clamp(e.currentTarget.value, 0, 59))}
                                className="time-segment-input"
                            />
                        </div>
                    </div>
                    <span className="text-[18px] text-muted font-bold mt-4">:</span>
                    <div className="flex-1 text-center">
                        <label
                            htmlFor="edit-seconds"
                            className="text-[10px] text-tertiary uppercase tracking-wider font-medium block mb-1"
                        >
                            Sec
                        </label>
                        <div className="time-segment-field">
                            <input
                                id="edit-seconds"
                                type="number"
                                min="0"
                                max="59"
                                inputMode="numeric"
                                value={secs}
                                onFocus={(e) => e.currentTarget.select()}
                                onInput={(e) => setSecs(clamp(e.currentTarget.value, 0, 59))}
                                className="time-segment-input"
                            />
                        </div>
                    </div>
                </div>

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
                        disabled={!isValid}
                        onClick={() => onConfirm(totalSeconds)}
                        className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors text-white bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
