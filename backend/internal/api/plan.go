package api

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

// ---- recurring plans (admin) ----

func (s *Server) validPlan(p models.Plan) string {
	var n int64
	s.db.Model(&models.User{}).Where("id = ?", p.UserID).Count(&n)
	if n == 0 {
		return "کارمند را انتخاب کن"
	}
	if p.StartMin < 0 || p.StartMin >= 1440 || p.EndMin < 0 || p.EndMin >= 1440 || p.StartMin == p.EndMin {
		return "بازه زمانی نامعتبر است"
	}
	if p.Weekdays < 0 || p.Weekdays > 127 {
		return "روزهای هفته نامعتبر است"
	}
	if !s.validChannel(p.ChannelID) {
		return "تیم نامعتبر است"
	}
	return ""
}

func (s *Server) listPlans(c *gin.Context) {
	var ps []models.Plan
	s.db.Order("start_min, id").Find(&ps)
	c.JSON(http.StatusOK, ps)
}

func (s *Server) createPlan(c *gin.Context) {
	var p models.Plan
	if err := c.ShouldBindJSON(&p); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	p.ID = 0
	if msg := s.validPlan(p); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	s.db.Create(&p)
	c.JSON(http.StatusCreated, p)
}

func (s *Server) updatePlan(c *gin.Context) {
	var p models.Plan
	if s.db.First(&p, idParam(c)).Error != nil {
		fail(c, http.StatusNotFound, "برنامه پیدا نشد")
		return
	}
	id, created := p.ID, p.CreatedAt
	if err := c.ShouldBindJSON(&p); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	p.ID, p.CreatedAt = id, created
	if msg := s.validPlan(p); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	s.db.Save(&p)
	c.JSON(http.StatusOK, p)
}

func (s *Server) deletePlan(c *gin.Context) {
	id := idParam(c)
	s.db.Where("plan_id = ?", id).Delete(&models.CoverRequest{})
	s.db.Delete(&models.Plan{}, id)
	c.Status(http.StatusNoContent)
}

// ---- upcoming plan with cover requests (everyone) ----

func planOn(p models.Plan, day time.Time) bool {
	return p.Active && (p.Weekdays == 0 || p.Weekdays&(1<<uint(day.Weekday())) != 0)
}

// planRange is the planned shift of p that starts on the local day.
func planRange(p models.Plan, day time.Time) (time.Time, time.Time) {
	endDay := day
	if p.EndMin <= p.StartMin {
		endDay = day.AddDate(0, 0, 1)
	}
	return atMinute(day, p.StartMin), atMinute(endDay, p.EndMin)
}

type coverView struct {
	ID        uint       `json:"id"`
	Status    string     `json:"status"`
	Note      string     `json:"note"`
	Requester userBrief  `json:"requester"`
	Target    *userBrief `json:"target"`
	Cover     *userBrief `json:"cover"`
}

type planItem struct {
	PlanID    uint       `json:"planId"`
	Date      string     `json:"date"`
	StartTime string     `json:"startTime"`
	EndTime   string     `json:"endTime"`
	Minutes   int        `json:"minutes"`
	ChannelID *uint      `json:"channelId"`
	Owner     userBrief  `json:"owner"`
	Assignee  userBrief  `json:"assignee"` // the owner, or whoever is covering
	Logged    bool       `json:"logged"`   // the assignee has logged a shift at that time
	Request   *coverView `json:"request"`
}

func (s *Server) getPlan(c *gin.Context) {
	st := s.settings()
	loc := s.location(st)
	from, err := parseDate(c.Query("from"), loc)
	if err != nil {
		now := time.Now().In(loc)
		from = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	}
	days := queryInt(c, "days", 14)
	if days < 1 || days > 62 {
		days = 14
	}
	to := from.AddDate(0, 0, days)

	var plans []models.Plan
	s.db.Where("active = ?", true).Order("start_min, id").Find(&plans)
	var reqs []models.CoverRequest
	s.db.Where("date >= ? AND date < ? AND status <> ?", from.Format("2006-01-02"), to.Format("2006-01-02"), models.CoverCancelled).
		Order("id").Find(&reqs)
	latest := map[string]models.CoverRequest{}
	for _, r := range reqs {
		latest[coverKey(r.PlanID, r.Date)] = r // later requests replace declined ones
	}
	var shifts []models.Shift
	s.db.Where("status <> ? AND start < ? AND (\"end\" IS NULL OR \"end\" > ?)", models.StatusRejected, to.AddDate(0, 0, 1), from).Find(&shifts)
	users := s.userMap()
	now := time.Now()

	briefOf := func(id *uint) *userBrief {
		if id == nil {
			return nil
		}
		b := brief(users[*id])
		return &b
	}
	items := []planItem{}
	for d := from; d.Before(to); d = d.AddDate(0, 0, 1) {
		date := d.Format("2006-01-02")
		for _, p := range plans {
			owner, ok := users[p.UserID]
			if !ok || !owner.Active || !planOn(p, d) {
				continue
			}
			start, end := planRange(p, d)
			it := planItem{PlanID: p.ID, Date: date, StartTime: start.In(loc).Format("15:04"), EndTime: end.In(loc).Format("15:04"),
				Minutes: int(end.Sub(start).Minutes()), ChannelID: p.ChannelID, Owner: brief(owner), Assignee: brief(owner)}
			assignee := p.UserID
			if r, ok := latest[coverKey(p.ID, date)]; ok {
				it.Request = &coverView{ID: r.ID, Status: r.Status, Note: r.Note, Requester: brief(users[r.RequesterID]),
					Target: briefOf(r.TargetID), Cover: briefOf(r.CoverID)}
				if r.Status == models.CoverCovered && r.CoverID != nil {
					assignee = *r.CoverID
					it.Assignee = brief(users[assignee])
				}
			}
			for _, sh := range shifts {
				if sh.UserID == assignee && sh.Start.Before(end) && shiftEnd(sh, now).After(start) {
					it.Logged = true
					break
				}
			}
			items = append(items, it)
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Date != items[j].Date {
			return items[i].Date < items[j].Date
		}
		return items[i].StartTime < items[j].StartTime
	})
	c.JSON(http.StatusOK, gin.H{"from": from.Format("2006-01-02"), "days": days, "items": items})
}

func coverKey(planID uint, date string) string { return date + "#" + jwtSubject(planID) }

// ---- cover requests ----

// teammates lists active people by name only, so anyone can pick who to ask for cover.
func (s *Server) teammates(c *gin.Context) {
	var users []models.User
	s.db.Where("active = ?", true).Order("name").Find(&users)
	out := make([]userBrief, 0, len(users))
	for _, u := range users {
		out = append(out, brief(u))
	}
	c.JSON(http.StatusOK, out)
}

func (s *Server) activeUser(id *uint) bool {
	if id == nil {
		return true
	}
	var n int64
	s.db.Model(&models.User{}).Where("id = ? AND active = ?", *id, true).Count(&n)
	return n > 0
}

func (s *Server) today(loc *time.Location) time.Time {
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
}

func (s *Server) requestCover(c *gin.Context) {
	u := me(c)
	loc := s.location(s.settings())
	var in struct {
		PlanID   uint   `json:"planId"`
		Date     string `json:"date"`
		TargetID *uint  `json:"targetId"`
		CoverID  *uint  `json:"coverId"` // admin only: assign directly
		Note     string `json:"note"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	var p models.Plan
	if s.db.First(&p, in.PlanID).Error != nil {
		fail(c, http.StatusNotFound, "برنامه پیدا نشد")
		return
	}
	day, err := parseDate(in.Date, loc)
	if err != nil || !planOn(p, day) {
		fail(c, http.StatusBadRequest, "این روز در برنامه نیست")
		return
	}
	if !u.IsAdmin() && p.UserID != u.ID {
		fail(c, http.StatusForbidden, "فقط برای شیفت‌های خودت می‌توانی جایگزین بخواهی")
		return
	}
	if day.Before(s.today(loc)) {
		fail(c, http.StatusBadRequest, "این روز گذشته است")
		return
	}
	for _, id := range []*uint{in.TargetID, in.CoverID} {
		if id != nil && (*id == p.UserID || !s.activeUser(id)) {
			fail(c, http.StatusBadRequest, "جایگزین نامعتبر است")
			return
		}
	}
	var n int64
	s.db.Model(&models.CoverRequest{}).Where("plan_id = ? AND date = ? AND status IN ?", p.ID, in.Date,
		[]string{models.CoverOpen, models.CoverCovered}).Count(&n)
	if n > 0 {
		fail(c, http.StatusConflict, "برای این شیفت قبلاً درخواست ثبت شده")
		return
	}
	r := models.CoverRequest{PlanID: p.ID, Date: in.Date, RequesterID: u.ID, TargetID: in.TargetID,
		Status: models.CoverOpen, Note: strings.TrimSpace(in.Note)}
	if u.IsAdmin() && in.CoverID != nil {
		r.CoverID, r.TargetID, r.Status = in.CoverID, nil, models.CoverCovered
	}
	s.db.Create(&r)
	c.JSON(http.StatusCreated, r)
}

// coverAction loads a request and its plan for the accept/decline/cancel endpoints.
func (s *Server) coverAction(c *gin.Context) (models.CoverRequest, models.Plan, bool) {
	var r models.CoverRequest
	var p models.Plan
	if s.db.First(&r, idParam(c)).Error != nil || s.db.First(&p, r.PlanID).Error != nil {
		fail(c, http.StatusNotFound, "درخواست پیدا نشد")
		return r, p, false
	}
	return r, p, true
}

func (s *Server) acceptCover(c *gin.Context) {
	u := me(c)
	r, p, ok := s.coverAction(c)
	if !ok {
		return
	}
	if r.Status != models.CoverOpen {
		fail(c, http.StatusConflict, "این درخواست دیگر باز نیست")
		return
	}
	if p.UserID == u.ID || (r.TargetID != nil && *r.TargetID != u.ID) {
		fail(c, http.StatusForbidden, "این درخواست برای تو نیست")
		return
	}
	if day, _ := parseDate(r.Date, s.location(s.settings())); day.Before(s.today(day.Location())) {
		fail(c, http.StatusBadRequest, "این روز گذشته است")
		return
	}
	// Conditional update so two people accepting at once can't both win.
	res := s.db.Model(&models.CoverRequest{}).Where("id = ? AND status = ?", r.ID, models.CoverOpen).
		Updates(map[string]any{"status": models.CoverCovered, "cover_id": u.ID})
	if res.RowsAffected == 0 {
		fail(c, http.StatusConflict, "یکی دیگر زودتر قبول کرد")
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *Server) declineCover(c *gin.Context) {
	u := me(c)
	r, _, ok := s.coverAction(c)
	if !ok {
		return
	}
	if r.Status != models.CoverOpen || r.TargetID == nil || *r.TargetID != u.ID {
		fail(c, http.StatusForbidden, "این درخواست برای تو نیست")
		return
	}
	s.db.Model(&r).Update("status", models.CoverDeclined)
	c.Status(http.StatusNoContent)
}

// cancelCover lets the plan owner or an admin call the request off, and the
// person covering back out, which reopens it for everyone.
func (s *Server) cancelCover(c *gin.Context) {
	u := me(c)
	r, p, ok := s.coverAction(c)
	if !ok {
		return
	}
	switch {
	case u.IsAdmin() || p.UserID == u.ID || r.RequesterID == u.ID:
		s.db.Model(&r).Update("status", models.CoverCancelled)
	case r.Status == models.CoverCovered && r.CoverID != nil && *r.CoverID == u.ID:
		s.db.Model(&r).Updates(map[string]any{"status": models.CoverOpen, "cover_id": nil, "target_id": nil})
	default:
		fail(c, http.StatusForbidden, "اجازه این کار را نداری")
		return
	}
	c.Status(http.StatusNoContent)
}
