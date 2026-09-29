package api

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_.]{3,32}$`)
	colorRe    = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

func hashPassword(p string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	return string(h), err
}

// ---- current user ----

func (s *Server) getMe(c *gin.Context) {
	var channels []models.Channel
	s.db.Order("id").Find(&channels)
	var rules []models.RateRule
	s.db.Where("active = ?", true).Order("id").Find(&rules)
	c.JSON(http.StatusOK, gin.H{"user": me(c), "settings": s.settings(), "channels": channels, "rules": rules, "serverTime": time.Now()})
}

func (s *Server) updateMe(c *gin.Context) {
	u := me(c)
	var in struct {
		Avatar          *string `json:"avatar"`
		Color           *string `json:"color"`
		ChannelID       *uint   `json:"channelId"`
		CurrentPassword string  `json:"currentPassword"`
		NewPassword     string  `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	if in.Avatar != nil && len([]rune(*in.Avatar)) <= 8 {
		u.Avatar = *in.Avatar
	}
	if in.Color != nil && colorRe.MatchString(*in.Color) {
		u.Color = *in.Color
	}
	if in.ChannelID != nil && s.validChannel(in.ChannelID) {
		u.ChannelID = in.ChannelID
	}
	if in.NewPassword != "" {
		if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.CurrentPassword)) != nil {
			fail(c, http.StatusBadRequest, "رمز فعلی اشتباه است")
			return
		}
		if len(in.NewPassword) < 8 {
			fail(c, http.StatusBadRequest, "رمز جدید باید حداقل ۸ کاراکتر باشد")
			return
		}
		h, err := hashPassword(in.NewPassword)
		if err != nil {
			fail(c, http.StatusInternalServerError, "خطای داخلی")
			return
		}
		u.PasswordHash = h
	}
	s.db.Save(&u)
	c.JSON(http.StatusOK, u)
}

// ---- users ----

type userInput struct {
	Name             *string `json:"name"`
	Username         *string `json:"username"`
	Password         *string `json:"password"`
	Role             *string `json:"role"`
	HourlyRate       *int64  `json:"hourlyRate"`
	WeeklyGoalHours  *int    `json:"weeklyGoalHours"`
	MonthlyGoalHours *int    `json:"monthlyGoalHours"`
	Avatar           *string `json:"avatar"`
	Color            *string `json:"color"`
	ChannelID        *uint   `json:"channelId"`
	Active           *bool   `json:"active"`
}

func (in userInput) apply(u *models.User) string {
	if in.Name != nil {
		if n := strings.TrimSpace(*in.Name); n != "" {
			u.Name = n
		} else {
			return "نام را وارد کن"
		}
	}
	if in.Username != nil {
		un := strings.ToLower(strings.TrimSpace(*in.Username))
		if !usernameRe.MatchString(un) {
			return "نام کاربری باید ۳ تا ۳۲ حرف انگلیسی، عدد، نقطه یا _ باشد"
		}
		u.Username = un
	}
	if in.Password != nil && *in.Password != "" {
		if len(*in.Password) < 8 {
			return "رمز باید حداقل ۸ کاراکتر باشد"
		}
		h, err := hashPassword(*in.Password)
		if err != nil {
			return "خطای داخلی"
		}
		u.PasswordHash = h
	}
	if in.Role != nil {
		if *in.Role != models.RoleAdmin && *in.Role != models.RoleEmployee {
			return "نقش نامعتبر است"
		}
		u.Role = *in.Role
	}
	if in.HourlyRate != nil && *in.HourlyRate >= 0 {
		u.HourlyRate = *in.HourlyRate
	}
	if in.WeeklyGoalHours != nil && *in.WeeklyGoalHours >= 0 {
		u.WeeklyGoalHours = *in.WeeklyGoalHours
	}
	if in.MonthlyGoalHours != nil && *in.MonthlyGoalHours >= 0 {
		u.MonthlyGoalHours = *in.MonthlyGoalHours
	}
	if in.Avatar != nil {
		u.Avatar = *in.Avatar
	}
	if in.Color != nil && colorRe.MatchString(*in.Color) {
		u.Color = *in.Color
	}
	if in.ChannelID != nil {
		if *in.ChannelID == 0 {
			u.ChannelID = nil
		} else {
			u.ChannelID = in.ChannelID
		}
	}
	if in.Active != nil {
		u.Active = *in.Active
	}
	return ""
}

func (s *Server) listUsers(c *gin.Context) {
	var users []models.User
	s.db.Order("active desc, name").Find(&users)
	c.JSON(http.StatusOK, users)
}

func (s *Server) usernameTaken(username string, exceptID uint) bool {
	var n int64
	s.db.Model(&models.User{}).Where("lower(username) = ? AND id <> ?", username, exceptID).Count(&n)
	return n > 0
}

func (s *Server) createUser(c *gin.Context) {
	var in userInput
	if err := c.ShouldBindJSON(&in); err != nil || in.Name == nil || in.Username == nil || in.Password == nil {
		fail(c, http.StatusBadRequest, "نام، نام کاربری و رمز لازم است")
		return
	}
	u := models.User{Role: models.RoleEmployee, Avatar: "🙂", Color: "#a855f7", Active: true}
	if msg := in.apply(&u); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	if s.usernameTaken(u.Username, 0) {
		fail(c, http.StatusConflict, "این نام کاربری قبلاً گرفته شده")
		return
	}
	if err := s.db.Create(&u).Error; err != nil {
		fail(c, http.StatusInternalServerError, "خطای داخلی")
		return
	}
	c.JSON(http.StatusCreated, u)
}

func (s *Server) updateUser(c *gin.Context) {
	var u models.User
	if s.db.First(&u, idParam(c)).Error != nil {
		fail(c, http.StatusNotFound, "کاربر پیدا نشد")
		return
	}
	var in userInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	if u.ID == me(c).ID && ((in.Role != nil && *in.Role != models.RoleAdmin) || (in.Active != nil && !*in.Active)) {
		fail(c, http.StatusBadRequest, "نمی‌توانی دسترسی مدیریت خودت را برداری")
		return
	}
	if msg := in.apply(&u); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	if s.usernameTaken(u.Username, u.ID) {
		fail(c, http.StatusConflict, "این نام کاربری قبلاً گرفته شده")
		return
	}
	s.db.Save(&u)
	c.JSON(http.StatusOK, u)
}

// ---- channels ----

func (s *Server) createChannel(c *gin.Context) {
	var in models.Channel
	if err := c.ShouldBindJSON(&in); err != nil || strings.TrimSpace(in.Name) == "" {
		fail(c, http.StatusBadRequest, "نام تیم لازم است")
		return
	}
	ch := models.Channel{Name: strings.TrimSpace(in.Name), Color: in.Color, Active: true}
	if !colorRe.MatchString(ch.Color) {
		ch.Color = "#a855f7"
	}
	s.db.Create(&ch)
	c.JSON(http.StatusCreated, ch)
}

func (s *Server) updateChannel(c *gin.Context) {
	var ch models.Channel
	if s.db.First(&ch, idParam(c)).Error != nil {
		fail(c, http.StatusNotFound, "تیم پیدا نشد")
		return
	}
	var in struct {
		Name   *string `json:"name"`
		Color  *string `json:"color"`
		Active *bool   `json:"active"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		ch.Name = strings.TrimSpace(*in.Name)
	}
	if in.Color != nil && colorRe.MatchString(*in.Color) {
		ch.Color = *in.Color
	}
	if in.Active != nil {
		ch.Active = *in.Active
	}
	s.db.Save(&ch)
	c.JSON(http.StatusOK, ch)
}

// ---- rate rules ----

func validRule(r models.RateRule) string {
	if strings.TrimSpace(r.Name) == "" {
		return "نام قانون لازم است"
	}
	if r.StartMin < 0 || r.StartMin >= 1440 || r.EndMin < 0 || r.EndMin >= 1440 {
		return "بازه زمانی نامعتبر است"
	}
	if r.Multiplier < 1 || r.Multiplier > 5 {
		return "ضریب باید بین ۱ و ۵ باشد"
	}
	if r.Weekdays < 0 || r.Weekdays > 127 {
		return "روزهای هفته نامعتبر است"
	}
	return ""
}

func (s *Server) listRules(c *gin.Context) {
	var rs []models.RateRule
	s.db.Order("id").Find(&rs)
	c.JSON(http.StatusOK, rs)
}

func (s *Server) createRule(c *gin.Context) {
	var r models.RateRule
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	r.ID = 0
	if msg := validRule(r); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	s.db.Create(&r)
	c.JSON(http.StatusCreated, r)
}

func (s *Server) updateRule(c *gin.Context) {
	var r models.RateRule
	if s.db.First(&r, idParam(c)).Error != nil {
		fail(c, http.StatusNotFound, "قانون پیدا نشد")
		return
	}
	id := r.ID
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	r.ID = id
	if msg := validRule(r); msg != "" {
		fail(c, http.StatusBadRequest, msg)
		return
	}
	s.db.Save(&r)
	c.JSON(http.StatusOK, r)
}

func (s *Server) deleteRule(c *gin.Context) {
	s.db.Delete(&models.RateRule{}, idParam(c))
	c.Status(http.StatusNoContent)
}

// ---- settings ----

func (s *Server) updateSettings(c *gin.Context) {
	st := s.settings()
	logoVersion := st.LogoVersion
	if err := c.ShouldBindJSON(&st); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	st.ID, st.LogoVersion = 1, logoVersion // the logo changes only through its own endpoints
	if st.Calendar != models.CalendarJalali && st.Calendar != models.CalendarGregorian {
		fail(c, http.StatusBadRequest, "تقویم نامعتبر است")
		return
	}
	if _, err := time.LoadLocation(st.Timezone); err != nil {
		fail(c, http.StatusBadRequest, "منطقه زمانی نامعتبر است")
		return
	}
	if st.EditWindowDays < 0 || st.MaxShiftHours < 1 || st.MaxShiftHours > 24 {
		fail(c, http.StatusBadRequest, "مقادیر نامعتبر است")
		return
	}
	s.db.Save(&st)
	c.JSON(http.StatusOK, st)
}

// ---- adjustments ----

func (s *Server) listAdjustments(c *gin.Context) {
	var out []models.Adjustment
	q := s.db.Order("created_at desc")
	if y, m := queryInt(c, "year", 0), queryInt(c, "month", 0); y > 0 && m > 0 {
		q = q.Where("year = ? AND month = ?", y, m)
	}
	if uid := queryInt(c, "userId", 0); uid > 0 {
		q = q.Where("user_id = ?", uid)
	}
	q.Limit(500).Find(&out)
	c.JSON(http.StatusOK, out)
}

func (s *Server) createAdjustment(c *gin.Context) {
	var a models.Adjustment
	if err := c.ShouldBindJSON(&a); err != nil || a.UserID == 0 || a.Amount == 0 || a.Year == 0 || a.Month < 1 || a.Month > 12 {
		fail(c, http.StatusBadRequest, "کاربر، ماه و مبلغ لازم است")
		return
	}
	a.ID = 0
	a.Reason = strings.TrimSpace(a.Reason)
	s.db.Create(&a)
	c.JSON(http.StatusCreated, a)
}

func (s *Server) deleteAdjustment(c *gin.Context) {
	s.db.Delete(&models.Adjustment{}, idParam(c))
	c.Status(http.StatusNoContent)
}

// ---- approvals ----

func (s *Server) reviewShifts(c *gin.Context) {
	var in struct {
		IDs    []uint `json:"ids"`
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.IDs) == 0 ||
		(in.Status != models.StatusApproved && in.Status != models.StatusRejected && in.Status != models.StatusPending) {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	var reviewer *uint
	if in.Status != models.StatusPending {
		id := me(c).ID
		reviewer = &id
	}
	res := s.db.Model(&models.Shift{}).Where("id IN ? AND \"end\" IS NOT NULL", in.IDs).
		Updates(map[string]any{"status": in.Status, "review_note": strings.TrimSpace(in.Note), "reviewed_by_id": reviewer})
	c.JSON(http.StatusOK, gin.H{"updated": res.RowsAffected})
}
