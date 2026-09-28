package models

import "time"

const (
	RoleAdmin    = "admin"
	RoleEmployee = "employee"

	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusRejected = "rejected"

	CalendarGregorian = "gregorian"
	CalendarJalali    = "jalali"
)

type User struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	Name             string    `gorm:"size:100;not null" json:"name"`
	Username         string    `gorm:"size:50;uniqueIndex;not null" json:"username"`
	PasswordHash     string    `gorm:"not null" json:"-"`
	Role             string    `gorm:"size:20;not null" json:"role"`
	HourlyRate       int64     `gorm:"not null" json:"hourlyRate"` // in currency units per hour
	WeeklyGoalHours  int       `gorm:"not null" json:"weeklyGoalHours"`
	MonthlyGoalHours int       `gorm:"not null" json:"monthlyGoalHours"`
	Avatar           string    `gorm:"size:32" json:"avatar"`
	Color            string    `gorm:"size:16" json:"color"`
	ChannelID        *uint     `json:"channelId"` // default channel for new shifts
	Active           bool      `gorm:"not null" json:"active"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

func (u User) IsAdmin() bool { return u.Role == RoleAdmin }

// Channel is a place employees work, e.g. the website chat or Telegram.
type Channel struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	Name   string `gorm:"size:60;not null" json:"name"`
	Color  string `gorm:"size:16" json:"color"`
	Active bool   `gorm:"not null" json:"active"`
}

type Shift struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	UserID      uint       `gorm:"index;not null" json:"userId"`
	ChannelID   *uint      `json:"channelId"`
	Start       time.Time  `gorm:"index;not null" json:"start"`
	End         *time.Time `gorm:"index" json:"end"` // nil while clocked in
	Note        string     `gorm:"size:500" json:"note"`
	Status      string     `gorm:"size:20;index;not null" json:"status"`
	ReviewNote  string     `gorm:"size:300" json:"reviewNote"`
	CreatedByID uint       `json:"createdById"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// RateRule multiplies pay for minutes that fall in [StartMin, EndMin) of the
// local day. EndMin <= StartMin wraps past midnight; StartMin == EndMin covers
// the whole day. Weekdays is a bitmask of time.Weekday (0 = every day).
type RateRule struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	Name       string  `gorm:"size:60;not null" json:"name"`
	StartMin   int     `gorm:"not null" json:"startMin"`
	EndMin     int     `gorm:"not null" json:"endMin"`
	Weekdays   int     `gorm:"not null" json:"weekdays"`
	Multiplier float64 `gorm:"not null" json:"multiplier"`
	Active     bool    `gorm:"not null" json:"active"`
}

// Adjustment is a one-off bonus (positive) or deduction (negative) applied to
// a user's pay for a given month of the configured calendar.
type Adjustment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	Year      int       `gorm:"not null;index:idx_adj_period" json:"year"`
	Month     int       `gorm:"not null;index:idx_adj_period" json:"month"`
	Amount    int64     `gorm:"not null" json:"amount"`
	Reason    string    `gorm:"size:200" json:"reason"`
	CreatedAt time.Time `json:"createdAt"`
}

// Settings is a single-row table (ID = 1).
type Settings struct {
	ID              uint   `gorm:"primaryKey" json:"-"`
	CompanyName     string `gorm:"size:100" json:"companyName"`
	Calendar        string `gorm:"size:20" json:"calendar"`
	Timezone        string `gorm:"size:60" json:"timezone"`
	Currency        string `gorm:"size:20" json:"currency"`
	RequireApproval bool   `json:"requireApproval"`
	EditWindowDays  int    `json:"editWindowDays"` // how long employees may edit their own shifts
	MaxShiftHours   int    `json:"maxShiftHours"`
	ShowLeaderboard bool   `json:"showLeaderboard"`
	LogoVersion     int64  `json:"logoVersion"` // 0 = default logo; bumped on every upload for cache busting
}

// Asset stores small binary files (the company logo) in the database so they
// survive container redeploys and are included in database backups.
type Asset struct {
	Key         string `gorm:"primaryKey;size:40"`
	ContentType string `gorm:"size:40;not null"`
	Data        []byte `gorm:"not null"`
	UpdatedAt   time.Time
}
