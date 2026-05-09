export class TimeService {
    static formatTime(seconds, offsetSeconds = 0) {
        const totalSeconds = Math.floor(seconds + offsetSeconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    static formatHuman(totalSeconds) {
        totalSeconds = Math.floor(totalSeconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}min`);
        if (s > 0 || parts.length === 0) parts.push(`${s}s`);
        return parts.join(' ');
    }

    static timeStringSince(startTime, offsetSeconds = 0) {
        const date = new Date(startTime);
        if (Number.isNaN(date.getTime())) {
            return TimeService.formatTime(0, offsetSeconds);
        }
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        return TimeService.formatTime(seconds, offsetSeconds);
    }

    static getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    static splitSeconds(totalSeconds) {
        return {
            minutes: Math.floor(totalSeconds / 60),
            seconds: Math.floor(totalSeconds % 60),
        };
    }
}
