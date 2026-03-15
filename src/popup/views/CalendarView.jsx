import { useMemo, useState } from 'preact/hooks';
import { SearchInput } from '../../components/SearchInput.jsx';
import { useElapsedTimer } from '../../hooks/useElapsedTimer.js';
import { IconChevronLeft, IconChevronRight, IconClock } from '../../icons.jsx';
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

    const trackedDates = useMemo(() => {
        const dates = new Set();
        tracked.forEach((entry) => {
            if (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
                dates.add(entry.date);
            }
        });
        return Array.from(dates);
    }, [tracked]);

    const selectedDayTracked = useMemo(() => {
        const dateStr = TimeService.getLocalDateString(selectedDate);
        return tracked.filter((entry) => entry.date === dateStr);
    }, [tracked, selectedDate]);

    const selectedDayTotalTime = useMemo(() => {
        const totalSeconds = selectedDayTracked.reduce((sum, entry) => sum + (entry.seconds || 0), 0);
        return TimeService.formatTime(totalSeconds);
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
                acc[entry.issueUrl] = { title: AggregationService.extractCleanTitle(entry.title), repo, issueNumber, seconds: 0, issueUrl: entry.issueUrl };
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
        return trackedDates.includes(dateStr) || dateStr === todayStr;
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
        <div className="p-4">
            {/* Month navigation */}
            <div className="flex justify-between items-center mb-3">
                <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 text-muted hover:text-secondary hover:bg-surface rounded-lg cursor-pointer transition-colors"
                >
                    <IconChevronLeft size={16} />
                </button>
                <span className="text-[13px] font-semibold text-primary">
                    {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 text-muted hover:text-secondary hover:bg-surface rounded-lg cursor-pointer transition-colors"
                >
                    <IconChevronRight size={16} />
                </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5 text-center mb-4">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i} className="text-[10px] font-medium text-muted py-1">
                        {day}
                    </div>
                ))}
                {paddingDays.map((_, i) => (
                    <div key={`pad-${i}`} className="h-8" />
                ))}
                {daysArray.map((day) => {
                    const tracked = isDayTracked(day);
                    const selected = isSelectedDay(day);
                    const today = isToday(day);
                    return (
                        <button
                            type="button"
                            key={day}
                            className={`h-8 w-full flex items-center justify-center rounded-lg text-[12px] transition-colors ${selected
                                ? 'bg-accent text-white font-medium cursor-pointer'
                                : tracked
                                    ? 'bg-accent-subtle text-accent-text cursor-pointer hover:bg-accent-ring font-medium'
                                    : today
                                        ? 'text-primary font-medium'
                                        : 'text-faint'
                                } ${tracked || today ? 'cursor-pointer' : ''}`}
                            onClick={() => (tracked || today) && selectDay(day)}
                            tabIndex={tracked || today ? 0 : -1}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>

            {/* Selected day summary */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-subtle">
                <div className="text-[13px] text-secondary font-medium">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-1 text-[13px] font-mono font-semibold text-primary tabular-nums">
                    <IconClock size={13} className="text-muted" />
                    {selectedDayTotalTime}
                </div>
            </div>

            {/* Search */}
            <SearchInput placeholder="Search entries..." value={searchTerm} onInput={setSearchTerm} />

            {/* Entries */}
            {entries.length === 0 ? (
                <div className="text-[13px] text-muted text-center py-6">No entries for this day</div>
            ) : (
                <TrackedList entries={entries} showTimerControls={true} />
            )}
        </div>
    );
}
