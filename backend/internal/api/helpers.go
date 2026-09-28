package api

import (
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

func fail(c *gin.Context, status int, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"error": msg})
}

func me(c *gin.Context) models.User {
	u, _ := c.Get("user")
	return u.(models.User)
}

func jwtSubject(id uint) string { return strconv.FormatUint(uint64(id), 10) }

func parseSubject(sub string) uint {
	n, _ := strconv.ParseUint(sub, 10, 64)
	return uint(n)
}

func idParam(c *gin.Context) uint {
	n, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	return uint(n)
}

func queryInt(c *gin.Context, key string, def int) int {
	if n, err := strconv.Atoi(c.Query(key)); err == nil {
		return n
	}
	return def
}

var hmRe = regexp.MustCompile(`^([01]?\d|2[0-3]):([0-5]\d)$`)

// parseHM parses "HH:MM" into minutes since midnight.
func parseHM(s string) (int, error) {
	m := hmRe.FindStringSubmatch(s)
	if m == nil {
		return 0, fmt.Errorf("invalid time %q", s)
	}
	h, _ := strconv.Atoi(m[1])
	mi, _ := strconv.Atoi(m[2])
	return h*60 + mi, nil
}

func parseDate(s string, loc *time.Location) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", s, loc)
}

func atMinute(day time.Time, minutes int) time.Time {
	return time.Date(day.Year(), day.Month(), day.Day(), minutes/60, minutes%60, 0, 0, day.Location())
}

type userBrief struct {
	ID     uint   `json:"id"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
	Color  string `json:"color"`
}

func brief(u models.User) userBrief {
	return userBrief{u.ID, u.Name, u.Avatar, u.Color}
}
