package api

import (
	"encoding/csv"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Bazi-Digital/shift-app/backend/internal/calc"
	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

type dayRow struct {
	Date            string  `json:"date"`
	Minutes         int     `json:"minutes"`
	WeightedMinutes float64 `json:"weightedMinutes"`
	PendingMinutes  int     `json:"pendingMinutes"`
}

type summary struct {
	User             userBrief   `json:"user"`
	Period           calc.Period `json:"period"`
	Minutes          int         `json:"minutes"` // approved
	WeightedMinutes  float64     `json:"weightedMinutes"`
	BonusMinutes     int         `json:"bonusMinutes"`
	PendingMinutes   int         `json:"pendingMinutes"`
	PendingWeighted  float64     `json:"pendingWeightedMinutes"`
	ShiftCount       int         `json:"shiftCount"`
	HourlyRate       int64       `json:"hourlyRate"`
	BasePay          int64       `json:"basePay"`
	Adjustments      int64       `json:"adjustments"`
	Pay              int64       `json:"pay"`          // approved + adjustments
	EstimatedPay     int64       `json:"estimatedPay"` // including pending
	GoalMinutes      int         `json:"goalMinutes"`
	OpenShiftMinutes int         `json:"openShiftMinutes"`
	Streak           int         `json:"streak,omitempty"`
	Days             []dayRow    `json:"days,omitempty"`
}

func (s *Server) period(c *gin.Context, st models.Settings, loc *time.Location) calc.Period {
	offset := queryInt(c, "offset", 0)
	if c.Query("period") == "week" {
		return calc.Week(time.Now(), offset, loc)
	}
	if y, m := queryInt(c, "year", 0), queryInt(c, "month", 0); y > 0 && m >= 1 && m <= 12 {
		return calc.MonthOf(y, m, st.Calendar, loc)
	}
	return calc.Month(time.Now(), offset, st.Calendar, loc)
}

func (s *Server) summarize(u models.User, p calc.Period, loc *time.Location, rules []calc.Rule, withDays bool) summary {
	var shifts []models.Shift
	s.db.Where("user_id = ? AND status <> ? AND start < ? AND (\"end\" IS NULL OR \"end\" > ?)",
		u.ID, models.StatusRejected, p.End, p.Start).Find(&shifts)

	approved, pending := calc.NewTotals(), calc.NewTotals()
	out := summary{User: brief(u), Period: p, HourlyRate: u.HourlyRate}
	for _, sh := range shifts {
		if sh.End == nil {
			out.OpenShiftMinutes = int(time.Since(sh.Start).Minutes())
			continue
		}
		out.ShiftCount++
		if sh.Status == models.StatusApproved {
			approved.Add(sh.Start, *sh.End, p.Start, p.End, loc, rules)
		} else {
			pending.Add(sh.Start, *sh.End, p.Start, p.End, loc, rules)
		}
	}
	out.Minutes, out.WeightedMinutes, out.BonusMinutes = approved.Minutes, round2(approved.WeightedMinutes), approved.BonusMinutes
	out.PendingMinutes, out.PendingWeighted = pending.Minutes, round2(pending.WeightedMinutes)
	out.BasePay = calc.Pay(approved.WeightedMinutes, u.HourlyRate)

	if p.Kind == "month" {
		s.db.Model(&models.Adjustment{}).Where("user_id = ? AND year = ? AND month = ?", u.ID, p.Year, p.Month).
			Select("COALESCE(SUM(amount), 0)").Scan(&out.Adjustments)
		out.GoalMinutes = u.MonthlyGoalHours * 60
	} else {
		out.GoalMinutes = u.WeeklyGoalHours * 60
	}
	out.Pay = out.BasePay + out.Adjustments
	out.EstimatedPay = calc.Pay(approved.WeightedMinutes+pending.WeightedMinutes, u.HourlyRate) + out.Adjustments

	if withDays {
		for d := p.Start; d.Before(p.End); d = d.AddDate(0, 0, 1) {
			key := d.Format("2006-01-02")
			row := dayRow{Date: key}
			if a := approved.Days[key]; a != nil {
				row.Minutes, row.WeightedMinutes = a.Minutes, round2(a.WeightedMinutes)
			}
			if pd := pending.Days[key]; pd != nil {
				row.PendingMinutes = pd.Minutes
			}
			out.Days = append(out.Days, row)
		}
	}
	return out
}

func round2(f float64) float64 { return math.Round(f*100) / 100 }

// streak counts consecutive days with logged work, ending today (or yesterday
// if nothing has been logged yet today).
func (s *Server) streak(userID uint, loc *time.Location) int {
	now := time.Now().In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	from := today.AddDate(0, 0, -90)
	var shifts []models.Shift
	s.db.Where("user_id = ? AND status <> ? AND start >= ?", userID, models.StatusRejected, from.AddDate(0, 0, -1)).Find(&shifts)
	worked := map[string]bool{}
	for _, sh := range shifts {
		end := time.Now()
		if sh.End != nil {
			end = *sh.End
		}
		st := sh.Start.In(loc)
		for d := time.Date(st.Year(), st.Month(), st.Day(), 0, 0, 0, 0, loc); d.Before(end); d = d.AddDate(0, 0, 1) {
			worked[d.Format("2006-01-02")] = true
		}
	}
	d := today
	if !worked[d.Format("2006-01-02")] {
		d = d.AddDate(0, 0, -1)
	}
	n := 0
	for worked[d.Format("2006-01-02")] && !d.Before(from) {
		n++
		d = d.AddDate(0, 0, -1)
	}
	return n
}

func (s *Server) getSummary(c *gin.Context) {
	u := me(c)
	if uid := queryInt(c, "userId", 0); uid > 0 && u.IsAdmin() {
		var target models.User
		if s.db.First(&target, uid).Error != nil {
			fail(c, http.StatusNotFound, "کاربر پیدا نشد")
			return
		}
		u = target
	}
	st := s.settings()
	loc := s.location(st)
	out := s.summarize(u, s.period(c, st, loc), loc, s.rules(), true)
	out.Streak = s.streak(u.ID, loc)
	c.JSON(http.StatusOK, out)
}

func (s *Server) leaderboard(c *gin.Context) {
	u := me(c)
	st := s.settings()
	if !st.ShowLeaderboard && !u.IsAdmin() {
		c.JSON(http.StatusOK, []any{})
		return
	}
	loc := s.location(st)
	p := s.period(c, st, loc)
	rules := s.rules()
	var users []models.User
	s.db.Where("active = ? AND role = ?", true, models.RoleEmployee).Find(&users)
	type row struct {
		User        userBrief `json:"user"`
		Minutes     int       `json:"minutes"`
		GoalMinutes int       `json:"goalMinutes"`
	}
	rows := make([]row, 0, len(users))
	for _, eu := range users {
		sm := s.summarize(eu, p, loc, rules, false)
		rows = append(rows, row{sm.User, sm.Minutes + sm.PendingMinutes, sm.GoalMinutes})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Minutes > rows[j].Minutes })
	c.JSON(http.StatusOK, rows)
}

func (s *Server) reportRows(c *gin.Context) (calc.Period, []summary) {
	st := s.settings()
	loc := s.location(st)
	p := s.period(c, st, loc)
	rules := s.rules()
	var users []models.User
	s.db.Order("active desc, name").Find(&users)
	rows := make([]summary, 0, len(users))
	for _, u := range users {
		sm := s.summarize(u, p, loc, rules, false)
		if (!u.Active || u.IsAdmin()) && sm.ShiftCount == 0 && sm.Adjustments == 0 {
			continue
		}
		rows = append(rows, sm)
	}
	return p, rows
}

func (s *Server) report(c *gin.Context) {
	p, rows := s.reportRows(c)
	c.JSON(http.StatusOK, gin.H{"period": p, "rows": rows})
}

func (s *Server) reportCSV(c *gin.Context) {
	p, rows := s.reportRows(c)
	name := fmt.Sprintf("report-%s-%s.csv", p.Kind, p.Start.Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+name+`"`)
	_, _ = c.Writer.Write([]byte("\xEF\xBB\xBF")) // BOM so Excel reads UTF-8 Persian text
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"نام", "ساعت تایید شده", "ساعت با ضریب", "ساعت اضافه‌کاری ضریب‌دار", "ساعت در انتظار", "نرخ ساعتی", "حقوق پایه", "پاداش/کسر", "جمع پرداختی", "هدف (ساعت)"})
	h := func(m float64) string { return strconv.FormatFloat(m/60, 'f', 2, 64) }
	for _, r := range rows {
		_ = w.Write([]string{r.User.Name, h(float64(r.Minutes)), h(r.WeightedMinutes), h(float64(r.BonusMinutes)),
			h(float64(r.PendingMinutes)), strconv.FormatInt(r.HourlyRate, 10), strconv.FormatInt(r.BasePay, 10),
			strconv.FormatInt(r.Adjustments, 10), strconv.FormatInt(r.Pay, 10), strconv.Itoa(r.GoalMinutes / 60)})
	}
	w.Flush()
}

// live returns everyone currently clocked in plus the number of shifts awaiting review.
func (s *Server) live(c *gin.Context) {
	var open []models.Shift
	s.db.Where("\"end\" IS NULL").Order("start").Find(&open)
	users := s.userMap()
	type item struct {
		User      userBrief `json:"user"`
		ShiftID   uint      `json:"shiftId"`
		ChannelID *uint     `json:"channelId"`
		Start     time.Time `json:"start"`
	}
	items := make([]item, 0, len(open))
	for _, sh := range open {
		items = append(items, item{brief(users[sh.UserID]), sh.ID, sh.ChannelID, sh.Start})
	}
	var pending int64
	s.db.Model(&models.Shift{}).Where("status = ? AND \"end\" IS NOT NULL", models.StatusPending).Count(&pending)
	c.JSON(http.StatusOK, gin.H{"online": items, "pendingCount": pending})
}
