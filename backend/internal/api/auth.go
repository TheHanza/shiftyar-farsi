package api

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

const tokenTTL = 30 * 24 * time.Hour

func (s *Server) issueToken(u models.User) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   jwtSubject(u.ID),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(tokenTTL)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.cfg.JWTSecret)
}

func (s *Server) login(c *gin.Context) {
	var in struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, http.StatusBadRequest, "درخواست نامعتبر است")
		return
	}
	if !s.limiter.allow(c.ClientIP()) {
		fail(c, http.StatusTooManyRequests, "تلاش زیاد بود؛ چند دقیقه دیگر دوباره امتحان کن")
		return
	}
	var u models.User
	err := s.db.Where("lower(username) = ?", strings.ToLower(strings.TrimSpace(in.Username))).First(&u).Error
	if err != nil || !u.Active || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) != nil {
		fail(c, http.StatusUnauthorized, "نام کاربری یا رمز عبور اشتباه است")
		return
	}
	s.limiter.reset(c.ClientIP())
	token, err := s.issueToken(u)
	if err != nil {
		fail(c, http.StatusInternalServerError, "خطای داخلی")
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": u})
}

func (s *Server) requireAuth(c *gin.Context) {
	raw := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	var claims jwt.RegisteredClaims
	tok, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (any, error) { return s.cfg.JWTSecret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !tok.Valid {
		fail(c, http.StatusUnauthorized, "لطفاً دوباره وارد شو")
		return
	}
	var u models.User
	if s.db.First(&u, parseSubject(claims.Subject)).Error != nil || !u.Active {
		fail(c, http.StatusUnauthorized, "لطفاً دوباره وارد شو")
		return
	}
	c.Set("user", u)
	c.Next()
}

func (s *Server) requireAdmin(c *gin.Context) {
	if !me(c).IsAdmin() {
		fail(c, http.StatusForbidden, "دسترسی مدیر لازم است")
		return
	}
	c.Next()
}

// loginLimiter is a small fixed-window limiter for failed-login brute force.
type loginLimiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string][]time.Time
}

func newLoginLimiter(max int, window time.Duration) *loginLimiter {
	return &loginLimiter{max: max, window: window, hits: map[string][]time.Time{}}
}

func (l *loginLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	kept := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if now.Sub(t) < l.window {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.max {
		l.hits[key] = kept
		return false
	}
	l.hits[key] = append(kept, now)
	return true
}

func (l *loginLimiter) reset(key string) {
	l.mu.Lock()
	delete(l.hits, key)
	l.mu.Unlock()
}
