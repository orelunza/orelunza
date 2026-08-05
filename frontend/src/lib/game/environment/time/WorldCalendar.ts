import {
	DAYS_PER_WEEK,
	DAYS_PER_YEAR,
	MONTH_LENGTHS,
	MONTH_NAMES,
	WEEKDAY_NAMES,
	type CalendarMonthSnapshot,
	type WorldDate,
	type WorldSeason,
	type WorldTimeSnapshot
} from './WorldDate';
import {
	formatShortWorldDate,
	formatWorldDate,
	formatWorldTime,
	worldDayPeriod
} from './WorldTimeFormatter';

const MINUTES_PER_DAY = 24 * 60;

export function normalizeWorldDayNumber(dayNumber: number): number {
	if (!Number.isFinite(dayNumber)) {
		return 0;
	}

	return Math.max(0, Math.floor(dayNumber));
}

export function worldSeasonForMonth(month: number): WorldSeason {
	if (month === 12 || month <= 2) {
		return 'winter';
	}
	if (month <= 5) {
		return 'spring';
	}
	if (month <= 8) {
		return 'summer';
	}

	return 'autumn';
}

export function worldDateFromDayNumber(dayNumber: number): WorldDate {
	const absoluteDay = normalizeWorldDayNumber(dayNumber);
	const yearIndex = Math.floor(absoluteDay / DAYS_PER_YEAR);
	const dayOfYear = absoluteDay % DAYS_PER_YEAR;
	let remaining = dayOfYear;
	let monthIndex = 0;

	while (monthIndex < MONTH_LENGTHS.length - 1 && remaining >= MONTH_LENGTHS[monthIndex]) {
		remaining -= MONTH_LENGTHS[monthIndex];
		monthIndex += 1;
	}

	const month = monthIndex + 1;
	const weekday = absoluteDay % DAYS_PER_WEEK;

	return {
		dayNumber: absoluteDay,
		year: yearIndex + 1,
		month,
		monthName: MONTH_NAMES[monthIndex],
		day: remaining + 1,
		weekday,
		weekdayName: WEEKDAY_NAMES[weekday],
		dayOfYear,
		season: worldSeasonForMonth(month)
	};
}

export function worldMinuteOfDay(normalizedTimeOfDay: number): number {
	const normalized = Number.isFinite(normalizedTimeOfDay) ? ((normalizedTimeOfDay % 1) + 1) % 1 : 0;

	return Math.min(MINUTES_PER_DAY - 1, Math.floor(normalized * MINUTES_PER_DAY + 1e-7));
}

export function worldTimeFromClock(
	dayNumber: number,
	normalizedTimeOfDay: number
): WorldTimeSnapshot {
	const date = worldDateFromDayNumber(dayNumber);
	const minuteOfDay = worldMinuteOfDay(normalizedTimeOfDay);
	const hour = Math.floor(minuteOfDay / 60);
	const minute = minuteOfDay % 60;

	return {
		...date,
		hour,
		minute,
		minuteOfDay,
		minuteKey: date.dayNumber * MINUTES_PER_DAY + minuteOfDay,
		period: worldDayPeriod(hour),
		formattedTime: formatWorldTime(hour, minute),
		formattedDate: formatWorldDate(date),
		formattedShortDate: formatShortWorldDate(date)
	};
}

export function firstDayNumberOfMonth(year: number, month: number): number {
	const safeYear = Math.max(1, Math.floor(year));
	const safeMonth = Math.min(12, Math.max(1, Math.floor(month)));
	let result = (safeYear - 1) * DAYS_PER_YEAR;

	for (let index = 0; index < safeMonth - 1; index += 1) {
		result += MONTH_LENGTHS[index];
	}

	return result;
}

export function buildCalendarMonth(
	year: number,
	month: number,
	currentDayNumber: number
): CalendarMonthSnapshot {
	const safeYear = Math.max(1, Math.floor(year));
	const safeMonth = Math.min(12, Math.max(1, Math.floor(month)));
	const firstDayNumber = firstDayNumberOfMonth(safeYear, safeMonth);
	const weekdayOffset = firstDayNumber % DAYS_PER_WEEK;
	const daysInMonth = MONTH_LENGTHS[safeMonth - 1];
	const cells = Array.from({ length: 42 }, (_, index) => {
		const day = index - weekdayOffset + 1;
		const insideMonth = day >= 1 && day <= daysInMonth;
		const cellDayNumber = insideMonth ? firstDayNumber + day - 1 : null;

		return {
			key: `${safeYear}-${safeMonth}-${index}`,
			day: insideMonth ? day : null,
			dayNumber: cellDayNumber,
			isCurrentDay: cellDayNumber === normalizeWorldDayNumber(currentDayNumber)
		};
	});

	return {
		year: safeYear,
		month: safeMonth,
		monthName: MONTH_NAMES[safeMonth - 1],
		weekdayOffset,
		daysInMonth,
		cells
	};
}
