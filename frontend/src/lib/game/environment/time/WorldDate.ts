export const WEEKDAY_NAMES = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
] as const;

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
] as const;

export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const DAYS_PER_WEEK = WEEKDAY_NAMES.length;
export const DAYS_PER_YEAR = 365;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];
export type MonthName = (typeof MONTH_NAMES)[number];
export type WorldSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type WorldDayPeriod = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface WorldDate {
	/** Zero-based absolute day since the world was created. */
	dayNumber: number;
	/** One-based year number. */
	year: number;
	/** One-based month number. */
	month: number;
	monthName: MonthName;
	/** One-based day inside the month. */
	day: number;
	/** Zero-based weekday index where Monday is 0. */
	weekday: number;
	weekdayName: WeekdayName;
	/** Zero-based day inside the year. */
	dayOfYear: number;
	season: WorldSeason;
}

export interface WorldTimeSnapshot extends WorldDate {
	/** Integer hour in [0, 23]. */
	hour: number;
	/** Integer minute in [0, 59]. */
	minute: number;
	/** Integer minute in [0, 1439]. */
	minuteOfDay: number;
	/** Stable key that changes exactly once per in-world minute. */
	minuteKey: number;
	period: WorldDayPeriod;
	formattedTime: string;
	formattedDate: string;
	formattedShortDate: string;
}

export interface CalendarDayCell {
	key: string;
	day: number | null;
	dayNumber: number | null;
	isCurrentDay: boolean;
}

export interface CalendarMonthSnapshot {
	year: number;
	month: number;
	monthName: MonthName;
	weekdayOffset: number;
	daysInMonth: number;
	cells: CalendarDayCell[];
}

export type WorldDayAnnouncementKind = 'day' | 'month' | 'year';

export interface WorldDayAnnouncement {
	id: string;
	kind: WorldDayAnnouncementKind;
	title: string;
	subtitle: string;
}
