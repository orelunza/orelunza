import type { WorldDate, WorldDayPeriod, WorldSeason } from './WorldDate';

export function padWorldTimePart(value: number): string {
	return Math.max(0, Math.floor(value)).toString().padStart(2, '0');
}

export function formatWorldTime(hour: number, minute: number): string {
	return `${padWorldTimePart(hour)}:${padWorldTimePart(minute)}`;
}

export function formatWorldDate(date: Readonly<WorldDate>): string {
	return `${date.weekdayName}, ${date.monthName} ${date.day}, Year ${date.year}`;
}

export function formatShortWorldDate(date: Readonly<WorldDate>): string {
	return `${date.weekdayName}, ${date.monthName} ${date.day} • Year ${date.year}`;
}

export function worldDayPeriod(hour: number): WorldDayPeriod {
	if (hour >= 5 && hour < 7) {
		return 'dawn';
	}

	if (hour >= 7 && hour < 12) {
		return 'morning';
	}

	if (hour >= 12 && hour < 17) {
		return 'afternoon';
	}

	if (hour >= 17 && hour < 21) {
		return 'evening';
	}

	return 'night';
}

export function formatSeason(season: WorldSeason): string {
	return season.charAt(0).toUpperCase() + season.slice(1);
}

export function formatWeatherLabel(weather: string): string {
	return weather
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export function describeLunarPhase(phase: number): string {
	const normalized = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;

	if (normalized < 0.03 || normalized >= 0.97) {
		return 'New Moon';
	}
	if (normalized < 0.22) {
		return 'Waxing Crescent';
	}
	if (normalized < 0.28) {
		return 'First Quarter';
	}
	if (normalized < 0.47) {
		return 'Waxing Gibbous';
	}
	if (normalized < 0.53) {
		return 'Full Moon';
	}
	if (normalized < 0.72) {
		return 'Waning Gibbous';
	}
	if (normalized < 0.78) {
		return 'Last Quarter';
	}

	return 'Waning Crescent';
}
