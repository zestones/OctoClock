import { useMemo, useState } from 'preact/hooks';
import { SearchInput } from '../../components/SearchInput.jsx';
import { useElapsedTimer } from '../../hooks/useElapsedTimer.js';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClock } from '../../icons.jsx';
import { AggregationService } from '../../utils/aggregation.utils.js';
import { TimeService } from '../../utils/time.utils.js';
import { TrackedList } from './TrackedList.jsx';

export function CalendarView({ tracked }) {
    const getLocalDate = () => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    };

    const [currentDate, setCurrentDate] = useState(getLocalDate());
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const { activeIssue, elapsedTime } = useElapsedTimer({ includeTotalTime: true });
    const [searchTerm, setSearchTerm] = useState('');

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    lastDayOfMonth.setHours(0, 0, 0, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const paddingDays = Array(firstDayWeekday).fill(null);

    const trackedDays = useMemo(() => {
        const map = {};
        tracked.forEach((entry) => {
            if (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
                map[entry.date] = (map[entry.date] || 0) + (entry.seconds || 0);
            }
        });
        return map;
    }, [tracked]);

    const maxDaySeconds = useMemo(() => Math.max(...Object.values(trackedDays), 1), [trackedDays]);

    const selectedDayTracked = useMemo(() => {
        const dateStr = TimeService.getLocalDateString(selectedDate);
        return tracked.filter((entry) => entry.date === dateStr);
    }, [tracked, selectedDate]);

    const selectedDayTotalSeconds = useMemo(() => {
        return selectedDayTracked.reduce((sum, entry) => sum + (entry.seconds || 0), 0);
    }, [selectedDayTracked]);

    const filteredTracked = useMemo(() => {
        if (!searchTerm) return selectedDayTracked;
        return selectedDayTracked.filter(
            (entry) =>
                entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.issueUrl.toLowerCase().includes(searchTerm.toLowerCase()),
        );
    }, [selectedDayTracked, searchTerm]);

    const entries = useMemo(() => {
        const grouped = filteredTracked.reduce((acc, entry) => {
            if (!acc[entry.issueUrl]) {
                const repo = AggregationService.parseRepo(entry.issueUrl);
                const { issueNumber } = AggregationService.parseEntryTitle(entry.title);
                acc[entry.issueUrl] = {
                    title: AggregationService.extractCleanTitle(entry.title),
                    repo,
                    issueNumber,
                    seconds: 0,
                    issueUrl: entry.issueUrl,
                };
            }
            acc[entry.issueUrl].seconds += entry.seconds;
            return acc;
        }, {});
        return Object.values(grouped).map((e) => ({
            ...e,
            displayTime: e.issueUrl === activeIssue && elapsedTime ? elapsedTime : TimeService.formatTime(e.seconds),
        }));
    }, [filteredTracked, elapsedTime, activeIssue]);

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const selectDay = (day) => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        d.setHours(0, 0, 0, 0);
        setSelectedDate(d);
    };

    const isDayTracked = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = TimeService.getLocalDateString(date);
        const todayStr = TimeService.getLocalDateString(getLocalDate());
        return dateStr in trackedDays || dateStr === todayStr;
    };

    const getDayHeatLevel = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = TimeService.getLocalDateString(date);
        const seconds = trackedDays[dateStr] || 0;
        if (seconds === 0) return 0;
        const ratio = seconds / maxDaySeconds;
        if (ratio < 0.15) return 1;
        if (ratio < 0.35) return 2;
        if (ratio < 0.55) return 3;
        if (ratio < 0.80) return 4;
        return 5;
    };

    const isSelectedDay = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        return date.toDateString() === selectedDate.toDateString();
    };

    const isToday = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        return date.toDateString() === getLocalDate().toDateString();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Sticky header — metrics + search only */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border-subtle">
                {/* Selected day metrics */}
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                        <IconCalendar size={11} className="text-accent" />
                        <span className="text-[11px] font-medium text-primary">
                            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                        <IconClock size={11} className="text-accent" />
                        <span className="text-[11px] font-mono font-semibold tabular-nums text-accent-text">
                            {TimeService.formatTime(selectedDayTotalSeconds)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1">
                        <span className="text-[11px] font-semibold text-primary">{entries.length}</span>
                        <span className="text-[10px] text-muted">issue{entries.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* Search — always visible */}
                <SearchInput placeholder="Search entries..." value={searchTerm} onInput={setSearchTerm} className="" />
            </div>

            {/* Scrollable content — calendar + entries */}
            <div className="flex-1 overflow-y-auto popup-scroll px-4 pt-2 pb-1">
                {/* Calendar card */}
                <div className="bg-surface border border-border-subtle rounded-xl p-3 mb-3">
                    {/* Month navigation */}
                    <div className="flex justify-between items-center mb-2">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="p-1 text-muted hover:text-secondary hover:bg-raised rounded-lg cursor-pointer transition-colors"
                        >
                            <IconChevronLeft size={14} />
                        </button>
                        <span className="text-[13px] font-bold text-primary">
                            {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="p-1 text-muted hover:text-secondary hover:bg-raised rounded-lg cursor-pointer transition-colors"
                        >
                            <IconChevronRight size={14} />
                        </button>
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day, i) => (
                            <div key={i} className="text-[9px] font-semibold text-muted uppercase tracking-wider py-1">
                                {day}
                            </div>
                        ))}
                        {paddingDays.map((_, i) => (
                            <div key={`pad-${i}`} className="h-7" />
                        ))}
                        {daysArray.map((day) => {
                            const hasTracked = isDayTracked(day);
                            const selected = isSelectedDay(day);
                            const today = isToday(day);
                            const heatLevel = getDayHeatLevel(day);
                            return (
                                <button
                                    type="button"
                                    key={day}
                                    className={`h-7 w-full flex items-center justify-center rounded-md text-[11px] transition-all ${heatLevel > 0 ? `day-heat-${heatLevel} font-medium` : today ? 'text-primary font-medium bg-raised/50' : 'text-faint'
                                        } ${selected ? 'ring-2 ring-accent text-accent font-semibold' : heatLevel > 0 ? `${heatLevel >= 3 ? 'text-white' : 'text-success-text'} hover:brightness-110` : ''} ${hasTracked || today ? 'cursor-pointer' : ''
                                        }`}
                                    onClick={() => (hasTracked || today) && selectDay(day)}
                                    tabIndex={hasTracked || today ? 0 : -1}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Separator */}
                <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-border-subtle" />
                    <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-px bg-border-subtle" />
                </div>

                {entries.length === 0 ? (
                    <div className="flex flex-col items-center py-10">
                        <div className="text-faint mb-2">
                            <IconClock size={28} />
                        </div>
                        <div className="text-[12px] text-muted">No entries for this day</div>
                        <div className="text-[11px] text-faint mt-0.5">Select a highlighted day to view tracked time</div>
                    </div>
                ) : (
                    <TrackedList entries={entries} showTimerControls={true} />
                )}
            </div>
        </div>
    );
}
