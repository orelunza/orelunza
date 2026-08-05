import { describe, expect, test } from 'vitest';

import {
	DEFAULT_DAY_LENGTH_SECONDS,
	LEGACY_DEFAULT_DAY_LENGTH_SECONDS,
	CelestialClock,
	migrateClockStateToDayLength
} from '../CelestialClock';
import { buildCalendarMonth, worldDateFromDayNumber, worldTimeFromClock } from './WorldCalendar';
import { describeLunarPhase, formatWorldTime } from './WorldTimeFormatter';

function advanceAtFps(clock: CelestialClock, seconds: number, fps: number): void {
	const delta = 1 / fps;
	const steps = Math.round(seconds * fps);

	for (let index = 0; index < steps; index += 1) {
		clock.advance(delta);
	}
}

describe('human-paced world time', () => {
	test('uses a two-hour production day and starts at 08:00', () => {
		const clock = new CelestialClock();
		const time = worldTimeFromClock(clock.currentDayNumber, clock.normalizedTimeOfDay);

		expect(DEFAULT_DAY_LENGTH_SECONDS).toBe(7200);
		expect(time.formattedTime).toBe('08:00');
		expect(time.formattedDate).toBe('Monday, January 1, Year 1');
	});

	test('one in-world minute lasts five real seconds', () => {
		const clock = new CelestialClock({ timeOfDaySeconds: 0 });
		clock.advance(5);
		const time = worldTimeFromClock(clock.currentDayNumber, clock.normalizedTimeOfDay);

		expect(time.minuteOfDay).toBe(1);
	});

	test('remains frame-rate independent at 30, 60 and 120 FPS', () => {
		const make = (fps: number): number => {
			const clock = new CelestialClock({ timeOfDaySeconds: 0 });
			advanceAtFps(clock, 300, fps);
			return worldTimeFromClock(clock.currentDayNumber, clock.normalizedTimeOfDay).minuteKey;
		};

		expect(make(30)).toBe(make(60));
		expect(make(60)).toBe(make(120));
	});

	test('crosses 23:59 to 00:00 and advances the date', () => {
		const clock = new CelestialClock({
			timeOfDaySeconds: DEFAULT_DAY_LENGTH_SECONDS - 1,
			dayNumber: 0
		});
		clock.advance(2);
		const time = worldTimeFromClock(clock.currentDayNumber, clock.normalizedTimeOfDay);

		expect(time.formattedTime).toBe('00:00');
		expect(time.dayNumber).toBe(1);
		expect(time.formattedDate).toBe('Tuesday, January 2, Year 1');
	});

	test('migrates a legacy twenty-minute day without changing the visible hour', () => {
		const legacyState = {
			timeOfDaySeconds: LEGACY_DEFAULT_DAY_LENGTH_SECONDS * 0.75,
			dayNumber: 12
		};
		const migrated = migrateClockStateToDayLength(
			legacyState,
			LEGACY_DEFAULT_DAY_LENGTH_SECONDS,
			DEFAULT_DAY_LENGTH_SECONDS
		);
		const time = worldTimeFromClock(
			migrated.dayNumber,
			migrated.timeOfDaySeconds / DEFAULT_DAY_LENGTH_SECONDS
		);

		expect(migrated.timeOfDaySeconds).toBe(DEFAULT_DAY_LENGTH_SECONDS * 0.75);
		expect(time.formattedTime).toBe('18:00');
		expect(time.dayNumber).toBe(12);
	});
});

describe('Orelunza civil calendar', () => {
	test('maps the creation day to Monday, January 1, Year 1', () => {
		expect(worldDateFromDayNumber(0)).toMatchObject({
			weekdayName: 'Monday',
			monthName: 'January',
			day: 1,
			year: 1,
			season: 'winter'
		});
	});

	test('rolls January 31 into February 1', () => {
		expect(worldDateFromDayNumber(31)).toMatchObject({
			monthName: 'February',
			day: 1,
			year: 1
		});
	});

	test('rolls February 28 into March 1', () => {
		expect(worldDateFromDayNumber(31 + 28)).toMatchObject({
			monthName: 'March',
			day: 1,
			year: 1,
			season: 'spring'
		});
	});

	test('rolls December 31 into a new year', () => {
		expect(worldDateFromDayNumber(365)).toMatchObject({
			weekdayName: 'Tuesday',
			monthName: 'January',
			day: 1,
			year: 2
		});
	});

	test('keeps weekdays stable after thousands of days', () => {
		const date = worldDateFromDayNumber(10_000);

		expect(date.dayNumber).toBe(10_000);
		expect(date.weekday).toBe(10_000 % 7);
		expect(date.year).toBeGreaterThan(20);
	});

	test('builds a Monday-first monthly grid with the current day highlighted', () => {
		const month = buildCalendarMonth(1, 1, 0);

		expect(month.weekdayOffset).toBe(0);
		expect(month.daysInMonth).toBe(31);
		expect(month.cells[0]).toMatchObject({ day: 1, dayNumber: 0, isCurrentDay: true });
		expect(month.cells[30]).toMatchObject({ day: 31, dayNumber: 30 });
		expect(month.cells[31].day).toBeNull();
	});

	test('formats clock parts with leading zeroes', () => {
		expect(formatWorldTime(8, 5)).toBe('08:05');
	});

	test('derives stable day periods and minute keys', () => {
		const morning = worldTimeFromClock(4, 8 / 24);
		const night = worldTimeFromClock(4, 23 / 24);

		expect(morning.period).toBe('morning');
		expect(night.period).toBe('night');
		expect(morning.minuteKey).toBe(4 * 1440 + 480);
	});

	test('describes the major lunar phases', () => {
		expect(describeLunarPhase(0)).toBe('New Moon');
		expect(describeLunarPhase(0.25)).toBe('First Quarter');
		expect(describeLunarPhase(0.5)).toBe('Full Moon');
		expect(describeLunarPhase(0.75)).toBe('Last Quarter');
	});
});
