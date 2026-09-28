package calc

import (
	"math"
	"testing"
	"time"
)

var tehran, _ = time.LoadLocation("Asia/Tehran")

func at(y int, m time.Month, d, h, min int) time.Time {
	return time.Date(y, m, d, h, min, 0, 0, tehran)
}

func TestNightShiftBonus(t *testing.T) {
	night := []Rule{{StartMin: 0, EndMin: 360, Multiplier: 1.1}}
	tot := NewTotals()
	// 22:00 -> 02:00: two normal hours then two night hours.
	tot.Add(at(2025, 9, 1, 22, 0), at(2025, 9, 2, 2, 0), at(2025, 9, 1, 0, 0), at(2025, 10, 1, 0, 0), tehran, night)
	if tot.Minutes != 240 {
		t.Fatalf("minutes = %d, want 240", tot.Minutes)
	}
	if tot.BonusMinutes != 120 {
		t.Fatalf("bonus minutes = %d, want 120", tot.BonusMinutes)
	}
	if math.Abs(tot.WeightedMinutes-252) > 1e-6 {
		t.Fatalf("weighted = %v, want 252", tot.WeightedMinutes)
	}
	if tot.Days["2025-09-01"].Minutes != 120 || tot.Days["2025-09-02"].Minutes != 120 {
		t.Fatalf("daily split wrong: %+v %+v", tot.Days["2025-09-01"], tot.Days["2025-09-02"])
	}
	if got := Pay(tot.WeightedMinutes, 100000); got != 420000 {
		t.Fatalf("pay = %d, want 420000", got)
	}
}

func TestClipToPeriod(t *testing.T) {
	tot := NewTotals()
	tot.Add(at(2025, 8, 31, 23, 0), at(2025, 9, 1, 1, 0), at(2025, 9, 1, 0, 0), at(2025, 10, 1, 0, 0), tehran, nil)
	if tot.Minutes != 60 {
		t.Fatalf("minutes = %d, want 60", tot.Minutes)
	}
}

func TestRulesPickHighestAndWeekday(t *testing.T) {
	rules := []Rule{
		{StartMin: 0, EndMin: 360, Multiplier: 1.1},
		{StartMin: 0, EndMin: 0, Weekdays: 1 << uint(time.Friday), Multiplier: 1.5},
	}
	if m := multiplier(rules, 60, time.Friday); m != 1.5 {
		t.Fatalf("friday night = %v, want 1.5", m)
	}
	if m := multiplier(rules, 60, time.Monday); m != 1.1 {
		t.Fatalf("monday night = %v, want 1.1", m)
	}
	if m := multiplier(rules, 600, time.Monday); m != 1 {
		t.Fatalf("monday day = %v, want 1", m)
	}
	wrap := Rule{StartMin: 22 * 60, EndMin: 2 * 60, Multiplier: 1.2}
	if !wrap.matches(23*60, time.Monday) || !wrap.matches(60, time.Monday) || wrap.matches(12*60, time.Monday) {
		t.Fatal("wrapping rule mismatch")
	}
}

func TestWeekStartsSaturday(t *testing.T) {
	p := Week(at(2025, 9, 24, 15, 0), 0, tehran) // Wednesday
	if p.Start.Weekday() != time.Saturday || p.Start.Day() != 20 || p.End.Day() != 27 {
		t.Fatalf("week = %v - %v", p.Start, p.End)
	}
	p = Week(at(2025, 9, 20, 0, 0), -1, tehran) // Saturday, previous week
	if p.Start.Day() != 13 {
		t.Fatalf("previous week start = %v", p.Start)
	}
}

func TestMonths(t *testing.T) {
	p := Month(at(2025, 9, 28, 12, 0), 0, "jalali", tehran)
	if p.Year != 1404 || p.Month != 7 || p.Start.Day() != 23 || p.End.Month() != time.October || p.End.Day() != 23 {
		t.Fatalf("jalali month = %+v", p)
	}
	p = Month(at(2025, 4, 1, 12, 0), -1, "jalali", tehran) // 1404/01/12 -> previous is Esfand 1403
	if p.Year != 1403 || p.Month != 12 {
		t.Fatalf("previous jalali month = %d/%d", p.Year, p.Month)
	}
	p = Month(at(2025, 1, 15, 12, 0), -1, "gregorian", tehran)
	if p.Year != 2024 || p.Month != 12 {
		t.Fatalf("previous gregorian month = %d/%d", p.Year, p.Month)
	}
}
