// Package calc turns shifts into worked minutes, weighted minutes and pay,
// and resolves calendar periods (weeks and months) in the company timezone.
package calc

import (
	"math"
	"time"

	"github.com/Bazi-Digital/shift-app/backend/internal/jalali"
	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

// Rule is the subset of a RateRule needed for calculation.
type Rule struct {
	StartMin, EndMin int
	Weekdays         int
	Multiplier       float64
}

func RulesFrom(rs []models.RateRule) []Rule {
	out := make([]Rule, 0, len(rs))
	for _, r := range rs {
		if r.Active {
			out = append(out, Rule{r.StartMin, r.EndMin, r.Weekdays, r.Multiplier})
		}
	}
	return out
}

func (r Rule) matches(minOfDay int, wd time.Weekday) bool {
	if r.Weekdays != 0 && r.Weekdays&(1<<uint(wd)) == 0 {
		return false
	}
	switch {
	case r.StartMin == r.EndMin:
		return true
	case r.StartMin < r.EndMin:
		return minOfDay >= r.StartMin && minOfDay < r.EndMin
	default:
		return minOfDay >= r.StartMin || minOfDay < r.EndMin
	}
}

// multiplier returns the highest multiplier among matching rules (never below 1).
// Rules do not stack: a night minute on a bonus weekday gets the larger of the two.
func multiplier(rules []Rule, minOfDay int, wd time.Weekday) float64 {
	m := 1.0
	for _, r := range rules {
		if r.Multiplier > m && r.matches(minOfDay, wd) {
			m = r.Multiplier
		}
	}
	return m
}

type Day struct {
	Minutes         int     `json:"minutes"`
	WeightedMinutes float64 `json:"weightedMinutes"`
}

type Totals struct {
	Minutes         int             `json:"minutes"`
	WeightedMinutes float64         `json:"weightedMinutes"`
	BonusMinutes    int             `json:"bonusMinutes"` // minutes paid above 1x
	Days            map[string]*Day `json:"-"`
}

func NewTotals() *Totals { return &Totals{Days: map[string]*Day{}} }

// Add accumulates the part of [start, end) that lies inside [from, to).
func (t *Totals) Add(start, end, from, to time.Time, loc *time.Location, rules []Rule) {
	if start.Before(from) {
		start = from
	}
	if end.After(to) {
		end = to
	}
	start = start.In(loc).Truncate(time.Minute)
	end = end.In(loc).Truncate(time.Minute)
	// Walk minute by minute; shifts are at most a day long so this is cheap
	// and handles DST and midnight crossings without special cases.
	for cur := start; cur.Before(end); cur = cur.Add(time.Minute) {
		mod := cur.Hour()*60 + cur.Minute()
		m := multiplier(rules, mod, cur.Weekday())
		t.Minutes++
		t.WeightedMinutes += m
		if m > 1 {
			t.BonusMinutes++
		}
		key := cur.Format("2006-01-02")
		d := t.Days[key]
		if d == nil {
			d = &Day{}
			t.Days[key] = d
		}
		d.Minutes++
		d.WeightedMinutes += m
	}
}

// Pay converts weighted minutes to money at an hourly rate, rounded to a whole unit.
func Pay(weightedMinutes float64, hourlyRate int64) int64 {
	return int64(math.Round(weightedMinutes / 60 * float64(hourlyRate)))
}

// Period is a half-open local-time range [Start, End).
type Period struct {
	Kind  string    `json:"kind"`
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
	Year  int       `json:"year"`  // month periods: year in the configured calendar
	Month int       `json:"month"` // month periods: 1-12 in the configured calendar
}

func midnight(t time.Time, loc *time.Location) time.Time {
	t = t.In(loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
}

// Week returns the Saturday-start week containing now, shifted by offset weeks.
func Week(now time.Time, offset int, loc *time.Location) Period {
	d := midnight(now, loc)
	back := (int(d.Weekday()) + 1) % 7 // days since Saturday
	start := d.AddDate(0, 0, -back+7*offset)
	return Period{Kind: "week", Start: start, End: start.AddDate(0, 0, 7)}
}

// Month returns the calendar month containing now, shifted by offset months.
func Month(now time.Time, offset int, calendar string, loc *time.Location) Period {
	n := now.In(loc)
	if calendar == models.CalendarJalali {
		jy, jm, _ := jalali.ToJalali(n.Year(), int(n.Month()), n.Day())
		idx := jy*12 + (jm - 1) + offset
		y, m := idx/12, idx%12+1
		return Period{Kind: "month", Start: jalaliStart(y, m, loc), End: jalaliStart((idx+1)/12, (idx+1)%12+1, loc), Year: y, Month: m}
	}
	first := time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, loc).AddDate(0, offset, 0)
	return Period{Kind: "month", Start: first, End: first.AddDate(0, 1, 0), Year: first.Year(), Month: int(first.Month())}
}

// MonthOf returns an explicit month (year/month in the configured calendar).
func MonthOf(year, month int, calendar string, loc *time.Location) Period {
	if calendar == models.CalendarJalali {
		idx := year*12 + month - 1
		return Period{Kind: "month", Start: jalaliStart(year, month, loc), End: jalaliStart((idx+1)/12, (idx+1)%12+1, loc), Year: year, Month: month}
	}
	first := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, loc)
	return Period{Kind: "month", Start: first, End: first.AddDate(0, 1, 0), Year: year, Month: month}
}

func jalaliStart(jy, jm int, loc *time.Location) time.Time {
	gy, gm, gd := jalali.ToGregorian(jy, jm, 1)
	return time.Date(gy, time.Month(gm), gd, 0, 0, 0, 0, loc)
}

// MonthKeyOf returns the calendar year/month that a moment falls in.
func MonthKeyOf(t time.Time, calendar string, loc *time.Location) (int, int) {
	p := Month(t, 0, calendar, loc)
	return p.Year, p.Month
}
