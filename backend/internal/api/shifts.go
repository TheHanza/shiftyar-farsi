package api

import (
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/Bazi-Digital/shift-app/backend/internal/calc"
	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

// shiftView is a shift enriched with local-time fields for display.
type shiftView struct {
	models.Shift
	Date            string     `json:"date"`
	StartTime       string     `json:"startTime"`
	EndTime         string     `json:"endTime"`
	Minutes         int        `json:"minutes"`
	WeightedMinutes float64    `json:"weightedMinutes"`
	BonusMinutes    int        `json:"bonusMinutes"`
	Editable        bool       `json:"editable"`
	User            *userBrief `json:"user,omitempty"`
	Overlaps        []overlap  `json:"overlaps,omitempty"`
}

// overlap is a teammate's shift on the same team that runs at the same time.
type overlap struct {
	ShiftID   uint      `json:"shiftId"`
	User      userBrief `json:"user"`
	StartTime string    `json:"startTime"`
	EndTime   string    `json:"endTime"`
	Minutes   int       `json:"minutes"`
}

// overlapGrace ignores short hand-over overlaps between consecutive shifts.
const overlapGrace = 15 * time.Minute

func (s *Server) view(sh models.Shift, st models.Settings, loc *time.Location, rules []calc.Rule, viewer models.User) shiftView {
	v := shiftView{Shift: sh, Date: sh.Start.In(loc).Format("2006-01-02"), StartTime: sh.Start.In(loc).Format("15:04")}
	if sh.End != nil {
		v.EndTime = sh.End.In(loc).Format("15:04")
		t := calc.NewTotals()
		t.Add(sh.Start, *sh.End, sh.Start, *sh.End, loc, rules)
		v.Minutes, v.WeightedMinutes, v.BonusMinutes = t.Minutes, round2(t.WeightedMinutes), t.BonusMinutes
	}
	v.Editable = s.canModify(viewer, sh, st) == nil
	return v
}

func (s *Server) rules() []calc.Rule {
	var rs []models.RateRule
	s.db.Find(&rs)
	return calc.RulesFrom(rs)
}

var (
	errNotYours     = errors.New("این شیفت مال تو نیست")
	errApproved     = errors.New("شیفت تایید شده را فقط مدیر می‌تواند تغییر دهد")
	errWindowClosed = errors.New("مهلت ویرایش این شیفت تمام شده است")
)

func (s *Server) canModify(u models.User, sh models.Shift, st models.Settings) error {
	if u.IsAdmin() {
		return nil
	}
	if sh.UserID != u.ID {
		return errNotYours
	}
	if sh.Status == models.StatusApproved && (st.RequireApproval || sh.ReviewedByID != nil || sh.CreatedByID != sh.UserID) {
		// Shifts that were auto-approved (approval turned off) stay editable.
		return errApproved
	}
	if st.EditWindowDays > 0 && time.Since(sh.Start) > time.Duration(st.EditWindowDays)*24*time.Hour {
		return errWindowClosed
	}
	return nil
}

func (s *Server) listShifts(c *gin.Context) {
	u := me(c)
	st := s.settings()
	loc := s.location(st)
	q := s.db.Order("start desc")

	if u.IsAdmin() {
		if uid := queryInt(c, "userId", 0); uid > 0 {
			q = q.Where("user_id = ?", uid)
		}
		if status := c.Query("status"); status != "" {
			q = q.Where("status = ?", status)
		}
	} else {
		q = q.Where("user_id = ?", u.ID)
	}
	if from, err := parseDate(c.Query("from"), loc); err == nil {
		q = q.Where("start >= ?", from)
	}
	if to, err := parseDate(c.Query("to"), loc); err == nil {
		q = q.Where("start < ?", to.AddDate(0, 0, 1))
	}
	limit := queryInt(c, "limit", 200)
	if limit <= 0 || limit > 1000 {
		limit = 200
	}

	var shifts []models.Shift
	if err := q.Limit(limit).Find(&shifts).Error; err != nil {
		fail(c, http.StatusInternalServerError, "خطای داخلی")
		return
	}
	users := s.userMap()
	rules := s.rules()
	overlaps := s.overlapsOf(shifts, users, loc)
	out := make([]shiftView, 0, len(shifts))
	for _, sh := range shifts {
		v := s.view(sh, st, loc, rules, u)
		if ou, ok := users[sh.UserID]; ok {
			b := brief(ou)
			v.User = &b
		}
		v.Overlaps = overlaps[sh.ID]
		out = append(out, v)
	}
	c.JSON(http.StatusOK, out)
}

func shiftEnd(sh models.Shift, now time.Time) time.Time {
	if sh.End != nil {
		return *sh.End
	}
	return now
}

func sameTeam(a, b *uint) bool { return a == nil || b == nil || *a == *b }

// overlapMinutes is how long two shifts of different people on the same team
// ran at the same time, or 0 when that is within the hand-over grace.
func overlapMinutes(a, b models.Shift, now time.Time) int {
	if a.UserID == b.UserID || a.Status == models.StatusRejected || b.Status == models.StatusRejected || !sameTeam(a.ChannelID, b.ChannelID) {
		return 0
	}
	from, to := a.Start, shiftEnd(a, now)
	if b.Start.After(from) {
		from = b.Start
	}
	if e := shiftEnd(b, now); e.Before(to) {
		to = e
	}
	if to.Sub(from) < overlapGrace {
		return 0
	}
	return int(to.Sub(from).Minutes())
}

// overlapsOf finds, for each shift, teammates' shifts that ran at the same time.
func (s *Server) overlapsOf(shifts []models.Shift, users map[uint]models.User, loc *time.Location) map[uint][]overlap {
	out := map[uint][]overlap{}
	if len(shifts) == 0 {
		return out
	}
	now := time.Now()
	from, to := shifts[0].Start, shiftEnd(shifts[0], now)
	for _, sh := range shifts {
		if sh.Start.Before(from) {
			from = sh.Start
		}
		if e := shiftEnd(sh, now); e.After(to) {
			to = e
		}
	}
	var others []models.Shift
	s.db.Where("status <> ? AND start < ? AND (\"end\" IS NULL OR \"end\" > ?)", models.StatusRejected, to, from).Find(&others)
	for _, sh := range shifts {
		for _, o := range others {
			if m := overlapMinutes(sh, o, now); m > 0 {
				ov := overlap{ShiftID: o.ID, User: brief(users[o.UserID]), StartTime: o.Start.In(loc).Format("15:04"), Minutes: m}
				if o.End != nil {
					ov.EndTime = o.End.In(loc).Format("15:04")
				}
				out[sh.ID] = append(out[sh.ID], ov)
			}
		}
	}
	return out
}

// flagOverlaps sends a shift that ran at the same time as a teammate's on the
// same team to the approval queue, together with the teammate's shifts that no
// admin has reviewed yet, so an admin decides who actually worked.
func (s *Server) flagOverlaps(sh *models.Shift, st models.Settings) {
	if sh.End == nil || !st.FlagOverlaps {
		return // checked again on clock-out
	}
	var others []models.Shift
	s.db.Where("user_id <> ? AND status <> ? AND start < ? AND (\"end\" IS NULL OR \"end\" > ?)",
		sh.UserID, models.StatusRejected, *sh.End, sh.Start).Find(&others)
	now := time.Now()
	var reopen []uint
	for _, o := range others {
		if overlapMinutes(*sh, o, now) == 0 {
			continue
		}
		sh.Status = models.StatusPending
		if o.Status == models.StatusApproved && o.ReviewedByID == nil && o.CreatedByID == o.UserID {
			reopen = append(reopen, o.ID)
		}
	}
	if len(reopen) > 0 {
		s.db.Model(&models.Shift{}).Where("id IN ?", reopen).Update("status", models.StatusPending)
	}
}

func (s *Server) userMap() map[uint]models.User {
	var users []models.User
	s.db.Find(&users)
	m := make(map[uint]models.User, len(users))
	for _, u := range users {
		m[u.ID] = u
	}
	return m
}

type shiftInput struct {
	UserID    uint   `json:"userId"`
	Date      string `json:"date"`
	Start     string `json:"start"`
	End       string `json:"end"`
	ChannelID *uint  `json:"channelId"`
	Note      string `json:"note"`
}

// resolve turns a date plus HH:MM times into a time range; an end at or
// before the start means the shift ran past midnight.
func (in shiftInput) resolve(loc *time.Location) (time.Time, time.Time, error) {
	day, err := parseDate(in.Date, loc)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("تاریخ نامعتبر است")
	}
	sm, err1 := parseHM(in.Start)
	em, err2 := parseHM(in.End)
	if err1 != nil || err2 != nil {
		return time.Time{}, time.Time{}, errors.New("ساعت نامعتبر است")
	}
	start := atMinute(day, sm)
	endDay := day
	if em <= sm {
		endDay = day.AddDate(0, 0, 1)
	}
	return start, atMinute(endDay, em), nil
}

func (s *Server) validateRange(u models.User, userID uint, start, end time.Time, st models.Settings, excludeID uint) error {
	if !end.After(start) {
		return errors.New("پایان شیفت باید بعد از شروع باشد")
	}
	if st.MaxShiftHours > 0 && end.Sub(start) > time.Duration(st.MaxShiftHours)*time.Hour {
		return errors.New("شیفت از حداکثر مجاز طولانی‌تر است")
	}
	if !u.IsAdmin() {
		if end.After(time.Now().Add(10 * time.Minute)) {
			return errors.New("نمی‌شود ساعت‌های آینده را ثبت کرد")
		}
		if st.EditWindowDays > 0 && time.Since(start) > time.Duration(st.EditWindowDays)*24*time.Hour {
			return errWindowClosed
		}
	}
	var n int64
	q := s.db.Model(&models.Shift{}).
		Where("user_id = ? AND status <> ? AND start < ? AND (\"end\" IS NULL OR \"end\" > ?)", userID, models.StatusRejected, end, start)
	if excludeID != 0 {
		q = q.Where("id <> ?", excludeID)
	}
	q.Count(&n)
	if n > 0 {
		return errors.New("این بازه با یک شیفت دیگرت تداخل دارد")
	}
	return nil
}

func (s *Server) validChannel(id *uint) bool {
	if id == nil {
		return true
	}
	var n int64
	s.db.Model(&models.Channel{}).Where("id = ?", *id).Count(&n)
	return n > 0
}

func (s *Server) createShift(c *gin.Context) {
	u := me(c)
	st := s.settings()
	loc := s.location(st)
	var in shiftInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	userID := u.ID
	if u.IsAdmin() && in.UserID != 0 {
		userID = in.UserID
	}
	start, end, err := in.resolve(loc)
	if err == nil {
		err = s.validateRange(u, userID, start, end, st, 0)
	}
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if !s.validChannel(in.ChannelID) {
		fail(c, http.StatusBadRequest, "تیم نامعتبر است")
		return
	}
	status := models.StatusApproved
	if !u.IsAdmin() && st.RequireApproval {
		status = models.StatusPending
	}
	sh := models.Shift{UserID: userID, ChannelID: in.ChannelID, Start: start, End: &end,
		Note: strings.TrimSpace(in.Note), Status: status, CreatedByID: u.ID}
	if u.IsAdmin() {
		sh.ReviewedByID = &u.ID
	} else {
		s.flagOverlaps(&sh, st)
	}
	if err := s.db.Create(&sh).Error; err != nil {
		fail(c, http.StatusInternalServerError, "خطای داخلی")
		return
	}
	c.JSON(http.StatusCreated, s.view(sh, st, loc, s.rules(), u))
}

func (s *Server) updateShift(c *gin.Context) {
	u := me(c)
	st := s.settings()
	loc := s.location(st)
	var sh models.Shift
	if s.db.First(&sh, idParam(c)).Error != nil {
		fail(c, http.StatusNotFound, "شیفت پیدا نشد")
		return
	}
	if err := s.canModify(u, sh, st); err != nil {
		fail(c, http.StatusForbidden, err.Error())
		return
	}
	if sh.End == nil {
		fail(c, http.StatusBadRequest, "اول شیفت در حال اجرا را تمام کن")
		return
	}
	var in shiftInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	start, end, err := in.resolve(loc)
	if err == nil {
		err = s.validateRange(u, sh.UserID, start, end, st, sh.ID)
	}
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if !s.validChannel(in.ChannelID) {
		fail(c, http.StatusBadRequest, "تیم نامعتبر است")
		return
	}
	sh.Start, sh.End, sh.ChannelID, sh.Note = start, &end, in.ChannelID, strings.TrimSpace(in.Note)
	if !u.IsAdmin() {
		if st.RequireApproval || sh.Status == models.StatusRejected {
			sh.Status, sh.ReviewNote = models.StatusPending, ""
		} else {
			sh.Status = models.StatusApproved
		}
		s.flagOverlaps(&sh, st)
	}
	s.db.Save(&sh)
	c.JSON(http.StatusOK, s.view(sh, st, loc, s.rules(), u))
}

func (s *Server) deleteShift(c *gin.Context) {
	u := me(c)
	var sh models.Shift
	if s.db.First(&sh, idParam(c)).Error != nil {
		fail(c, http.StatusNotFound, "شیفت پیدا نشد")
		return
	}
	if err := s.canModify(u, sh, s.settings()); err != nil {
		fail(c, http.StatusForbidden, err.Error())
		return
	}
	s.db.Delete(&sh)
	c.Status(http.StatusNoContent)
}

func (s *Server) openShift(userID uint) (*models.Shift, error) {
	var sh models.Shift
	err := s.db.Where("user_id = ? AND \"end\" IS NULL", userID).First(&sh).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &sh, err
}

func (s *Server) activeShift(c *gin.Context) {
	u := me(c)
	sh, _ := s.openShift(u.ID)
	if sh == nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	st := s.settings()
	c.JSON(http.StatusOK, s.view(*sh, st, s.location(st), nil, u))
}

func (s *Server) clockIn(c *gin.Context) {
	u := me(c)
	var in struct {
		ChannelID *uint `json:"channelId"`
	}
	_ = c.ShouldBindJSON(&in)
	if sh, _ := s.openShift(u.ID); sh != nil {
		fail(c, http.StatusConflict, "الان هم در حال کار هستی")
		return
	}
	if !s.validChannel(in.ChannelID) {
		fail(c, http.StatusBadRequest, "تیم نامعتبر است")
		return
	}
	now := time.Now().Truncate(time.Minute)
	var n int64
	s.db.Model(&models.Shift{}).Where("user_id = ? AND status <> ? AND \"end\" > ?", u.ID, models.StatusRejected, now).Count(&n)
	if n > 0 {
		fail(c, http.StatusBadRequest, "برای همین الان یک شیفت ثبت کرده‌ای")
		return
	}
	st := s.settings()
	status := models.StatusApproved
	if st.RequireApproval && !u.IsAdmin() {
		status = models.StatusPending
	}
	sh := models.Shift{UserID: u.ID, ChannelID: in.ChannelID, Start: now, Status: status, CreatedByID: u.ID}
	s.db.Create(&sh)
	c.JSON(http.StatusCreated, s.view(sh, st, s.location(st), nil, u))
}

func (s *Server) clockOut(c *gin.Context) {
	u := me(c)
	var in struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&in)
	sh, _ := s.openShift(u.ID)
	if sh == nil {
		fail(c, http.StatusBadRequest, "شیفت فعالی نداری")
		return
	}
	st := s.settings()
	end := time.Now().Truncate(time.Minute)
	if st.MaxShiftHours > 0 && end.Sub(sh.Start) > time.Duration(st.MaxShiftHours)*time.Hour {
		// Forgotten clock-outs are capped and flagged for the admin.
		end = sh.Start.Add(time.Duration(st.MaxShiftHours) * time.Hour)
		sh.Status = models.StatusPending
		sh.ReviewNote = "خروج فراموش شده؛ به حداکثر مجاز محدود شد"
	}
	if !end.After(sh.Start) {
		s.db.Delete(sh) // clocked out within the same minute: nothing to keep
		c.JSON(http.StatusOK, nil)
		return
	}
	sh.End = &end
	if n := strings.TrimSpace(in.Note); n != "" {
		sh.Note = n
	}
	if !u.IsAdmin() {
		s.flagOverlaps(sh, st)
	}
	s.db.Save(sh)
	c.JSON(http.StatusOK, s.view(*sh, st, s.location(st), s.rules(), u))
}

type coverageItem struct {
	ShiftID   uint      `json:"shiftId"`
	User      userBrief `json:"user"`
	ChannelID *uint     `json:"channelId"`
	StartMin  int       `json:"startMin"`
	EndMin    int       `json:"endMin"`
	Open      bool      `json:"open"`
	Status    string    `json:"status"`
}

// coverage lists who worked (or is working) during a local day, clipped to it,
// the digital version of the team's old half-hour grid.
func (s *Server) coverage(c *gin.Context) {
	st := s.settings()
	loc := s.location(st)
	day, err := parseDate(c.Query("date"), loc)
	if err != nil {
		now := time.Now().In(loc)
		day = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	}
	next := day.AddDate(0, 0, 1)
	var shifts []models.Shift
	s.db.Where("status <> ? AND start < ? AND (\"end\" IS NULL OR \"end\" > ?)", models.StatusRejected, next, day).Find(&shifts)
	users := s.userMap()
	now := time.Now()
	items := make([]coverageItem, 0, len(shifts))
	for _, sh := range shifts {
		end := now
		if sh.End != nil {
			end = *sh.End
		}
		a, b := sh.Start, end
		if a.Before(day) {
			a = day
		}
		if b.After(next) {
			b = next
		}
		if !b.After(a) {
			continue
		}
		items = append(items, coverageItem{
			ShiftID: sh.ID, User: brief(users[sh.UserID]), ChannelID: sh.ChannelID, Status: sh.Status,
			StartMin: int(a.Sub(day).Minutes()), EndMin: int(b.Sub(day).Minutes()), Open: sh.End == nil,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].StartMin < items[j].StartMin })
	c.JSON(http.StatusOK, gin.H{"date": day.Format("2006-01-02"), "items": items})
}
